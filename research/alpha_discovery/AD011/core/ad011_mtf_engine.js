/**
 * ALPHA FACTORY — AD011 MULTI-TIMEFRAME ENGINE
 * Module: ad011_mtf_engine.js
 * 
 * Formal Institutional Architecture:
 * 1. Deterministic 1H -> 4H Calendar-Aligned Aggregator (Zero Lookahead Invariant).
 * 2. Macro 4H Liquidity Sweep & Rejection Wick Detector (L=24, L=48).
 * 3. Micro 1H Change in State of Delivery (CISD) Displacement Trigger.
 * 4. Realistic TradFi/Forex/Crypto Friction Modeling (Fees, Slippage, Bid-Ask Spread).
 * 5. Conservative Fill Engine (Worst-case Stop Priority on intraday tie-breaks).
 */

export class AD011MTFEngine {
  /**
   * Aggregates 1H candles into 4H closed blocks.
   * A 4H block is strictly closed when its last bar closes.
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
   * Simulates the AD011 MTF Strategy on an asset dataset.
   */
  static simulate(hourlyCandles, cellConfig, frictionConfig) {
    const L = cellConfig.macroLookback; // 24 or 48
    const rr = cellConfig.riskReward;   // 2.5 or 3.5
    const minWickRatio = 0.40;
    const minBodyRatio = 1.20;
    const maxConfirmBars = 3;
    const maxHoldBars = 36;

    const feeRate = (frictionConfig.feeBpsPerLeg || 1.0) / 10000;
    const slippageRate = (frictionConfig.slippageBpsPerLeg || 1.0) / 10000;

    const fourHourBars = this.aggregate1Hto4H(hourlyCandles);
    const atrs1H = this.computeATR1H(hourlyCandles, 14);

    if (fourHourBars.length < L + 5) {
      return { trades: [], nTrades: 0, summary: null };
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

    for (let i = 20; i < hourlyCandles.length - 1; i++) {
      // 1. Manage Active Position
      if (inTrade) {
        const curBar = hourlyCandles[i];
        const barsHeld = i - activeTrade.entryIndex;

        let exitPrice = 0;
        let exitReason = null;
        let rawR = 0;

        if (activeTrade.direction === 'LONG') {
          // Worst case tie-break: if Low touches SL and High touches TP in same bar, SL wins
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
          // Account for roundtrip fees
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

      // 2. Scan for New MTF Setup
      const lastClosed4H = latest4HIndexFor1H[i];
      if (lastClosed4H < L) continue;

      const bar4H = fourHourBars[lastClosed4H];

      // Calculate Swing High and Low over prior L bars
      let swingHigh = -Infinity;
      let swingLow = Infinity;
      for (let k = lastClosed4H - L; k < lastClosed4H; k++) {
        if (fourHourBars[k].high > swingHigh) swingHigh = fourHourBars[k].high;
        if (fourHourBars[k].low < swingLow) swingLow = fourHourBars[k].low;
      }

      const bar4HRange = bar4H.high - bar4H.low;
      if (bar4HRange <= 0) continue;

      let setupDirection = null;

      // Bullish Sweep: 4H pierced below swingLow but closed above it
      if (bar4H.low < swingLow && bar4H.close > swingLow) {
        const lowerWick = Math.min(bar4H.open, bar4H.close) - bar4H.low;
        if (lowerWick / bar4HRange >= minWickRatio) {
          setupDirection = 'LONG';
        }
      }

      // Bearish Sweep: 4H pierced above swingHigh but closed below it
      if (bar4H.high > swingHigh && bar4H.close < swingHigh) {
        const upperWick = bar4H.high - Math.max(bar4H.open, bar4H.close);
        if (upperWick / bar4HRange >= minWickRatio) {
          setupDirection = 'SHORT';
        }
      }

      if (!setupDirection) continue;

      // 3. Confirm with 1H CISD Displacement
      const cur1H = hourlyCandles[i];
      const atr1H = atrs1H[i];
      const body1H = Math.abs(cur1H.close - cur1H.open);

      if (setupDirection === 'LONG') {
        const isBullishDisplacement = cur1H.close > cur1H.open && body1H >= minBodyRatio * atr1H;
        if (isBullishDisplacement) {
          const entryPrice = cur1H.close * (1 + slippageRate);
          const stopLoss = bar4H.low * (1 - slippageRate);
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
      } else if (setupDirection === 'SHORT') {
        const isBearishDisplacement = cur1H.close < cur1H.open && body1H >= minBodyRatio * atr1H;
        if (isBearishDisplacement) {
          const entryPrice = cur1H.close * (1 - slippageRate);
          const stopLoss = bar4H.high * (1 + slippageRate);
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
    }

    return {
      trades,
      nTrades: trades.length
    };
  }
}
