/**
 * ALPHA FACTORY — AD015 DIVERSIFIED MULTI-CURRENCY BASKET CARRY ENGINE
 * File: ad015_basket_carry_engine.js
 * 
 * Deterministic simulation engine for multi-currency JPY carry basket:
 * - Pairs: USDJPY, GBPJPY, AUDJPY, CADJPY
 * - Weighting: Equal-Weight (25% each) vs Risk-Parity (inverse ATR volatility)
 * - Circuit Breakers: Unified Basket Index vs Independent Per-Pair
 * - Safe-Haven Refuge: US T-Bills at 5.00% p.a. during risk-off
 * - Dwell time hysteresis: 24 hours to contain turnover friction
 */

export function synchronizePanels(rawPanels) {
  const pairs = Object.keys(rawPanels);
  if (pairs.length === 0) return { timestamps: [], panel: {} };

  // Find common timestamps across all pairs
  const tsMaps = pairs.map(p => new Map(rawPanels[p].map(c => [c.timestamp, c])));
  const firstPairTs = rawPanels[pairs[0]].map(c => c.timestamp);

  const commonTs = [];
  for (const ts of firstPairTs) {
    let allHave = true;
    for (const m of tsMaps) {
      if (!m.has(ts)) {
        allHave = false;
        break;
      }
    }
    if (allHave) commonTs.push(ts);
  }

  commonTs.sort((a, b) => a - b);

  const synced = {};
  for (const p of pairs) {
    const m = tsMaps[pairs.indexOf(p)];
    synced[p] = commonTs.map(ts => m.get(ts));
  }

  return { timestamps: commonTs, panel: synced };
}

