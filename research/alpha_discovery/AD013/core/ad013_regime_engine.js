/**
 * ALPHA FACTORY — AD013 REGIME-ADAPTIVE TRADFI ENGINE
 * File: ad013_regime_engine.js
 * 
 * Deterministic, causal simulation engine for high-frequency TradFi alpha discovery.
 * - Computes ADX(14), ATR(14), EMA(20), EMA(50), Bollinger Bands(20, Z), and RSI(14)
 * - Zero lookahead bias: signals evaluated at close(t), orders executed at open(t+1)
 * - Regime switching:
 *     * Trend (ADX >= trendThreshold): Pullback entries to EMA20 with ATR-based stops
 *     * Chop (ADX < chopThreshold): Extreme Bollinger Band rejection entries
 * - Weekend-flat rule: force-close on Friday at >= 20:00 UTC
 * - Max holding horizon: 24 bars (intraday time stop)
 * - Realistic transaction costs in bps deducted from each trade
 */

export function calculateIndicators(candles) {
  const n = candles.length;
  if (n < 60) return [];

  const tr = new Array(n).fill(0);
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);

  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < n; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];

    // True Range
    const hl = cur.high - cur.low;
    const hpc = Math.abs(cur.high - prev.close);
    const lpc = Math.abs(cur.low - prev.close);
    tr[i] = Math.max(hl, hpc, lpc);

    // Directional Movement
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  // Wilder's smoothing for ATR(14), +DI(14), -DI(14), ADX(14)
  const period = 14;
  const smoothedTR = new Array(n).fill(0);
  const smoothedPDM = new Array(n).fill(0);
  const smoothedMDM = new Array(n).fill(0);
  const plusDI = new Array(n).fill(0);
  const minusDI = new Array(n).fill(0);
  const dx = new Array(n).fill(0);
  const adx = new Array(n).fill(0);
  const atr = new Array(n).fill(0);

  let sumTR = 0;
  let sumPDM = 0;
  let sumMDM = 0;

  for (let i = 0; i < period; i++) {
    sumTR += tr[i];
    sumPDM += plusDM[i];
    sumMDM += minusDM[i];
  }

  smoothedTR[period - 1] = sumTR;
  smoothedPDM[period - 1] = sumPDM;
  smoothedMDM[period - 1] = sumMDM;
  atr[period - 1] = sumTR / period;

  for (let i = period; i < n; i++) {
    smoothedTR[i] = smoothedTR[i - 1] - (smoothedTR[i - 1] / period) + tr[i];
    smoothedPDM[i] = smoothedPDM[i - 1] - (smoothedPDM[i - 1] / period) + plusDM[i];
    smoothedMDM[i] = smoothedMDM[i - 1] - (smoothedMDM[i - 1] / period) + minusDM[i];
    atr[i] = smoothedTR[i] / period;

    const sTR = smoothedTR[i] > 0 ? smoothedTR[i] : 1e-9;
    plusDI[i] = 100 * (smoothedPDM[i] / sTR);
    minusDI[i] = 100 * (smoothedMDM[i] / sTR);

    const diDiff = Math.abs(plusDI[i] - minusDI[i]);
    const diSum = plusDI[i] + minusDI[i];
    dx[i] = diSum > 0 ? 100 * (diDiff / diSum) : 0;
  }

  // Smooth DX to get ADX
  let sumDX = 0;
  for (let i = period - 1; i < (2 * period) - 1 && i < n; i++) {
    sumDX += dx[i];
  }
  const adxStartIdx = (2 * period) - 1;
  if (adxStartIdx < n) {
    adx[adxStartIdx] = sumDX / period;
    for (let i = adxStartIdx + 1; i < n; i++) {
      adx[i] = ((adx[i - 1] * (period - 1)) + dx[i]) / period;
    }
  }

  // EMA(20) & EMA(50)
  const ema20 = new Array(n).fill(0);
  const ema50 = new Array(n).fill(0);

  const k20 = 2 / (20 + 1);
  const k50 = 2 / (50 + 1);

  let sumClose20 = 0;
  for (let i = 0; i < 20; i++) sumClose20 += candles[i].close;
  ema20[19] = sumClose20 / 20;

  for (let i = 20; i < n; i++) {
    ema20[i] = candles[i].close * k20 + ema20[i - 1] * (1 - k20);
  }

  let sumClose50 = 0;
  for (let i = 0; i < 50; i++) sumClose50 += candles[i].close;
  ema50[49] = sumClose50 / 50;

  for (let i = 50; i < n; i++) {
    ema50[i] = candles[i].close * k50 + ema50[i - 1] * (1 - k50);
  }

  // Bollinger Bands(20) & RSI(14)
  const bbMiddle = new Array(n).fill(0);
  const bbStd = new Array(n).fill(0);
  const rsi = new Array(n).fill(50);

  // RSI Wilder smoothing
  const gains = new Array(n).fill(0);
  const losses = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) gains[i] = diff;
    else losses[i] = -diff;
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) rsi[period] = 100;
  else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }

  for (let i = period + 1; i < n; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    if (avgLoss === 0) rsi[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  // Bollinger 20
  for (let i = 19; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < 20; j++) {
      sum += candles[i - j].close;
    }
    const mean = sum / 20;
    bbMiddle[i] = mean;

    let varianceSum = 0;
    for (let j = 0; j < 20; j++) {
      const dev = candles[i - j].close - mean;
      varianceSum += dev * dev;
    }
    bbStd[i] = Math.sqrt(varianceSum / 20);
  }

  // Consolidate indicators array
  const indicators = new Array(n);
  for (let i = 0; i < n; i++) {
    indicators[i] = {
      timestamp: candles[i].timestamp,
      atr: atr[i],
      adx: adx[i],
      ema20: ema20[i],
      ema50: ema50[i],
      bbMiddle: bbMiddle[i],
      bbStd: bbStd[i],
      rsi: rsi[i]
    };
  }

  return indicators;
}

