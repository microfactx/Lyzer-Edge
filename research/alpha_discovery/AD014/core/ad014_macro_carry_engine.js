/**
 * ALPHA FACTORY — AD014 MACRO CARRY & PASSIVE INCOME ENGINE
 * File: ad014_macro_carry_engine.js
 * 
 * Deterministic engine for regime-protected macro carry trade & algorithmic passive income:
 * - Computes EMA(L), ATR(14), and MA(ATR)(50) strictly causally.
 * - Switches dynamically between:
 *     * ACTIVE_CARRY: Earning asset swap rate (+ price return if unhedged FX, 0 if delta-neutral)
 *     * SAFE_HAVEN_CASH: Earning T-Bill risk-free yield (5.0% p.a.) with zero market risk
 * - Deducts turnover friction on state transitions.
 * - Computes hourly equity curves, annualized yields, Sharpe ratios, and max drawdowns.
 */

export function calculateMacroIndicators(candles, emaLookback = 100) {
  const n = candles.length;
  if (n < emaLookback + 50) return [];

  // 1. True Range
  const tr = new Array(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hpc = Math.abs(candles[i].high - candles[i - 1].close);
    const lpc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  // 2. Wilder ATR(14)
  const atr = new Array(n).fill(0);
  let sumTR = 0;
  for (let i = 0; i < 14; i++) sumTR += tr[i];
  atr[13] = sumTR / 14;
  for (let i = 14; i < n; i++) {
    atr[i] = (atr[i - 1] * 13 + tr[i]) / 14;
  }

  // 3. MA(ATR)(50)
  const maAtr = new Array(n).fill(0);
  for (let i = 13 + 49; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < 50; j++) sum += atr[i - j];
    maAtr[i] = sum / 50;
  }

  // 4. EMA(emaLookback)
  const ema = new Array(n).fill(0);
  const k = 2 / (emaLookback + 1);
  let sumClose = 0;
  for (let i = 0; i < emaLookback; i++) sumClose += candles[i].close;
  ema[emaLookback - 1] = sumClose / emaLookback;
  for (let i = emaLookback; i < n; i++) {
    ema[i] = candles[i].close * k + ema[i - 1] * (1 - k);
  }

  // 5. Consolidated Indicators
  const indicators = new Array(n);
  for (let i = 0; i < n; i++) {
    const vRatio = maAtr[i] > 0 ? (atr[i] / maAtr[i]) : 1.0;
    indicators[i] = {
      timestamp: candles[i].timestamp,
      close: candles[i].close,
      ema: ema[i],
      atr: atr[i],
      maAtr: maAtr[i],
      volRatio: vRatio
    };
  }

  return indicators;
}