export function calculatePairIndicators(candles, emaLookback = 100) {
  const n = candles.length;
  if (n < emaLookback + 50) return [];

  // True Range
  const tr = new Array(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hpc = Math.abs(candles[i].high - candles[i - 1].close);
    const lpc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  // Wilder ATR(14)
  const atr = new Array(n).fill(0);
  let sumTR = 0;
  for (let i = 0; i < 14; i++) sumTR += tr[i];
  atr[13] = sumTR / 14;
  for (let i = 14; i < n; i++) {
    atr[i] = (atr[i - 1] * 13 + tr[i]) / 14;
  }

  // MA(ATR)(50)
  const maAtr = new Array(n).fill(0);
  for (let i = 13 + 49; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < 50; j++) sum += atr[i - j];
    maAtr[i] = sum / 50;
  }

  // EMA(emaLookback)
  const ema = new Array(n).fill(0);
  const k = 2 / (emaLookback + 1);
  let sumClose = 0;
  for (let i = 0; i < emaLookback; i++) sumClose += candles[i].close;
  ema[emaLookback - 1] = sumClose / emaLookback;
  for (let i = emaLookback; i < n; i++) {
    ema[i] = candles[i].close * k + ema[i - 1] * (1 - k);
  }

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

export function simulateBasketCarry(syncedData, cellConfig, pairsConfig, safeHavenTBillRate = 0.0500) {
  const { timestamps, panel } = syncedData;
  const pairKeys = Object.keys(panel);
  const n = timestamps.length;
  const emaLookback = cellConfig.emaLookback || 100;
  const volRatioThreshold = cellConfig.volRatioThreshold || 1.25;
  const dwellHours = cellConfig.dwellHours || 24;
  const dt = 1 / 8760;

  const warmupBars = Math.max(emaLookback, 64) + 1;
  if (n <= warmupBars) return { summary: null, equityCurve: [] };

  // Calculate indicators for each pair
  const pairInds = {};
  for (const p of pairKeys) {
    pairInds[p] = calculatePairIndicators(panel[p], emaLookback);
  }

  // Calculate Unified Basket Index & Indicators
  const basketIndex = new Array(n).fill(0);
  const basePrices = {};
  for (const p of pairKeys) basePrices[p] = panel[p][0].close;

  for (let i = 0; i < n; i++) {
    let sumNorm = 0;
    for (const p of pairKeys) {
      sumNorm += panel[p][i].close / basePrices[p];
    }
    basketIndex[i] = sumNorm / pairKeys.length;
  }

  // Basket Index EMA
  const basketEma = new Array(n).fill(0);
  const k = 2 / (emaLookback + 1);
  let sumIdx = 0;
  for (let i = 0; i < emaLookback; i++) sumIdx += basketIndex[i];
  basketEma[emaLookback - 1] = sumIdx / emaLookback;
  for (let i = emaLookback; i < n; i++) {
    basketEma[i] = basketIndex[i] * k + basketEma[i - 1] * (1 - k);
  }

  let nav = 1.0;
  let peakNav = 1.0;
  let maxDrawdown = 0;
  let prevWeights = {};
  for (const p of pairKeys) prevWeights[p] = 0;
  let prevCashWeight = 1.0;

  let stateBarsHeld = 24;
  let transitions = 0;
  let activeHours = 0;

  const equityCurve = [];
  const hourlyReturns = [];

  for (let i = warmupBars; i < n - 1; i++) {
    // 1. Calculate Target Weights at close(i)
    const curWeights = {};
    let cashWeight = 0;

    if (cellConfig.circuitBreaker === 'UNIFIED_BASKET') {
      // Basket level condition
      let avgVolRatio = 0;
      for (const p of pairKeys) avgVolRatio += pairInds[p][i].volRatio;
      avgVolRatio /= pairKeys.length;

      const basketTrendOk = basketIndex[i] > basketEma[i];
      const basketVolOk = avgVolRatio <= volRatioThreshold;
      const shouldBeInCarry = basketTrendOk && basketVolOk;

      // Emergency exit if basket drops > 1.5% below EMA
      const emergencyExit = (basketIndex[i] < basketEma[i] * 0.985) || (avgVolRatio > volRatioThreshold * 1.5);
      const isCurrentlyInCarry = prevCashWeight < 0.5;

      let targetState = shouldBeInCarry;
      if (isCurrentlyInCarry !== targetState) {
        if (stateBarsHeld >= dwellHours || emergencyExit) {
          isCurrentlyInCarry ? (targetState = false) : (targetState = true);
          transitions++;
          stateBarsHeld = 0;
        } else {
          targetState = isCurrentlyInCarry;
          stateBarsHeld++;
        }
      } else {
        stateBarsHeld++;
      }

      if (targetState) {
        activeHours++;
        if (cellConfig.weighting === 'RISK_PARITY') {
          let sumInvVol = 0;
          const invVols = {};
          for (const p of pairKeys) {
            const normVol = pairInds[p][i].atr / panel[p][i].close;
            invVols[p] = 1 / Math.max(normVol, 1e-6);
            sumInvVol += invVols[p];
          }
          for (const p of pairKeys) curWeights[p] = invVols[p] / sumInvVol;
        } else { // EQUAL_WEIGHT
          for (const p of pairKeys) curWeights[p] = 1.0 / pairKeys.length;
        }
        cashWeight = 0;
      } else {
        for (const p of pairKeys) curWeights[p] = 0;
        cashWeight = 1.0;
      }
    } else { // INDEPENDENT_PAIRS
      let totalCarryWeight = 0;
      const pairTargetStates = {};

      for (const p of pairKeys) {
        const ind = pairInds[p][i];
        const trendOk = ind.close > ind.ema;
        const volOk = ind.volRatio <= volRatioThreshold;
        pairTargetStates[p] = trendOk && volOk;
      }

      let activeCount = 0;
      for (const p of pairKeys) if (pairTargetStates[p]) activeCount++;

      if (activeCount > 0) activeHours++;

      if (cellConfig.weighting === 'RISK_PARITY') {
        let sumInvVol = 0;
        const invVols = {};
        for (const p of pairKeys) {
          const normVol = pairInds[p][i].atr / panel[p][i].close;
          invVols[p] = 1 / Math.max(normVol, 1e-6);
          sumInvVol += invVols[p];
        }
        for (const p of pairKeys) {
          const nominalW = invVols[p] / sumInvVol;
          if (pairTargetStates[p]) {
            curWeights[p] = nominalW;
            totalCarryWeight += nominalW;
          } else {
            curWeights[p] = 0;
          }
        }
      } else { // EQUAL_WEIGHT
        const nominalW = 1.0 / pairKeys.length;
        for (const p of pairKeys) {
          if (pairTargetStates[p]) {
            curWeights[p] = nominalW;
            totalCarryWeight += nominalW;
          } else {
            curWeights[p] = 0;
          }
        }
      }
      cashWeight = Math.max(0, 1.0 - totalCarryWeight);
    }

    // 2. Turnover Friction
    let turnoverSum = 0;
    for (const p of pairKeys) {
      turnoverSum += Math.abs(curWeights[p] - prevWeights[p]);
    }
    turnoverSum += Math.abs(cashWeight - prevCashWeight);
    const friction = (turnoverSum / 2) * (0.0003); // 3 bps per rebalanced leg

    // 3. Compute Gross Return for candle i+1
    let grossReturn = 0;
    for (const p of pairKeys) {
      const w = curWeights[p];
      if (w > 0) {
        const carryAccrual = pairsConfig[p].annualCarryRate * dt;
        const priceReturn = (panel[p][i + 1].close - panel[p][i].close) / panel[p][i].close;
        grossReturn += w * (carryAccrual + priceReturn);
      }
    }
    if (cashWeight > 0) {
      grossReturn += cashWeight * (safeHavenTBillRate * dt);
    }

    const netReturn = grossReturn - friction;
    hourlyReturns.push(netReturn);

    nav = nav * (1 + netReturn);
    if (nav > peakNav) peakNav = nav;
    const dd = (peakNav - nav) / peakNav;
    if (dd > maxDrawdown) maxDrawdown = dd;

    equityCurve.push({
      timestamp: timestamps[i + 1],
      nav,
      drawdown: dd,
      cashWeight
    });

    prevWeights = { ...curWeights };
    prevCashWeight = cashWeight;
  }

  // Summary Metrics
  const totalHours = hourlyReturns.length;
  const totalReturnPct = (nav - 1.0) * 100;
  const years = totalHours / 8760;
  const annualizedReturnPct = years > 0 ? (Math.pow(nav, 1 / years) - 1.0) * 100 : 0;
  const maxDrawdownPct = maxDrawdown * 100;

  let sumRet = 0;
  for (const r of hourlyReturns) sumRet += r;
  const meanHourly = totalHours > 0 ? sumRet / totalHours : 0;

  let varSum = 0;
  for (const r of hourlyReturns) {
    const diff = r - meanHourly;
    varSum += diff * diff;
  }
  const stdHourly = totalHours > 1 ? Math.sqrt(varSum / (totalHours - 1)) : 1e-9;
  const sharpeRatio = stdHourly > 0 ? (meanHourly * 8760) / (stdHourly * Math.sqrt(8760)) : 0;

  const activeRatioPct = totalHours > 0 ? (activeHours / totalHours) * 100 : 0;

  return {
    equityCurve,
    hourlyReturns,
    summary: {
      id: cellConfig.id,
      weighting: cellConfig.weighting,
      circuitBreaker: cellConfig.circuitBreaker,
      totalHours,
      totalReturnPct: Number(totalReturnPct.toFixed(2)),
      annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      activeRatioPct: Number(activeRatioPct.toFixed(1)),
      finalNav: Number(nav.toFixed(4))
    }
  };
}
