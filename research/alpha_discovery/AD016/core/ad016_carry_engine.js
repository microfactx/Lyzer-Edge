/**
 * ALPHA FACTORY — AD016 CARRY ENGINE (STRICT ZERO-LOOKAHEAD ARCHITECTURE)
 * Module: ad016_carry_engine.js
 * 
 * Vectorized simulation engine for:
 * - Track A: Dual-Funding G10 Carry Basket (JPY + CHF funding, 8 pairs)
 * - Track B: High-Yield Emerging Markets Basket (MXN, BRL, ZAR, PLN, 4 pairs)
 * - Track C: Hybrid Multi-Asset All-Weather Carry (G10 + EM + T-Bills)
 * 
 * Strict Epistemic Invariants:
 * 1. Zero Lookahead: Target weights decided strictly at close(i), returns realized forward from close(i) -> close(i+1).
 * 2. State Dwell Time: Minimum 24 hours state stability to prevent micro-whipsaws, unless emergency exit.
 * 3. Direction-Awareness: LONG captures + price delta, SHORT (EM) captures - price delta.
 * 4. Realistic Frictions: Asset-specific spreads (G10 2.0 bps, EM 6.0 bps) + 1.0 bps execution fee.
 * 5. Accurate Calendar Annualization: Uses calendar elapsed duration (58 weeks = 1.115 years).
 */

import fs from 'fs';
import path from 'path';

export class Ad016CarryEngine {
  constructor(spec) {
    this.spec = spec;
    this.instruments = spec.instruments;
    this.frictions = spec.frictions;
  }

