/**
 * ALPHA FACTORY — AD008 REGIME-GATED BASIS ENGINE
 * Module: ad008_gated_engine.js
 * 
 * Implements:
 * 1. Finite State Machine for Regime-Gated Delta-Neutral Basis Arbitrage.
 * 2. Causal trailing moving average calculation of 8H funding rates.
 * 3. Hysteresis entry [>= H_entry] and exit [< H_exit] triggers.
 * 4. Exact zero borrowing cost and zero market exposure during Inactive (Cash) states.
 * 5. Friction deduction on state transitions (scaled by leverage L).
 * 6. Discrete rebalance schedule for dynamic selection to avoid high-frequency fee churn.
 * 7. 14-day calendar block returns for Hall-centered bootstrap inference.
 */

export class AD008GatedEngine {
  /**
   * Run simulation for a single hypothesis cell.
   * @param {Object} panel - Map of sym -> array of 8H records { fundingTime, fundingRate }
   * @param {Array<string>} targetAssets - Array of asset symbols
   * @param {Object} cell - Cell configuration from AD008_CAMPAIGN_SPEC.json
   * @param {Object} friction - Friction config { totalRoundtripBpsPerCycle: 24 }
   * @param {Object} borrowing - Borrowing config { annualBorrowRatePct: 4.0 }
   * @param {Object} cashRate - Cash yield config { annualCashRatePct: 0.0 }
   * @returns {Object} Simulation results including equity curve, block returns, metrics
   */
  static simulate(panel, targetAssets, cell, friction, borrowing, cashRate = { annualCashRatePct: 0.0 }) {
    const sym0 = targetAssets[0];
    const totalPeriods = panel[sym0].length;
    const lev = cell.leverage || 1.0;
    const annualBorrowRate = borrowing.annualBorrowRatePct !== undefined ? borrowing.annualBorrowRatePct : 4.0;
    const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
    const annualCashRate = cashRate.annualCashRatePct !== undefined ? cashRate.annualCashRatePct : 0.0;
    const cashRatePerPeriod = (annualCashRate / 100) / (365 * 3);
    const roundtripBps = (friction.totalRoundtripBpsPerCycle || 24);
    const halfFrictionCost = (roundtripBps / 10000) * lev / 2; // entry or exit cost

    const gating = cell.gating || { enabled: false };
    const lookbackPeriods = (gating.lookbackDays || 7) * 3;
    const rebalancePeriods = (gating.rebalanceDays || 30) * 3; // monthly rebalance for dynamic
    const entryHurdle = gating.entryThresholdAnnPct !== undefined ? gating.entryThresholdAnnPct : 0.0;
    const exitHurdle = gating.exitThresholdAnnPct !== undefined ? gating.exitThresholdAnnPct : 0.0;

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

    let isAllocated = false;
    let activePeriodsCount = 0;
    let transitionCount = 0;

    // Previous asset weights for dynamic selection
    let prevWeights = {};
    for (const sym of targetAssets) prevWeights[sym] = 0.0;

    for (let t = 0; t < totalPeriods; t++) {
      let currentAllocated = false;
      let currentWeights = { ...prevWeights };

      if (!gating.enabled) {
        // Unconditional Benchmark
        currentAllocated = true;
        for (const sym of targetAssets) currentWeights[sym] = 0.0;
        if (cell.allocation === 'BTC_ETH_50_50') {
          currentWeights['BTCUSDT'] = 0.5;
          currentWeights['ETHUSDT'] = 0.5;
        } else {
          const w = 1.0 / targetAssets.length;
          for (const sym of targetAssets) currentWeights[sym] = w;
        }
      } else {
        // Gated Evaluation
        const startLookback = Math.max(0, t - lookbackPeriods);
        const count = t - startLookback;

        if (cell.type === 'GATED_STATIC') {
          // Gated 50/50 BTC/ETH
          let avgFunding = 0.0;
          if (count > 0) {
            let sumBtc = 0.0;
            let sumEth = 0.0;
            for (let k = startLookback; k < t; k++) {
              sumBtc += annFunding['BTCUSDT'][k];
              sumEth += annFunding['ETHUSDT'][k];
            }
            avgFunding = (sumBtc / count + sumEth / count) / 2.0;
          } else {
            avgFunding = (annFunding['BTCUSDT'][0] + annFunding['ETHUSDT'][0]) / 2.0;
          }

          if (!isAllocated) {
            if (avgFunding >= entryHurdle) {
              currentAllocated = true;
            } else {
              currentAllocated = false;
            }
          } else {
            if (avgFunding < exitHurdle) {
              currentAllocated = false;
            } else {
              currentAllocated = true;
            }
          }

          for (const sym of targetAssets) currentWeights[sym] = 0.0;
          if (currentAllocated) {
            currentWeights['BTCUSDT'] = 0.5;
            currentWeights['ETHUSDT'] = 0.5;
          }
        } else if (cell.type === 'GATED_DYNAMIC_SELECTION') {
          const isRebalancePoint = (t % rebalancePeriods === 0);

          if (isRebalancePoint) {
            // Re-rank and select at discrete rebalance schedule
            const kCount = cell.allocation === 'TOP_3_ABOVE_HURDLE' ? 3 : 2;
            const assetScores = [];

            for (const sym of targetAssets) {
              let sumF = 0.0;
              if (count > 0) {
                for (let k = startLookback; k < t; k++) sumF += annFunding[sym][k];
                const meanF = sumF / count;
                if (meanF >= entryHurdle) {
                  assetScores.push({ sym, meanF });
                }
              } else {
                if (annFunding[sym][0] >= entryHurdle) {
                  assetScores.push({ sym, meanF: annFunding[sym][0] });
                }
              }
            }

            for (const sym of targetAssets) currentWeights[sym] = 0.0;

            if (assetScores.length > 0) {
              assetScores.sort((a, b) => b.meanF - a.meanF);
              const selected = assetScores.slice(0, kCount);
              const w = 1.0 / selected.length;
              for (const s of selected) {
                currentWeights[s.sym] = w;
              }
              currentAllocated = true;
            } else {
              currentAllocated = false;
            }
          } else {
            // Intra-rebalance: check if any held asset dropped below exit hurdle
            currentWeights = { ...prevWeights };
            let anyHeld = false;
            for (const sym of targetAssets) {
              if (currentWeights[sym] > 0) {
                let sumF = 0.0;
                if (count > 0) {
                  for (let k = startLookback; k < t; k++) sumF += annFunding[sym][k];
                  const meanF = sumF / count;
                  if (meanF < exitHurdle) {
                    currentWeights[sym] = 0.0; // exit individual asset
                  } else {
                    anyHeld = true;
                  }
                } else {
                  anyHeld = true;
                }
              }
            }
            currentAllocated = anyHeld;
          }
        }
      }

      // Turnover friction calculation: sum(|w_t - w_{t-1}|) / 2
      let turnoverFraction = 0.0;
      if (t === 0) {
        let sumW = 0.0;
        for (const sym of targetAssets) sumW += currentWeights[sym];
        turnoverFraction = sumW;
      } else {
        let deltaW = 0.0;
        for (const sym of targetAssets) {
          deltaW += Math.abs(currentWeights[sym] - prevWeights[sym]);
        }
        turnoverFraction = deltaW / 2.0;
      }

      if (turnoverFraction > 0.01) {
        const turnoverCost = turnoverFraction * halfFrictionCost * 2;
        equity *= (1.0 - turnoverCost);
        transitionCount++;
      }

      // Period yield calculation
      let periodGrossFunding = 0.0;
      let totalAllocatedWeight = 0.0;
      for (const sym of targetAssets) {
        if (currentWeights[sym] > 0) {
          periodGrossFunding += currentWeights[sym] * panel[sym][t].fundingRate;
          totalAllocatedWeight += currentWeights[sym];
        }
      }

      let netPeriodYield = 0.0;
      if (totalAllocatedWeight > 0.001) {
        activePeriodsCount++;
        const activePortion = totalAllocatedWeight;
        const cashPortion = 1.0 - activePortion;

        const activeNet = (lev * periodGrossFunding) - (activePortion * borrowRatePerPeriod);
        const cashNet = cashPortion * cashRatePerPeriod;
        netPeriodYield = activeNet + cashNet;
      } else {
        // 100% in cash
        netPeriodYield = cashRatePerPeriod;
      }

      const prevEquity = equity;
      equity *= (1.0 + netPeriodYield);
      const periodReturn = (equity - prevEquity) / prevEquity;
      periodReturns.push(periodReturn);
      equityCurve.push(equity);

      if (equity > maxEquity) maxEquity = equity;
      const dd = (maxEquity - equity) / maxEquity * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;

      isAllocated = currentAllocated;
      prevWeights = currentWeights;
    }

    // End-of-period unwinding friction if position still active
    let finalTurnover = 0.0;
    for (const sym of targetAssets) finalTurnover += prevWeights[sym];
    if (finalTurnover > 0.01) {
      equity *= (1.0 - finalTurnover * halfFrictionCost);
    }

    const totalNetReturnPct = (equity - 1.0) * 100;
    const annualizedReturnPct = (Math.pow(equity, (365 * 3) / totalPeriods) - 1.0) * 100;

    // 14-day calendar block returns (42 periods per block)
    const blockSize = 42;
    const nBlocks = Math.floor(totalPeriods / blockSize);
    const blockReturns = [];

    for (let b = 0; b < nBlocks; b++) {
      let bEq = 1.0;
      for (let p = 0; p < blockSize; p++) {
        const idx = b * blockSize + p;
        bEq *= (1.0 + periodReturns[idx]);
      }
      blockReturns.push(bEq - 1.0);
    }

    // Annualized Sharpe Ratio based on 8H periods
    let sumR = 0.0;
    for (let i = 0; i < periodReturns.length; i++) sumR += periodReturns[i];
    const meanR = sumR / periodReturns.length;
    let sumSq = 0.0;
    for (let i = 0; i < periodReturns.length; i++) {
      const diff = periodReturns[i] - meanR;
      sumSq += diff * diff;
    }
    const stdR = Math.sqrt(sumSq / periodReturns.length);
    const annualizedSharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(365 * 3) : 0;

    return {
      totalNetReturnPct,
      annualizedReturnPct,
      maxDrawdownPct,
      annualizedSharpe,
      finalEquity: equity,
      equityCurve,
      blockReturns,
      periodReturns,
      activeFractionPct: Number(((activePeriodsCount / totalPeriods) * 100).toFixed(1)),
      transitions: transitionCount,
      totalPeriods
    };
  }
}