export function simulateMacroCarry(candles, cellConfig, profile, safeHavenTBillRate = 0.0500) {
  const emaLookback = cellConfig.emaLookback || 100;
  const volRatioThreshold = cellConfig.volRatioThreshold || 1.25;
  const indicators = calculateMacroIndicators(candles, emaLookback);
  const n = candles.length;

  const warmupBars = Math.max(emaLookback, 64) + 1;
  if (n <= warmupBars) {
    return { summary: null, equityCurve: [] };
  }

  const annualCarryRate = profile.annualGrossCarryRate || 0.0500;
  const frictionPct = (profile.turnoverFrictionBps || 3.0) / 10000;
  const dt = 1 / 8760; // 1 hour in fractional year

  let nav = 1.0;
  let peakNav = 1.0;
  let maxDrawdown = 0;
  let currentState = 'SAFE_HAVEN_CASH';
  let stateBarsHeld = 24;
  let transitions = 0;
  let carryHours = 0;
  let cashHours = 0;

  const equityCurve = [];
  const hourlyReturns = [];

  for (let i = warmupBars; i < n - 1; i++) {
    const curInd = indicators[i];
    const curCandle = candles[i];
    const nextCandle = candles[i + 1];

    // Evaluate target state causally at close(i) for implementation in bar(i+1)
    let shouldBeInCarry = false;

    if (profile.carryDirection === 'DELTA_NEUTRAL') {
      // Delta neutral only requires volatility safety
      shouldBeInCarry = curInd.volRatio <= volRatioThreshold;
    } else if (profile.carryDirection === 'LONG') {
      // Long carry requires price above macro EMA AND safe volatility
      const trendOk = curInd.close > curInd.ema;
      const volOk = curInd.volRatio <= volRatioThreshold;
      shouldBeInCarry = trendOk && volOk;
    } else if (profile.carryDirection === 'SHORT') {
      // Short carry requires price below macro EMA AND safe volatility
      const trendOk = curInd.close < curInd.ema;
      const volOk = curInd.volRatio <= volRatioThreshold;
      shouldBeInCarry = trendOk && volOk;
    }

    const nextState = shouldBeInCarry ? 'ACTIVE_CARRY' : 'SAFE_HAVEN_CASH';

    // Transition friction check with dwell hours hysteresis
    const dwellHours = cellConfig.dwellHours || 24;
    let friction = 0;
    
    // Emergency exit if in carry and catastrophic drop occurs
    const emergencyExit = currentState === 'ACTIVE_CARRY' && (
      (profile.carryDirection === 'LONG' && curCandle.close < curInd.ema - (1.5 * curInd.atr)) ||
      (profile.carryDirection === 'SHORT' && curCandle.close > curInd.ema + (1.5 * curInd.atr)) ||
      (curInd.volRatio > volRatioThreshold * 1.5)
    );

    if (nextState !== currentState && (stateBarsHeld >= dwellHours || emergencyExit)) {
      friction = frictionPct;
      transitions++;
      currentState = nextState;
      stateBarsHeld = 0;
    } else {
      stateBarsHeld++;
    }

    // Compute return for candle i+1
    let grossReturn = 0;
    if (currentState === 'ACTIVE_CARRY') {
      carryHours++;
      const carryAccrual = annualCarryRate * dt;

      let priceReturn = 0;
      if (profile.carryDirection === 'LONG') {
        priceReturn = (nextCandle.close - curCandle.close) / curCandle.close;
      } else if (profile.carryDirection === 'SHORT') {
        priceReturn = (curCandle.close - nextCandle.close) / curCandle.close;
      } else {
        priceReturn = 0; // Delta-Neutral
      }

      grossReturn = carryAccrual + priceReturn;
    } else {
      cashHours++;
      grossReturn = safeHavenTBillRate * dt;
    }

    const netReturn = grossReturn - friction;
    hourlyReturns.push(netReturn);

    nav = nav * (1 + netReturn);
    if (nav > peakNav) peakNav = nav;
    const dd = (peakNav - nav) / peakNav;
    if (dd > maxDrawdown) maxDrawdown = dd;

    equityCurve.push({
      timestamp: nextCandle.timestamp,
      nav,
      drawdown: dd,
      state: currentState
    });
  }

  // Summary Metrics
  const totalHours = carryHours + cashHours;
  const totalReturnPct = (nav - 1.0) * 100;
  const years = totalHours / 8760;
  const annualizedReturnPct = years > 0 ? (Math.pow(nav, 1 / years) - 1.0) * 100 : 0;
  const maxDrawdownPct = maxDrawdown * 100;

  // Mean & Std of hourly returns
  let sumRet = 0;
  for (const r of hourlyReturns) sumRet += r;
  const meanHourly = hourlyReturns.length > 0 ? sumRet / hourlyReturns.length : 0;

  let varSum = 0;
  for (const r of hourlyReturns) {
    const diff = r - meanHourly;
    varSum += diff * diff;
  }
  const stdHourly = hourlyReturns.length > 1 ? Math.sqrt(varSum / (hourlyReturns.length - 1)) : 1e-9;
  const sharpeRatio = stdHourly > 0 ? (meanHourly * 8760) / (stdHourly * Math.sqrt(8760)) : 0;

  const activeCarryRatioPct = totalHours > 0 ? (carryHours / totalHours) * 100 : 0;

  return {
    equityCurve,
    hourlyReturns,
    summary: {
      id: cellConfig.id,
      asset: cellConfig.asset,
      totalHours,
      totalReturnPct: Number(totalReturnPct.toFixed(2)),
      annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      transitions,
      activeCarryRatioPct: Number(activeCarryRatioPct.toFixed(1)),
      finalNav: Number(nav.toFixed(4))
    }
  };
}
