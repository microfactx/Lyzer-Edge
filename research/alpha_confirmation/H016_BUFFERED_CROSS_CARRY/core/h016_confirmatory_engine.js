/**
 * LYZER LABS — H016 CONFIRMATORY EVALUATION ENGINE
 * Module: h016_confirmatory_engine.js
 * 
 * Implements the frozen specification of H016:
 * - Cross-Asset Friction-Buffered Basis Carry (Top-2 Altcoins/Core Cryptos)
 * - 30-Day Causal Moving Average Lookback
 * - Monthly Discrete Rebalancing Schedule (30 Days)
 * - 2.0% Inertia Rotation Buffer
 * - Dynamic Spread-Sensitive Leverage (1.0x to 2.0x)
 * - Causal Warmup Baseline (Dec 2024) with Virgin Evaluation (2025-01-01 to 2026-08-31)
 */

export class H016ConfirmatoryEngine {
  /**
   * Simulate H016 on holdout dataset.
   * @param {Object} panel - Map of sym -> array of 8H records { fundingTime, fundingRate }
   * @param {Array<string>} targetAssets - Array of asset symbols
   * @param {Object} spec - Frozen specification from H016_FROZEN_SPEC.json
   * @param {number} startEvalIndex - Index where virgin holdout begins (e.g. 93 for 2025-01-01)
   * @returns {Object} Confirmatory results and metrics
   */
  static simulate(panel, targetAssets, spec, startEvalIndex = 93) {
    const sym0 = targetAssets[0];
    const totalPeriods = panel[sym0].length;
    const params = spec.parameters;
    const friction = spec.friction;
    
    const topK = params.topK || 2;
    const lookbackPeriods = (params.lookbackDays || 30) * 3; // 90 periods
    const rebalPeriods = (params.rebalanceDays || 30) * 3;   // 90 periods
    const bufferPct = params.bufferPct !== undefined ? params.bufferPct : 2.0;
    const hurdlePct = params.hurdlePct !== undefined ? params.hurdlePct : 3.0;
    const maxLev = params.maxLeverage || 2.0;
    const annualBorrowRate = params.borrowing.annualBorrowRatePct !== undefined ? params.borrowing.annualBorrowRatePct : 4.0;
    const annualCashRate = params.cashRate.annualCashRatePct !== undefined ? params.cashRate.annualCashRatePct : 0.0;
    const cashRatePerPeriod = (annualCashRate / 100) / (365 * 3);
    const roundtripBps = friction.totalRoundtripBpsPerCycle !== undefined ? friction.totalRoundtripBpsPerCycle : 24;
    const baseFeePerUnit = roundtripBps / 10000;

    // Precompute annualized funding rates per asset
    const annFunding = {};
    for (const sym of targetAssets) {
      annFunding[sym] = new Float64Array(totalPeriods);
      for (let t = 0; t < totalPeriods; t++) {
        annFunding[sym][t] = panel[sym][t].fundingRate * (365 * 3) * 100;
      }
    }

    let equity = 1.0;
    const equityCurve = [equity];
    const periodReturns = [];
    let maxEquity = 1.0;
    let maxDrawdownPct = 0.0;

    let activePeriodsCount = 0;
    let turnoverEventsCount = 0;
    let totalTurnoverVolume = 0;
    let totalFeePaid = 0;

    // Current portfolio positions: Map of sym -> { leverage: number, rate: number }
    let currentPortfolio = new Map();

    for (let t = 0; t < totalPeriods; t++) {
      // Warmup check: do not trade prior to startEvalIndex
      if (t < startEvalIndex) {
        continue;
      }

      // Rebalance check strictly within holdout
      const periodsIntoEval = t - startEvalIndex;
      const isRebalanceTrigger = (periodsIntoEval === 0 || (periodsIntoEval > 0 && periodsIntoEval % rebalPeriods === 0));

      if (isRebalanceTrigger) {
        // 1. Calculate trailing average funding for all assets over [t - lookbackPeriods, t]
        const scores = [];
        for (const sym of targetAssets) {
          let sum = 0;
          for (let k = t - lookbackPeriods; k < t; k++) {
            sum += annFunding[sym][k];
          }
          const trailingRate = sum / lookbackPeriods;
          scores.push({ sym, rate: trailingRate });
        }
        scores.sort((a, b) => b.rate - a.rate);

        // 2. Select positions applying Buffer and Hurdle
        const newPortfolio = new Map();

        if (currentPortfolio.size === 0) {
          // Initial allocation at day 0 of holdout
          const eligible = scores.filter(s => s.rate >= hurdlePct).slice(0, topK);
          for (const item of eligible) {
            const lev = H016ConfirmatoryEngine.calculateLeverage(item.rate, annualBorrowRate, maxLev, params.leverageMode);
            newPortfolio.set(item.sym, { leverage: lev, rate: item.rate });
          }
        } else {
          // Inertia-buffered rebalance
          const keptSymbols = new Set();
          for (const [heldSym, pos] of currentPortfolio.entries()) {
            const currentScore = scores.find(s => s.sym === heldSym);
            const currentRate = currentScore ? currentScore.rate : -999;

            if (currentRate >= hurdlePct) {
              const topChallenger = scores.find(s => !currentPortfolio.has(s.sym) && !keptSymbols.has(s.sym));
              if (topChallenger && topChallenger.rate > currentRate + bufferPct) {
                // Challenger decisively beats incumbent + buffer
              } else {
                keptSymbols.add(heldSym);
                const lev = H016ConfirmatoryEngine.calculateLeverage(currentRate, annualBorrowRate, maxLev, params.leverageMode);
                newPortfolio.set(heldSym, { leverage: lev, rate: currentRate });
              }
            }
          }

          // Fill open slots with best eligible candidates
          for (const cand of scores) {
            if (newPortfolio.size >= topK) break;
            if (cand.rate >= hurdlePct && !newPortfolio.has(cand.sym)) {
              const lev = H016ConfirmatoryEngine.calculateLeverage(cand.rate, annualBorrowRate, maxLev, params.leverageMode);
              newPortfolio.set(cand.sym, { leverage: lev, rate: cand.rate });
            }
          }
        }

        // 3. Compute turnover friction costs
        // Check exits / deleveraging
        for (const [oldSym, oldPos] of currentPortfolio.entries()) {
          const nextPos = newPortfolio.get(oldSym);
          if (!nextPos) {
            const fee = (baseFeePerUnit / 2) * (oldPos.leverage / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            turnoverEventsCount++;
            totalTurnoverVolume += (1.0 / topK);
          } else if (oldPos.leverage > nextPos.leverage) {
            const dLev = oldPos.leverage - nextPos.leverage;
            const fee = (baseFeePerUnit / 2) * (dLev / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            totalTurnoverVolume += (dLev / (topK * maxLev));
          }
        }
        // Check entries / leveraging
        for (const [newSym, nextPos] of newPortfolio.entries()) {
          const oldPos = currentPortfolio.get(newSym);
          if (!oldPos) {
            const fee = (baseFeePerUnit / 2) * (nextPos.leverage / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            turnoverEventsCount++;
            totalTurnoverVolume += (1.0 / topK);
          } else if (nextPos.leverage > oldPos.leverage) {
            const dLev = nextPos.leverage - oldPos.leverage;
            const fee = (baseFeePerUnit / 2) * (dLev / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            totalTurnoverVolume += (dLev / (topK * maxLev));
          }
        }

        currentPortfolio = newPortfolio;
      }

      // 4. Compute 8H step return
      let periodRet = 0;
      if (currentPortfolio.size > 0) {
        activePeriodsCount++;
        let sumContribution = 0;
        for (const [sym, pos] of currentPortfolio.entries()) {
          const fund8h = panel[sym][t].fundingRate;
          const lev = pos.leverage;
          const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
          const legRet = (fund8h * lev - borrowRatePerPeriod) / topK;
          sumContribution += legRet;
        }
        const unallocatedWeight = (topK - currentPortfolio.size) / topK;
        sumContribution += unallocatedWeight * cashRatePerPeriod;
        periodRet = sumContribution;
      } else {
        periodRet = cashRatePerPeriod;
      }

      equity *= (1 + periodRet);
      periodReturns.push(periodRet);

      if (equity > maxEquity) maxEquity = equity;
      const dd = (maxEquity - equity) / maxEquity;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      equityCurve.push(equity);
    }

    const evalPeriodsCount = totalPeriods - startEvalIndex;

    // Aggregate 14-day calendar blocks for bootstrap
    const blockReturns = [];
    const periodsPerBlock = 42; // 14 days * 3
    for (let i = 0; i < evalPeriodsCount; i += periodsPerBlock) {
      const end = Math.min(evalPeriodsCount, i + periodsPerBlock);
      let blkRet = 1.0;
      for (let j = i; j < end; j++) {
        blkRet *= (1 + periodReturns[j]);
      }
      blockReturns.push(blkRet - 1.0);
    }

    const annReturnPct = (Math.pow(equity, (365 * 3) / evalPeriodsCount) - 1) * 100;
    const totalNetReturnPct = (equity - 1.0) * 100;

    const meanR = periodReturns.reduce((s, x) => s + x, 0) / periodReturns.length;
    const varR = periodReturns.reduce((s, x) => s + Math.pow(x - meanR, 2), 0) / periodReturns.length;
    const sharpeRatio = Math.sqrt(varR) > 0 ? (meanR / Math.sqrt(varR)) * Math.sqrt(365 * 3) : 0;
    const percentActive = (activePeriodsCount / evalPeriodsCount) * 100;

    return {
      hypothesisId: spec.hypothesisId,
      evalPeriodsCount,
      equity,
      annReturnPct,
      totalNetReturnPct,
      sharpeRatio,
      maxDrawdownPct: maxDrawdownPct * 100,
      percentActive,
      turnoverEventsCount,
      totalTurnoverVolume,
      turnoverFeePct: totalFeePaid * 100,
      blockReturns,
      equityCurve
    };
  }

  static calculateLeverage(rateAnnPct, annualBorrowRatePct, maxLeverage, leverageMode) {
    if (leverageMode !== 'DYNAMIC_SPREAD') {
      return typeof leverageMode === 'number' ? leverageMode : maxLeverage;
    }
    if (rateAnnPct >= annualBorrowRatePct + 4.0) {
      return maxLeverage; // 2.0x
    } else if (rateAnnPct >= annualBorrowRatePct + 1.0) {
      return (1.0 + maxLeverage) / 2.0; // 1.5x
    } else {
      return 1.0; // 1.0x unleveraged (zero borrow cost!)
    }
  }
}