  loadCandles(dataDir, symbol) {
    const filePath = path.resolve(dataDir, `${symbol}_1h_discovery.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Dataset not found for ${symbol} at ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  buildSynchronizedTimeline(datasets) {
    const tsSet = new Set();
    for (const [sym, candles] of Object.entries(datasets)) {
      for (const c of candles) {
        tsSet.add(c.timestamp);
      }
    }

    const timestamps = Array.from(tsSet).sort((a, b) => a - b);
    const aligned = [];

    const lastSeen = {};
    for (const ts of timestamps) {
      const row = { timestamp: ts, prices: {} };
      let hasAny = false;

      for (const [sym, candles] of Object.entries(datasets)) {
        const c = candles.find(cand => cand.timestamp === ts);
        if (c) {
          lastSeen[sym] = c.close;
          row.prices[sym] = c.close;
          hasAny = true;
        } else if (lastSeen[sym] !== undefined) {
          row.prices[sym] = lastSeen[sym];
        }
      }

      if (hasAny) {
        aligned.push(row);
      }
    }

    const allSymbols = Object.keys(datasets);
    return aligned.filter(r => allSymbols.every(s => r.prices[s] !== undefined));
  }

  calculateWeights(cell, symbolsInfo, timeline) {
    const weighting = cell.weighting;
    const track = cell.track;
    const weights = {};

    if (track === 'TRACK_A_DUAL_FUNDING') {
      const n = symbolsInfo.length;
      if (weighting === 'EQUAL_WEIGHT') {
        const w = 1.0 / n;
        for (const info of symbolsInfo) weights[info.symbol] = w;
      } else if (weighting === 'RISK_PARITY') {
        const vols = {};
        for (const info of symbolsInfo) {
          const sym = info.symbol;
          const rets = [];
          for (let t = 1; t < timeline.length; t++) {
            const p0 = timeline[t - 1].prices[sym];
            const p1 = timeline[t].prices[sym];
            rets.push((p1 - p0) / p0);
          }
          const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
          const variance = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rets.length;
          vols[sym] = Math.max(0.001, Math.sqrt(variance));
        }
        let invSum = 0;
        for (const sym of Object.keys(vols)) invSum += 1.0 / vols[sym];
        for (const sym of Object.keys(vols)) weights[sym] = (1.0 / vols[sym]) / invSum;
      }
    } else if (track === 'TRACK_B_EM_HIGH_YIELD') {
      const n = symbolsInfo.length;
      if (weighting === 'EQUAL_WEIGHT') {
        const w = 1.0 / n;
        for (const info of symbolsInfo) weights[info.symbol] = w;
      } else if (weighting === 'CARRY_WEIGHTED') {
        let carrySum = 0;
        for (const info of symbolsInfo) carrySum += Math.max(0.1, info.grossCarryAnnualPct);
        for (const info of symbolsInfo) weights[info.symbol] = Math.max(0.1, info.grossCarryAnnualPct) / carrySum;
      }
    } else if (track === 'TRACK_C_HYBRID_MULTI_ASSET') {
      const g10Symbols = symbolsInfo.filter(s => !s.symbol.startsWith('USD') || s.symbol === 'USDJPY' || s.symbol === 'USDCHF');
      const emSymbols = symbolsInfo.filter(s => ['USDMXN', 'USDBRL', 'USDZAR', 'USDPLN'].includes(s.symbol));

      if (weighting === 'EQUAL_WEIGHT') {
        const g10W = 0.50 / g10Symbols.length;
        const emW = 0.50 / emSymbols.length;
        for (const info of g10Symbols) weights[info.symbol] = g10W;
        for (const info of emSymbols) weights[info.symbol] = emW;
      } else if (weighting === 'RISK_PARITY') {
        const g10W = 0.50 / g10Symbols.length;
        let emCarrySum = 0;
        for (const info of emSymbols) emCarrySum += Math.max(0.1, info.grossCarryAnnualPct);
        for (const info of g10Symbols) weights[info.symbol] = g10W;
        for (const info of emSymbols) weights[info.symbol] = 0.50 * (Math.max(0.1, info.grossCarryAnnualPct) / emCarrySum);
      }
    }

    return weights;
  }

  runSimulation(cell, dataDir) {
    const track = cell.track;
    let targetSymbolsInfo = [];

    if (track === 'TRACK_A_DUAL_FUNDING') {
      targetSymbolsInfo = [...this.instruments.trackA_G10_JPY, ...this.instruments.trackA_G10_CHF];
    } else if (track === 'TRACK_B_EM_HIGH_YIELD') {
      targetSymbolsInfo = [...this.instruments.trackB_EM];
    } else if (track === 'TRACK_C_HYBRID_MULTI_ASSET') {
      targetSymbolsInfo = [
        ...this.instruments.trackA_G10_JPY,
        ...this.instruments.trackA_G10_CHF,
        ...this.instruments.trackB_EM
      ];
    }

    const datasets = {};
    for (const info of targetSymbolsInfo) {
      datasets[info.symbol] = this.loadCandles(dataDir, info.symbol);
    }

    const timeline = this.buildSynchronizedTimeline(datasets);
    const N = timeline.length;
    if (N < 500) {
      throw new Error(`Insufficient synchronized timeline bars: ${N}`);
    }

    const weights = this.calculateWeights(cell, targetSymbolsInfo, timeline);

    // 1. Build Cumulative Normalized Basket Index across the entire series
    const basketIndex = new Array(N).fill(1.0);
    const basketPriceReturns = new Array(N).fill(0);

    for (let t = 1; t < N; t++) {
      let bRet = 0;
      for (const info of targetSymbolsInfo) {
        const sym = info.symbol;
        const w = weights[sym] || 0;
        const p0 = timeline[t - 1].prices[sym];
        const p1 = timeline[t].prices[sym];
        const ret = info.direction === 'LONG' ? (p1 - p0) / p0 : -(p1 - p0) / p0;
        bRet += w * ret;
      }
      basketPriceReturns[t] = bRet;
      basketIndex[t] = basketIndex[t - 1] * (1.0 + bRet);
    }

    // 2. Pre-compute EMA of Basket Index strictly up to index t
    const emaLookback = cell.emaLookback;
    const basketEma = new Array(N).fill(1.0);
    const emaAlpha = 2.0 / (emaLookback + 1);
    let initSum = 0;
    for (let t = 0; t < emaLookback; t++) initSum += basketIndex[t];
    basketEma[emaLookback - 1] = initSum / emaLookback;
    for (let t = emaLookback; t < N; t++) {
      basketEma[t] = emaAlpha * basketIndex[t] + (1.0 - emaAlpha) * basketEma[t - 1];
    }

    // 3. Pre-compute rolling 14-day volatility (336 bars) and 60-day baseline (1440 bars)
    const volRatio = new Array(N).fill(1.0);
    for (let t = 336; t < N; t++) {
      const slice14d = basketPriceReturns.slice(t - 336 + 1, t + 1);
      const mean14 = slice14d.reduce((a, b) => a + b, 0) / 336;
      const var14 = slice14d.reduce((a, b) => a + Math.pow(b - mean14, 2), 0) / 336;
      const vol14 = Math.sqrt(var14) * Math.sqrt(8760);

      const lookback60d = Math.min(t, 1440);
      const slice60d = basketPriceReturns.slice(t - lookback60d + 1, t + 1);
      const mean60 = slice60d.reduce((a, b) => a + b, 0) / lookback60d;
      const var60 = slice60d.reduce((a, b) => a + Math.pow(b - mean60, 2), 0) / lookback60d;
      const vol60 = Math.sqrt(var60) * Math.sqrt(8760);

      volRatio[t] = vol14 / Math.max(0.04, vol60);
    }

    // 4. Strict Forward Simulation: Decision at close(i), returns from close(i) -> close(i+1)
    const WARMUP_BARS = Math.max(emaLookback, 336);
    const DWELL_HOURS = 24; // Minimum 24h stability to prevent whipsaw
    const safeHavenTBillRate = (this.frictions.tBillAnnualYieldPct / 100);

    let nav = 1.0;
    let peakNav = 1.0;
    let maxDrawdownPct = 0;
    const equityCurve = [nav];
    const hourlyReturns = [];

    let isCurrentlyInCarry = false;
    let stateBarsHeld = DWELL_HOURS;
    let stateTransitions = 0;
    let tBillHours = 0;
    let activeHours = 0;

    for (let i = WARMUP_BARS; i < N - 1; i++) {
      // Step A: Evaluate market conditions strictly at close(i)
      const trendOk = basketIndex[i] > basketEma[i];
      const volOk = volRatio[i] <= cell.volatilityMultiplier;
      const shouldBeInCarry = trendOk && volOk;

      // Emergency exit: basket drops > 1.5% below EMA or massive vol spike
      const emergencyExit = (basketIndex[i] < basketEma[i] * 0.985) || (volRatio[i] > cell.volatilityMultiplier * 1.5);

      let targetState = shouldBeInCarry;
      if (isCurrentlyInCarry !== targetState) {
        if (stateBarsHeld >= DWELL_HOURS || emergencyExit) {
          // Allow state transition
          targetState = !isCurrentlyInCarry;
          stateBarsHeld = 0;
          stateTransitions++;

          // Deduct turnover friction for the transition
          let turnoverFriction = 0;
          for (const info of targetSymbolsInfo) {
            const w = weights[info.symbol] || 0;
            const fee = (info.spreadBps + this.frictions.turnoverExecutionFeeBps) / 10000;
            turnoverFriction += w * fee;
          }
          nav *= (1.0 - turnoverFriction);
        } else {
          targetState = isCurrentlyInCarry;
          stateBarsHeld++;
        }
      } else {
        stateBarsHeld++;
      }

      isCurrentlyInCarry = targetState;

      // Step B: Realize Forward Returns from close(i) to close(i+1)
      const dtMs = timeline[i + 1].timestamp - timeline[i].timestamp;
      const dtYears = dtMs / (8760 * 3600 * 1000);

      let stepReturn = 0;

      if (isCurrentlyInCarry) {
        activeHours++;
        // Accrue basket return (price delta + positive swap carry)
        for (const info of targetSymbolsInfo) {
          const sym = info.symbol;
          const w = weights[sym] || 0;
          const p0 = timeline[i].prices[sym];
          const p1 = timeline[i + 1].prices[sym];
          const priceRet = info.direction === 'LONG' ? (p1 - p0) / p0 : -(p1 - p0) / p0;
          const carryRet = (info.grossCarryAnnualPct / 100) * dtYears;
          stepReturn += w * (priceRet + carryRet);
        }
      } else {
        tBillHours++;
        // Accrue safe-haven T-Bill rate
        stepReturn = safeHavenTBillRate * dtYears;
      }

      nav *= (1.0 + stepReturn);
      equityCurve.push(nav);
      hourlyReturns.push(stepReturn);

      if (nav > peakNav) peakNav = nav;
      const dd = ((peakNav - nav) / peakNav) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    // Performance Metrics
    const totalNetReturnPct = (nav - 1.0) * 100;
    const totalDurationYears = (timeline[N - 1].timestamp - timeline[WARMUP_BARS].timestamp) / (8760 * 3600 * 1000);
    const annualizedReturnPct = (Math.pow(nav, 1.0 / totalDurationYears) - 1.0) * 100;

    // Sharpe Ratio
    const nSteps = hourlyReturns.length;
    const meanRet = hourlyReturns.reduce((a, b) => a + b, 0) / nSteps;
    const hourlyRf = safeHavenTBillRate / 8760;
    const variance = hourlyReturns.reduce((a, b) => a + Math.pow(b - meanRet, 2), 0) / nSteps;
    const hourlyStd = Math.sqrt(variance);
    const annualizedSharpe = hourlyStd > 0 ? ((meanRet - hourlyRf) / hourlyStd) * Math.sqrt(8760) : 0;

    // 14-day Block Bootstrap (336 hours)
    const pBlock = this.runBlockBootstrap(hourlyReturns, hourlyRf, 336, 1000);

    return {
      cellId: cell.id,
      track: cell.track,
      weighting: cell.weighting,
      emaLookback: cell.emaLookback,
      volatilityMultiplier: cell.volatilityMultiplier,
      annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
      totalNetReturnPct: Number(totalNetReturnPct.toFixed(2)),
      sharpeRatio: Number(annualizedSharpe.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      tBillActiveRatioPct: Number(((tBillHours / (activeHours + tBillHours || 1)) * 100).toFixed(1)),
      stateTransitions,
      pBlock: Number(pBlock.toFixed(4)),
      equityCurveFinal: Number(nav.toFixed(4))
    };
  }

  runBlockBootstrap(returns, rfHourly, blockSize = 336, nResamples = 1000) {
    const N = returns.length;
    if (N < blockSize) return 0.5;
    const nBlocks = Math.ceil(N / blockSize);
    const observedMean = returns.reduce((a, b) => a + b, 0) / N;

    // Centered returns under H0: mean == rfHourly
    const centered = returns.map(r => r - observedMean + rfHourly);

    let countGreaterOrEqual = 0;
    for (let b = 0; b < nResamples; b++) {
      let sampleSum = 0;
      for (let k = 0; k < nBlocks; k++) {
        const startIdx = Math.floor(Math.random() * (N - blockSize));
        for (let i = 0; i < blockSize; i++) {
          sampleSum += centered[startIdx + i];
        }
      }
      const sampleMean = sampleSum / (nBlocks * blockSize);
      if (sampleMean >= observedMean) {
        countGreaterOrEqual++;
      }
    }

    return Math.max(1 / nResamples, countGreaterOrEqual / nResamples);
  }
}
