/**
 * LYZER LABS — H019 CONFIRMATORY ENGINE
 * Module: h019_confirmatory_engine.js
 * 
 * Formal Confirmatory Implementation of the Diversified Multi-Currency Carry Basket Engine
 * (Forex Passive Income under Unified Circuit Breaker & T-Bills Refuge).
 * 
 * Invariants:
 * - Deterministic causal execution (zero lookahead).
 * - Multi-asset synchronized hourly candles.
 * - Unified Basket Index with EMA200 & Wilder ATR(14) Volatility Expansion filter.
 * - Emergency regime exit (< 1.5% below EMA or Vol > 1.5x threshold).
 * - 24-hour dwell time anti-whipsaw hysteresis.
 * - Continuous T-Bills accrual (5.00% p.a.) during defensive phases.
 * - 3.0 bps turnover friction per rebalanced leg.
 */

export class H019ConfirmatoryEngine {
  /**
   * Synchronize timestamps across all basket pairs.
   * Only timestamps common to all 4 assets are retained.
   */
  static synchronizePanels(rawPanels) {
    const pairs = Object.keys(rawPanels);
    if (pairs.length === 0) return { timestamps: [], panel: {} };

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

  /**
   * Calculate causal Wilder ATR(14), Baseline MA(ATR, 50), and EMA(lookback).
   */
  static calculatePairIndicators(candles, emaLookback = 200) {
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

    // Baseline MA(ATR)(50)
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

  /**
   * Simulate the Frozen Multi-Currency Carry Basket Strategy on Synchronized Candles.
   */
  static simulate(syncedData, spec) {
    const { timestamps, panel } = syncedData;
    const pairKeys = Object.keys(panel);
    const n = timestamps.length;

    const params = spec.parameters || {};
    const emaLookback = params.emaLookback || 200;
    const volRatioThreshold = params.volRatioThreshold || 1.35;
    const dwellHours = params.dwellHours || 24;
    const pairsConfig = spec.pairs;
    const safeHavenTBillRate = spec.safeHavenTBillRate || 0.0500;
    const frictionRate = (spec.friction && spec.friction.turnoverFrictionBpsPerLeg ? spec.friction.turnoverFrictionBpsPerLeg : 3.0) / 10000;
    const dt = 1 / 8760;

    const warmupBars = Math.max(emaLookback, 64) + 1;
    if (n <= warmupBars) {
      throw new Error(`[ENGINE_ERROR] Sample size (${n} bars) insufficient for warmup (${warmupBars} bars).`);
    }

    // Step 1: Precompute per-pair indicators
    const pairInds = {};
    for (const p of pairKeys) {
      pairInds[p] = this.calculatePairIndicators(panel[p], emaLookback);
    }

    // Step 2: Compute Unified Synthetic Basket Index
    const basePrices = {};
    for (const p of pairKeys) basePrices[p] = panel[p][0].close;

    const basketIndex = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sumNorm = 0;
      for (const p of pairKeys) {
        sumNorm += panel[p][i].close / basePrices[p];
      }
      basketIndex[i] = sumNorm / pairKeys.length;
    }

    // Step 3: Compute Basket Index EMA
    const basketEma = new Array(n).fill(0);
    const k = 2 / (emaLookback + 1);
    let sumIdx = 0;
    for (let i = 0; i < emaLookback; i++) sumIdx += basketIndex[i];
    basketEma[emaLookback - 1] = sumIdx / emaLookback;
    for (let i = emaLookback; i < n; i++) {
      basketEma[i] = basketIndex[i] * k + basketEma[i - 1] * (1 - k);
    }

    // Simulation state variables
    let nav = 1.0;
    let peakNav = 1.0;
    let maxDrawdown = 0;
    let prevWeights = {};
    for (const p of pairKeys) prevWeights[p] = 0;
    let prevCashWeight = 1.0;

    let stateBarsHeld = dwellHours;
    let transitions = 0;
    let activeHours = 0;
    let defensiveHours = 0;
    let totalTurnoverFriction = 0;

    const equityCurve = [];
    const hourlyReturns = [];

    // Step 4: Step-by-Step Simulation Loop
    for (let i = warmupBars; i < n - 1; i++) {
      const curWeights = {};
      let cashWeight = 0;

      // Average volatility ratio across basket
      let avgVolRatio = 0;
      for (const p of pairKeys) avgVolRatio += pairInds[p][i].volRatio;
      avgVolRatio /= pairKeys.length;

      const basketTrendOk = basketIndex[i] > basketEma[i];
      const basketVolOk = avgVolRatio <= volRatioThreshold;
      const shouldBeInCarry = basketTrendOk && basketVolOk;

      // Emergency exit if basket falls > 1.5% below EMA or Vol explodes > 1.5x threshold
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
        // Equal-Weight Allocation across all 4 basket pairs (25% each)
        for (const p of pairKeys) curWeights[p] = 1.0 / pairKeys.length;
        cashWeight = 0;
      } else {
        defensiveHours++;
        for (const p of pairKeys) curWeights[p] = 0;
        cashWeight = 1.0;
      }

      // Turnover friction on state transitions
      let turnoverSum = 0;
      for (const p of pairKeys) {
        turnoverSum += Math.abs(curWeights[p] - prevWeights[p]);
      }
      turnoverSum += Math.abs(cashWeight - prevCashWeight);
      const friction = (turnoverSum / 2) * frictionRate;
      totalTurnoverFriction += friction;

      // Compute Gross Return for period i+1
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
        cashWeight,
        inCarry: targetState
      });

      prevWeights = { ...curWeights };
      prevCashWeight = cashWeight;
    }

    // Step 5: Metric Aggregations
    const totalHours = hourlyReturns.length;
    const totalDays = totalHours / 24;
    const totalNetReturnPct = (nav - 1.0) * 100;
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
    const annualizedSharpe = stdHourly > 0 ? (meanHourly * 8760) / (stdHourly * Math.sqrt(8760)) : 0;

    // Aggregate into 14-day calendar blocks (336 hours each) for block bootstrap
    const blockSize = 336;
    const blockReturns = [];
    for (let b = 0; b < hourlyReturns.length; b += blockSize) {
      const chunk = hourlyReturns.slice(b, b + blockSize);
      if (chunk.length >= blockSize * 0.5) {
        let bNav = 1.0;
        for (const r of chunk) bNav *= (1 + r);
        const bPct = (bNav - 1.0) * 100;
        blockReturns.push({
          netR: bPct,
          timestamp: equityCurve[Math.min(b + blockSize - 1, equityCurve.length - 1)].timestamp
        });
      }
    }

    return {
      equityCurve,
      hourlyReturns,
      blockReturns,
      summary: {
        hypothesisId: 'H019',
        totalHours,
        totalDays: Number(totalDays.toFixed(1)),
        yearsEvaluated: Number(years.toFixed(2)),
        totalNetReturnPct: Number(totalNetReturnPct.toFixed(2)),
        annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
        maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
        annualizedSharpe: Number(annualizedSharpe.toFixed(2)),
        activeHoursRatioPct: Number(((activeHours / totalHours) * 100).toFixed(1)),
        tBillsHoursRatioPct: Number(((defensiveHours / totalHours) * 100).toFixed(1)),
        turnoverTransitions: transitions,
        totalTurnoverFrictionPct: Number((totalTurnoverFriction * 100).toFixed(3)),
        finalNav: Number(nav.toFixed(4))
      }
    };
  }
}
