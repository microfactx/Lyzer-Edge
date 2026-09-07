/**
 * ALPHA FACTORY — AD012 CROSS-ASSET TREND BREAKOUT ENGINE
 * Module: ad012_breakout_engine.js
 * 
 * Formal Institutional Architecture:
 * 1. Deterministic 1H -> 4H Calendar-Aligned Aggregator (Zero Lookahead Invariant).
 * 2. Macro 4H Donchian Channel Breakout (L=20, L=50).
 * 3. Micro 1H Volatility Expansion Filter (ATR14 >= 1.15 * BaselineATR50).
 * 4. Realistic Friction Modeling for TradFi (SPY, QQQ, GLD, EURUSD, GBPUSD) & Crypto (BTC).
 * 5. Conservative Fill Engine (Worst-case Stop Priority on intraday tie-breaks).
 */

export class AD012BreakoutEngine {
  /**
   * Aggregates 1H candles into 4H closed blocks.
   */
  static aggregate1Hto4H(hourlyCandles) {
    if (!hourlyCandles || hourlyCandles.length === 0) return [];

    const bucketMs = 4 * 3600 * 1000;
    const buckets = new Map();

    for (let i = 0; i < hourlyCandles.length; i++) {
      const c = hourlyCandles[i];
      const bIdx = Math.floor(c.timestamp / bucketMs);
      if (!buckets.has(bIdx)) {
        buckets.set(bIdx, []);
      }
      buckets.get(bIdx).push(c);
    }

    const fourHourBars = [];
    const sortedBucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const k of sortedBucketKeys) {
      const list = buckets.get(k);
      if (list.length === 0) continue;

      let o = list[0].open;
      let h = -Infinity;
      let l = Infinity;
      let c = list[list.length - 1].close;
      let vol = 0;

      for (let j = 0; j < list.length; j++) {
        if (list[j].high > h) h = list[j].high;
        if (list[j].low < l) l = list[j].low;
        vol += list[j].volume || 0;
      }

      const openTime = list[0].openTime || list[0].timestamp;
      const closeTime = list[list.length - 1].closeTime || (openTime + (list.length * 3600 * 1000) - 1);

      fourHourBars.push({
        bucketIndex: k,
        openTime,
        closeTime,
        timestamp: openTime,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: vol,
        barCount: list.length
      });
    }

