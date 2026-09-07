/**
 * LYZER LABS — H017 CONFIRMATORY ENGINE
 * Module: h017_confirmatory_engine.js
 * 
 * Implements:
 * 1. Productive Collateral Basis Carry across Top-2 Core Cryptos.
 * 2. Causal trailing moving average gross yield (Funding + Spot Staking).
 * 3. Exact modeling of spot liquid staking yield (ETH: 3.5%, SOL: 6.0%, AVAX: 5.0%).
 * 4. Institutional cash yield (4.0% p.a.) on unallocated margin.
 * 5. Friction-buffered inertia schedule (2.0% buffer on 30d rebalance).
 * 6. 2.0x leverage with continuous 4.0% p.a. borrowing cost on active margin (L - 1.0).
 * 7. Strict execution warmup separation (warmup used strictly for lookback causality).
 * 8. 14-day Calendar Block Returns for Hall-centered bootstrap inference.
 */

export class H017ConfirmatoryEngine {
  /**
   * Run confirmatory simulation on holdout panel.
   * @param {Object} panel - Map of sym -> array of 8H records { fundingTime, fundingRate }
   * @param {Array<string>} targetAssets - Array of asset symbols
   * @param {Object} spec - H017 frozen specification
   * @param {number} startEvalIndex - First period of virgin holdout (prior periods are warmup)
   * @returns {Object} Confirmatory simulation results and block returns
   */
  static simulate(panel, targetAssets, spec, startEvalIndex = 0) {
    const sym0 = targetAssets[0];
    const totalPeriods = panel[sym0].length;
    const params = spec.parameters;
    const staking = spec.stakingYields || {};

    const topK = params.topK || 2;
    const lookbackPeriods = (params.lookbackDays || 30) * 3;
    const rebalPeriods = Math.round((params.rebalanceDays || 30) * 3);
    const bufferPct = params.bufferPct !== undefined ? params.bufferPct : 2.0;
    const hurdlePct = params.hurdlePct !== undefined ? params.hurdlePct : 3.0;
    const lev = params.leverage || 2.0;

    const annualBorrowRate = params.borrowing?.annualBorrowRatePct !== undefined ? params.borrowing.annualBorrowRatePct : 4.0;
    const annualCashRate = params.cashRate?.annualCashRatePct !== undefined ? params.cashRate.annualCashRatePct : 4.0;
    const cashRatePerPeriod = (annualCashRate / 100) / (365 * 3);

    const roundtripBps = spec.friction?.totalRoundtripBpsPerCycle !== undefined ? spec.friction.totalRoundtripBpsPerCycle : 24;
    const baseFeePerUnit = roundtripBps / 10000;

    // Precompute annualized funding rates and spot staking yields
    const annFunding = {};
    const assetStakingYields = {};
    for (const sym of targetAssets) {
      annFunding[sym] = new Float64Array(totalPeriods);
      const isStakingActive = params.enableStaking !== false;
      const sYield = isStakingActive && staking[sym] ? staking[sym] : 0.0;
      assetStakingYields[sym] = sYield;

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
      // Warmup check: do not trade or accumulate returns prior to startEvalIndex
      if (t < startEvalIndex) {
        continue;
      }

      // Rebalance check strictly within holdout
      const periodsIntoEval = t - startEvalIndex;
      const isRebalanceTrigger = (periodsIntoEval === 0 || (periodsIntoEval > 0 && periodsIntoEval % rebalPeriods === 0));

      if (isRebalanceTrigger) {
        // 1. Calculate trailing average gross yield (funding + staking) over causal lookback
        const scores = [];
        for (const sym of targetAssets) {
          let sum = 0;
          for (let k = t - lookbackPeriods; k < t; k++) {
            sum += annFunding[sym][k];
          }
          const trailingFund = sum / lookbackPeriods;
          const totalGrossRate = trailingFund + assetStakingYields[sym];
          scores.push({ sym, rate: totalGrossRate, fundRate: trailingFund });
        }
        scores.sort((a, b) => b.rate - a.rate);

        // 2. Select positions applying Buffer and Hurdle
        const newPortfolio = new Map();

        if (currentPortfolio.size === 0) {
          // Initial allocation at day 0 of holdout
          const eligible = scores.filter(s => s.rate >= hurdlePct).slice(0, topK);
          for (const item of eligible) {
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
                newPortfolio.set(heldSym, { leverage: lev, rate: currentRate });
              }
            }
          }

          // Fill open slots with best eligible candidates
          for (const cand of scores) {
            if (newPortfolio.size >= topK) break;
            if (cand.rate >= hurdlePct && !newPortfolio.has(cand.sym)) {
              newPortfolio.set(cand.sym, { leverage: lev, rate: cand.rate });
            }
          }
        }

        // 3. Turnover friction
        // Exits
        for (const [oldSym, oldPos] of currentPortfolio.entries()) {
          if (!newPortfolio.has(oldSym)) {
            const fee = (baseFeePerUnit / 2) * (oldPos.leverage / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            turnoverEventsCount++;
            totalTurnoverVolume += (1.0 / topK);
          }
        }
        // Entries
        for (const [newSym, nextPos] of newPortfolio.entries()) {
          if (!currentPortfolio.has(newSym)) {
            const fee = (baseFeePerUnit / 2) * (nextPos.leverage / topK);
            equity *= (1 - fee);
            totalFeePaid += fee;
            turnoverEventsCount++;
            totalTurnoverVolume += (1.0 / topK);
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
          const staking8h = (assetStakingYields[sym] / 100) / (365 * 3);
          const posLev = pos.leverage;
          const borrowRatePerPeriod = ((posLev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
          const legRet = ((fund8h + staking8h) * posLev - borrowRatePerPeriod) / topK;
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

    // 14-day calendar block returns for Hall-centered bootstrap
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
      equity,
      annReturnPct,
      totalNetReturnPct,
      sharpeRatio,
      maxDrawdownPct: maxDrawdownPct * 100,
      percentActive,
      turnoverEventsCount,
      totalTurnoverVolume,
      turnoverFeePct: totalFeePaid * 100,
      evalPeriodsCount,
      blockReturns,
      equityCurve
    };
  }
}