export function simulateCell(candles, cellConfig, frictionBps) {
  const indicators = calculateIndicators(candles);
  const n = candles.length;
  if (n < 60) return { trades: [], summary: null };

  const {
    adxTrendThreshold = 22,
    adxChopThreshold = 20,
    bollingerZ = 2.0,
    riskReward = 1.5,
    maxHoldingHours = 24
  } = cellConfig;

  const frictionPct = frictionBps / 10000;
  const trades = [];
  let openTrade = null;

  for (let i = 50; i < n - 1; i++) {
    const curCandle = candles[i];
    const ind = indicators[i];
    const nextCandle = candles[i + 1];

    // If position is currently open, evaluate exit at candle i
    if (openTrade) {
      openTrade.barsHeld++;

      let exitPrice = null;
      let exitReason = null;

      // 1. Weekend Flat Check: Friday (UTC 5) >= 20:00
      const date = new Date(curCandle.timestamp);
      const dayOfWeek = date.getUTCDay(); // 5 = Friday
      const hourUtc = date.getUTCHours();

      if (dayOfWeek === 5 && hourUtc >= 20) {
        exitPrice = curCandle.close;
        exitReason = 'WEEKEND_FLAT';
      }

      // 2. Target / Stop Evaluation in current bar
      if (!exitPrice) {
        if (openTrade.direction === 'LONG') {
          const hitStop = curCandle.low <= openTrade.stopLoss;
          const hitTarget = curCandle.high >= openTrade.takeProfit;

          if (hitStop && hitTarget) {
            // Conservative: assume stop hit first
            exitPrice = openTrade.stopLoss;
            exitReason = 'STOP_LOSS_CONSERVATIVE';
          } else if (hitStop) {
            exitPrice = openTrade.stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitTarget) {
            exitPrice = openTrade.takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        } else { // SHORT
          const hitStop = curCandle.high >= openTrade.stopLoss;
          const hitTarget = curCandle.low <= openTrade.takeProfit;

          if (hitStop && hitTarget) {
            exitPrice = openTrade.stopLoss;
            exitReason = 'STOP_LOSS_CONSERVATIVE';
          } else if (hitStop) {
            exitPrice = openTrade.stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (hitTarget) {
            exitPrice = openTrade.takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        }
      }

      // 3. Time Stop
      if (!exitPrice && openTrade.barsHeld >= maxHoldingHours) {
        exitPrice = curCandle.close;
        exitReason = 'TIME_STOP';
      }

      if (exitPrice !== null) {
        // Calculate PnL and R
        let grossPct = 0;
        if (openTrade.direction === 'LONG') {
          grossPct = (exitPrice - openTrade.entryPrice) / openTrade.entryPrice;
        } else {
          grossPct = (openTrade.entryPrice - exitPrice) / openTrade.entryPrice;
        }

        const netPct = grossPct - frictionPct;
        const netR = netPct / openTrade.riskPct;

        trades.push({
          id: `${cellConfig.id}_T${trades.length + 1}`,
          direction: openTrade.direction,
          regime: openTrade.regime,
          entryTimestamp: openTrade.entryTimestamp,
          exitTimestamp: curCandle.timestamp,
          entryPrice: openTrade.entryPrice,
          exitPrice,
          stopLoss: openTrade.stopLoss,
          takeProfit: openTrade.takeProfit,
          barsHeld: openTrade.barsHeld,
          grossPct,
          netPct,
          netR,
          exitReason,
          isWin: netR > 0
        });

        openTrade = null;
      }
    }

    // If no trade open, look for signals at close(i) to enter at open(i+1)
    if (!openTrade && i < n - 2) {
      // Don't open new positions on Friday after 18:00 UTC
      const date = new Date(curCandle.timestamp);
      const dayOfWeek = date.getUTCDay();
      const hourUtc = date.getUTCHours();
      if (dayOfWeek === 5 && hourUtc >= 18) {
        continue;
      }

      const atrVal = ind.atr;
      if (atrVal <= 0) continue;

      const adxVal = ind.adx;
      const bbUpper = ind.bbMiddle + (bollingerZ * ind.bbStd);
      const bbLower = ind.bbMiddle - (bollingerZ * ind.bbStd);

      // REGIME 1: TREND (ADX >= adxTrendThreshold)
      if (adxVal >= adxTrendThreshold) {
        const isBullishTrend = ind.ema20 > ind.ema50;
        const isBearishTrend = ind.ema20 < ind.ema50;

        // Long Trend Pullback: Bullish trend, candle i pulled back to touch EMA20, closed above EMA20 and green
        if (isBullishTrend && curCandle.low <= ind.ema20 && curCandle.close > ind.ema20 && curCandle.close > curCandle.open) {
          const entryPrice = nextCandle.open;
          const stopDist = 1.2 * atrVal;
          const stopLoss = entryPrice - stopDist;
          const targetDist = stopDist * riskReward;
          const takeProfit = entryPrice + targetDist;
          const riskPct = stopDist / entryPrice;

          if (riskPct > 0.0005) {
            openTrade = {
              direction: 'LONG',
              regime: 'TREND_PULLBACK',
              entryTimestamp: nextCandle.timestamp,
              entryPrice,
              stopLoss,
              takeProfit,
              riskPct,
              barsHeld: 0
            };
          }
        }
        // Short Trend Pullback: Bearish trend, candle i pulled back to touch EMA20, closed below EMA20 and red
        else if (isBearishTrend && curCandle.high >= ind.ema20 && curCandle.close < ind.ema20 && curCandle.close < curCandle.open) {
          const entryPrice = nextCandle.open;
          const stopDist = 1.2 * atrVal;
          const stopLoss = entryPrice + stopDist;
          const targetDist = stopDist * riskReward;
          const takeProfit = entryPrice - targetDist;
          const riskPct = stopDist / entryPrice;

          if (riskPct > 0.0005) {
            openTrade = {
              direction: 'SHORT',
              regime: 'TREND_PULLBACK',
              entryTimestamp: nextCandle.timestamp,
              entryPrice,
              stopLoss,
              takeProfit,
              riskPct,
              barsHeld: 0
            };
          }
        }
      }
      // REGIME 2: CHOP / MEAN REVERSION (ADX < adxChopThreshold)
      else if (adxVal < adxChopThreshold) {
        // Long Reversion: Pierced lower band, closed back above, RSI oversold (< 35)
        if (curCandle.low < bbLower && curCandle.close > bbLower && ind.rsi < 35) {
          const entryPrice = nextCandle.open;
          const prevLow = Math.min(curCandle.low, candles[i - 1].low);
          const stopLoss = prevLow - (0.2 * atrVal);
          const stopDist = entryPrice - stopLoss;
          const riskPct = stopDist / entryPrice;

          if (stopDist > 0 && riskPct > 0.0005) {
            const takeProfit = entryPrice + (stopDist * riskReward);
            openTrade = {
              direction: 'LONG',
              regime: 'CHOP_MEAN_REVERSION',
              entryTimestamp: nextCandle.timestamp,
              entryPrice,
              stopLoss,
              takeProfit,
              riskPct,
              barsHeld: 0
            };
          }
        }
        // Short Reversion: Pierced upper band, closed back below, RSI overbought (> 65)
        else if (curCandle.high > bbUpper && curCandle.close < bbUpper && ind.rsi > 65) {
          const entryPrice = nextCandle.open;
          const prevHigh = Math.max(curCandle.high, candles[i - 1].high);
          const stopLoss = prevHigh + (0.2 * atrVal);
          const stopDist = stopLoss - entryPrice;
          const riskPct = stopDist / entryPrice;

          if (stopDist > 0 && riskPct > 0.0005) {
            const takeProfit = entryPrice - (stopDist * riskReward);
            openTrade = {
              direction: 'SHORT',
              regime: 'CHOP_MEAN_REVERSION',
              entryTimestamp: nextCandle.timestamp,
              entryPrice,
              stopLoss,
              takeProfit,
              riskPct,
              barsHeld: 0
            };
          }
        }
      }
    }
  }

  // Summary Metrics
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      trades: [],
      summary: {
        totalTrades: 0,
        weeklyFrequency: 0,
        winRate: 0,
        expectancyR: 0,
        profitFactor: 0,
        totalNetR: 0,
        grossWinsR: 0,
        grossLossesR: 0
      }
    };
  }

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const winRate = wins.length / totalTrades;

  let grossWinsR = 0;
  let grossLossesR = 0;
  let sumNetR = 0;

  for (const t of trades) {
    sumNetR += t.netR;
    if (t.netR > 0) grossWinsR += t.netR;
    else grossLossesR += Math.abs(t.netR);
  }

  const expectancyR = sumNetR / totalTrades;
  const profitFactor = grossLossesR > 0 ? (grossWinsR / grossLossesR) : (grossWinsR > 0 ? 99.0 : 0);
  const discoveryWeeks = cellConfig.discoveryWeeks || 58.0;
  const weeklyFrequency = totalTrades / discoveryWeeks;

  return {
    trades,
    summary: {
      totalTrades,
      weeklyFrequency: Number(weeklyFrequency.toFixed(2)),
      winRate: Number((winRate * 100).toFixed(1)),
      expectancyR: Number(expectancyR.toFixed(3)),
      profitFactor: Number(profitFactor.toFixed(2)),
      totalNetR: Number(sumNetR.toFixed(2)),
      grossWinsR: Number(grossWinsR.toFixed(2)),
      grossLossesR: Number(grossLossesR.toFixed(2))
    }
  };
}