    return fourHourBars;
  }

  /**
   * Computes Average True Range (ATR) on 1H candles.
   */
  static computeATR1H(candles, period = 14) {
    const atrs = new Float64Array(candles.length);
    if (candles.length === 0) return atrs;

    let trSum = 0;
    for (let i = 0; i < candles.length; i++) {
      let tr = candles[i].high - candles[i].low;
      if (i > 0) {
        const prevC = candles[i - 1].close;
        const hDiff = Math.abs(candles[i].high - prevC);
        const lDiff = Math.abs(candles[i].low - prevC);
        tr = Math.max(tr, hDiff, lDiff);
      }

      if (i < period) {
        trSum += tr;
        atrs[i] = trSum / (i + 1);
      } else {
        atrs[i] = (atrs[i - 1] * (period - 1) + tr) / period;
      }
    }
    return atrs;
  }

  /**
   * Simulates the AD012 Trend Breakout Strategy.
   */
  static simulate(hourlyCandles, cellConfig, frictionConfig) {
    const L = cellConfig.macroLookback; // 20 or 50 4H bars
    const rr = cellConfig.riskReward;   // 2.0 or 3.0
    const maxHoldBars = 48;             // max 48 hours holding
    const slAtrMult = 2.0;
    const volRatioThreshold = 1.15;

    const feeRate = (frictionConfig.feeBpsPerLeg || 1.0) / 10000;
    const slippageRate = (frictionConfig.slippageBpsPerLeg || 1.0) / 10000;

    const fourHourBars = this.aggregate1Hto4H(hourlyCandles);
    const atrs1H = this.computeATR1H(hourlyCandles, 14);

    // Compute moving average of ATR1H over 50 bars
    const baselineAtrs = new Float64Array(hourlyCandles.length);
    let atrWindowSum = 0;
    for (let i = 0; i < hourlyCandles.length; i++) {
      atrWindowSum += atrs1H[i];
      if (i >= 50) {
        atrWindowSum -= atrs1H[i - 50];
        baselineAtrs[i] = atrWindowSum / 50;
      } else {
        baselineAtrs[i] = atrWindowSum / (i + 1);
      }
    }

    if (fourHourBars.length < L + 5) {
      return { trades: [], nTrades: 0 };
    }

    // Map 1H index to the latest closed 4H index (Strict Zero Lookahead)
    const latest4HIndexFor1H = new Int32Array(hourlyCandles.length);
    let h4Ptr = 0;
    for (let i = 0; i < hourlyCandles.length; i++) {
      const t1 = hourlyCandles[i].timestamp;
      while (h4Ptr < fourHourBars.length && fourHourBars[h4Ptr].closeTime <= t1) {
        h4Ptr++;
      }
      latest4HIndexFor1H[i] = h4Ptr - 1; // last closed 4H bar
    }

    const trades = [];
    let inTrade = false;
    let activeTrade = null;

    for (let i = 60; i < hourlyCandles.length - 1; i++) {
      // 1. Manage Active Position
      if (inTrade) {
        const curBar = hourlyCandles[i];
        const barsHeld = i - activeTrade.entryIndex;

        let exitPrice = 0;
        let exitReason = null;

        if (activeTrade.direction === 'LONG') {
          // Worst-case tie break: Low <= SL executes first
          if (curBar.low <= activeTrade.stopLoss) {
            exitPrice = activeTrade.stopLoss * (1 - slippageRate);
            exitReason = 'STOP_LOSS';
          } else if (curBar.high >= activeTrade.takeProfit) {
            exitPrice = activeTrade.takeProfit * (1 - slippageRate);
            exitReason = 'TAKE_PROFIT';
          } else if (barsHeld >= maxHoldBars) {
            exitPrice = curBar.close * (1 - slippageRate);
            exitReason = 'TIME_STOP';
          }
        } else {
          // SHORT position
          if (curBar.high >= activeTrade.stopLoss) {
            exitPrice = activeTrade.stopLoss * (1 + slippageRate);
            exitReason = 'STOP_LOSS';
          } else if (curBar.low <= activeTrade.takeProfit) {
            exitPrice = activeTrade.takeProfit * (1 + slippageRate);
            exitReason = 'TAKE_PROFIT';
          } else if (barsHeld >= maxHoldBars) {
            exitPrice = curBar.close * (1 + slippageRate);
            exitReason = 'TIME_STOP';
          }
        }

        if (exitReason) {
          // Calculate net PnL and net R after roundtrip friction
          let pnlFraction = 0;
          if (activeTrade.direction === 'LONG') {
            pnlFraction = (exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice - (feeRate * 2);
          } else {
            pnlFraction = (activeTrade.entryPrice - exitPrice) / activeTrade.entryPrice - (feeRate * 2);
          }

          const riskFraction = Math.abs(activeTrade.entryPrice - activeTrade.stopLoss) / activeTrade.entryPrice;
          const netR = riskFraction > 0.0001 ? Number((pnlFraction / riskFraction).toFixed(3)) : 0;

          trades.push({
            id: trades.length + 1,
            direction: activeTrade.direction,
            entryTime: activeTrade.entryTime,
            exitTime: curBar.timestamp,
            exitTimestamp: curBar.timestamp,
            entryPrice: Number(activeTrade.entryPrice.toFixed(5)),
            exitPrice: Number(exitPrice.toFixed(5)),
            stopLoss: Number(activeTrade.stopLoss.toFixed(5)),
            takeProfit: Number(activeTrade.takeProfit.toFixed(5)),
            exitReason,
            barsHeld,
            netR
          });

          inTrade = false;
          activeTrade = null;
        }
        continue;
      }

      // 2. Scan for Breakout
      const lastClosed4H = latest4HIndexFor1H[i];
      if (lastClosed4H < L) continue;

      // Compute 4H Donchian Channel over prior L bars
      let upperBand = -Infinity;
      let lowerBand = Infinity;
      for (let k = lastClosed4H - L; k < lastClosed4H; k++) {
        if (fourHourBars[k].high > upperBand) upperBand = fourHourBars[k].high;
        if (fourHourBars[k].low < lowerBand) lowerBand = fourHourBars[k].low;
      }

      const cur1H = hourlyCandles[i];
      const atr1H = atrs1H[i];
      const baseAtr = baselineAtrs[i];

      // Volatility expansion check
      if (baseAtr <= 0 || (atr1H / baseAtr) < volRatioThreshold) continue;

      // Long Breakout: 1H closes above 4H upper band
      if (cur1H.close > upperBand && cur1H.close > cur1H.open) {
        const entryPrice = cur1H.close * (1 + slippageRate);
        const stopLoss = entryPrice - (slAtrMult * atr1H);
        const risk = entryPrice - stopLoss;

        if (risk > 0.0001 * entryPrice && risk < 0.10 * entryPrice) {
          const takeProfit = entryPrice + (rr * risk);
          inTrade = true;
          activeTrade = {
            direction: 'LONG',
            entryIndex: i,
            entryTime: cur1H.timestamp,
            entryPrice,
            stopLoss,
            takeProfit
          };
        }
      }
      // Short Breakout: 1H closes below 4H lower band
      else if (cur1H.close < lowerBand && cur1H.close < cur1H.open) {
        const entryPrice = cur1H.close * (1 - slippageRate);
        const stopLoss = entryPrice + (slAtrMult * atr1H);
        const risk = stopLoss - entryPrice;

        if (risk > 0.0001 * entryPrice && risk < 0.10 * entryPrice) {
          const takeProfit = entryPrice - (rr * risk);
          inTrade = true;
          activeTrade = {
            direction: 'SHORT',
            entryIndex: i,
            entryTime: cur1H.timestamp,
            entryPrice,
            stopLoss,
            takeProfit
          };
        }
      }
    }

    return {
      trades,
      nTrades: trades.length
    };
  }
}
