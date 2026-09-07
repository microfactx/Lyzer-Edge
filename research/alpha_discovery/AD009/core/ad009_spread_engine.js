/**
 * ALPHA FACTORY — AD009 CROSS-ASSET SPREAD & BUFFERED CARRY ENGINE
 * Module: ad009_spread_engine.js
 * 
 * Implements:
 * 1. Multi-Asset Ranking Engine across 6 core institutional cryptos.
 * 2. Causal Trailing Funding Moving Averages (14d, 30d, 60d lookbacks).
 * 3. Friction-Buffered Turnover Inertia (delta_buffer >= 2.0% / 3.0%).
 * 4. Spread-Sensitive Dynamic Leverage (1.0x to 2.0x tied to F_i - r_borrow).
 * 5. Spot-Perp Delta=0 Exact Hedging vs Unhedged Cross-Perp Ablation.
 * 6. Discrete Rebalancing Schedules (14d, 30d).
 * 7. 14-day Calendar Block Returns for Hall-Centered Bootstrap.
 */

export class AD009SpreadEngine {
  /**
   * Run simulation for a single hypothesis cell.
   * @param {Object} panel - Map of sym -> array of 8H records { fundingTime, fundingRate }
   * @param {Array<string>} targetAssets - Array of asset symbols
   * @param {Object} cell - Cell configuration from AD009_CAMPAIGN_SPEC.json
   * @param {Object} friction - Friction config { totalRoundtripBpsPerCycle: 24 }
   * @param {Object} borrowing - Borrowing config { annualBorrowRatePct: 4.0 }
   * @param {Object} cashRate - Cash yield config { annualCashRatePct: 0.0 }
   * @param {Object} candles - Optional map of sym -> array of 8H price candles { close }
   * @returns {Object} Simulation results
   */
  static simulate(panel, targetAssets, cell, friction, borrowing, cashRate = { annualCashRatePct: 0.0 }, candles = null) {
    const sym0 = targetAssets[0];
    const totalPeriods = panel[sym0].length;
    const annualBorrowRate = borrowing.annualBorrowRatePct !== undefined ? borrowing.annualBorrowRatePct : 4.0;
    const annualCashRate = cashRate.annualCashRatePct !== undefined ? cashRate.annualCashRatePct : 0.0;
    const cashRatePerPeriod = (annualCashRate / 100) / (365 * 3);
    const roundtripBps = friction.totalRoundtripBpsPerCycle !== undefined ? friction.totalRoundtripBpsPerCycle : 24;
    const baseFeePerUnit = roundtripBps / 10000; // e.g. 0.0024

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

    // Current portfolio positions: Map of sym -> { leverage: number }
    let currentPortfolio = new Map();

    // -------------------------------------------------------------
    // 1. STATIC CONTROL BENCHMARK (BTC/ETH 50/50 Unconditional)
    // -------------------------------------------------------------
    if (cell.type === 'STATIC_CONTROL') {
      const lev = cell.leverage || 1.0;
      const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
      // Entry fee on day 0
      const initialFee = (baseFeePerUnit / 2) * lev;
      equity *= (1 - initialFee);
      totalFeePaid += initialFee;
      turnoverEventsCount = 1;
      totalTurnoverVolume = 1.0;

      for (let t = 0; t < totalPeriods; t++) {
        const btcFund = panel['BTCUSDT'][t].fundingRate;
        const ethFund = panel['ETHUSDT'][t].fundingRate;
        const avgFund = (btcFund + ethFund) / 2.0;

        const periodRet = avgFund * lev - borrowRatePerPeriod;
        equity *= (1 + periodRet);
        periodReturns.push(periodRet);
        activePeriodsCount++;

        if (equity > maxEquity) maxEquity = equity;
        const dd = (maxEquity - equity) / maxEquity;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
        equityCurve.push(equity);
      }
    }

    // -------------------------------------------------------------
    // 2. GATED CONTROL (H015 Baseline: 7d lookback, [4%, 6%] Hysteresis)
    // -------------------------------------------------------------
    else if (cell.type === 'GATED_CONTROL') {
      const lev = cell.leverage || 2.0;
      const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
      const lookbackPeriods = (cell.lookbackDays || 7) * 3;
      const entryHurdle = cell.hurdlePct !== undefined ? cell.hurdlePct : 6.0;
      const exitHurdle = cell.exitHurdlePct !== undefined ? cell.exitHurdlePct : 4.0;
      let isAllocated = false;

      for (let t = 0; t < totalPeriods; t++) {
        const startLookback = Math.max(0, t - lookbackPeriods);
        const count = t - startLookback;
        let avgFunding7d = 0;
        if (count > 0) {
          let sum = 0;
          for (let k = startLookback; k < t; k++) {
            sum += (annFunding['BTCUSDT'][k] + annFunding['ETHUSDT'][k]) / 2.0;
          }
          avgFunding7d = sum / count;
        } else {
          avgFunding7d = (annFunding['BTCUSDT'][0] + annFunding['ETHUSDT'][0]) / 2.0;
        }

        let targetAllocated = isAllocated;
        if (!isAllocated && avgFunding7d >= entryHurdle) {
          targetAllocated = true;
        } else if (isAllocated && avgFunding7d < exitHurdle) {
          targetAllocated = false;
        }

        if (targetAllocated !== isAllocated) {
          const fee = (baseFeePerUnit / 2) * lev;
          equity *= (1 - fee);
          totalFeePaid += fee;
          turnoverEventsCount++;
          totalTurnoverVolume += 1.0;
          isAllocated = targetAllocated;
        }

        let periodRet = 0;
        if (isAllocated) {
          activePeriodsCount++;
          const avgFund = (panel['BTCUSDT'][t].fundingRate + panel['ETHUSDT'][t].fundingRate) / 2.0;
          periodRet = avgFund * lev - borrowRatePerPeriod;
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
    }

    // -------------------------------------------------------------
    // 3. BUFFERED DYNAMIC SPREAD CARRY (The AD009 Core Innovation)
    // -------------------------------------------------------------
    else if (cell.type === 'BUFFERED_DYNAMIC') {
      const topK = cell.topK || 2;
      const lookbackPeriods = Math.max(1, (cell.lookbackDays || 30) * 3);
      const rebalPeriods = Math.max(1, Math.round((cell.rebalanceDays || 30) * 3));
      const bufferPct = cell.bufferPct !== undefined ? cell.bufferPct : 2.0;
      const hurdlePct = cell.hurdlePct !== undefined ? cell.hurdlePct : 3.0;
      const maxLev = cell.maxLeverage || 2.0;

      for (let t = 0; t < totalPeriods; t++) {
        // Evaluate discrete rebalance schedule
        const isRebalanceTrigger = (t >= lookbackPeriods && (t % rebalPeriods === 0 || currentPortfolio.size === 0));

        if (isRebalanceTrigger) {
          // 1. Calculate trailing average funding for all assets
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
            // Initial allocation: select topK above hurdle
            const eligible = scores.filter(s => s.rate >= hurdlePct).slice(0, topK);
            for (const item of eligible) {
              const lev = AD009SpreadEngine.calculateLeverage(item.rate, annualBorrowRate, maxLev, cell.leverage);
              newPortfolio.set(item.sym, { leverage: lev, rate: item.rate });
            }
          } else {
            // Inertia-buffered rebalance
            const keptSymbols = new Set();
            for (const [heldSym, pos] of currentPortfolio.entries()) {
              const currentScore = scores.find(s => s.sym === heldSym);
              const currentRate = currentScore ? currentScore.rate : -999;

              if (currentRate >= hurdlePct) {
                // Find highest ranked candidate not currently held
                const topChallenger = scores.find(s => !currentPortfolio.has(s.sym) && !keptSymbols.has(s.sym));
                if (topChallenger && topChallenger.rate > currentRate + bufferPct) {
                  // Challenger decisively beats incumbent + buffer -> do NOT keep
                } else {
                  keptSymbols.add(heldSym);
                  const lev = AD009SpreadEngine.calculateLeverage(currentRate, annualBorrowRate, maxLev, cell.leverage);
                  newPortfolio.set(heldSym, { leverage: lev, rate: currentRate });
                }
              }
            }

            // If slots available (due to dropped assets or below topK), fill with best eligible candidates
            for (const cand of scores) {
              if (newPortfolio.size >= topK) break;
              if (cand.rate >= hurdlePct && !newPortfolio.has(cand.sym)) {
                const lev = AD009SpreadEngine.calculateLeverage(cand.rate, annualBorrowRate, maxLev, cell.leverage);
                newPortfolio.set(cand.sym, { leverage: lev, rate: cand.rate });
              }
            }
          }

          // 3. Compute turnover friction costs
          // Check exits / reductions
          for (const [oldSym, oldPos] of currentPortfolio.entries()) {
            const nextPos = newPortfolio.get(oldSym);
            if (!nextPos) {
              // Full exit
              const fee = (baseFeePerUnit / 2) * (oldPos.leverage / topK);
              equity *= (1 - fee);
              totalFeePaid += fee;
              turnoverEventsCount++;
              totalTurnoverVolume += (1.0 / topK);
            } else if (oldPos.leverage > nextPos.leverage) {
              // Deleveraging
              const dLev = oldPos.leverage - nextPos.leverage;
              const fee = (baseFeePerUnit / 2) * (dLev / topK);
              equity *= (1 - fee);
              totalFeePaid += fee;
              totalTurnoverVolume += (dLev / (topK * maxLev));
            }
          }
          // Check entries / increases
          for (const [newSym, nextPos] of newPortfolio.entries()) {
            const oldPos = currentPortfolio.get(newSym);
            if (!oldPos) {
              // Full entry
              const fee = (baseFeePerUnit / 2) * (nextPos.leverage / topK);
              equity *= (1 - fee);
              totalFeePaid += fee;
              turnoverEventsCount++;
              totalTurnoverVolume += (1.0 / topK);
            } else if (nextPos.leverage > oldPos.leverage) {
              // Leveraging up
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
          // Unallocated cash leg if currentPortfolio.size < topK
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
    }

    // -------------------------------------------------------------
    // 4. ABLATION CONTROL: UNHEDGED CROSS-PERP SPREAD (NO SPOT)
    // -------------------------------------------------------------
    else if (cell.type === 'CROSS_PERP_UNHEDGED') {
      const lookbackPeriods = Math.max(1, (cell.lookbackDays || 30) * 3);
      const rebalPeriods = Math.max(1, Math.round((cell.rebalanceDays || 30) * 3));
      let longSym = null;
      let shortSym = null;

      for (let t = 0; t < totalPeriods; t++) {
        if (t >= lookbackPeriods && (t % rebalPeriods === 0 || !longSym)) {
          const scores = [];
          for (const sym of targetAssets) {
            let sum = 0;
            for (let k = t - lookbackPeriods; k < t; k++) sum += annFunding[sym][k];
            scores.push({ sym, rate: sum / lookbackPeriods });
          }
          scores.sort((a, b) => b.rate - a.rate);
          const nextShortSym = scores[0].sym; // Highest funding -> Short perp to collect
          const nextLongSym = scores[scores.length - 1].sym; // Lowest funding -> Long perp

          if (nextShortSym !== shortSym || nextLongSym !== longSym) {
            const fee = baseFeePerUnit; // 24 bps for 2 perp positions
            equity *= (1 - fee);
            totalFeePaid += fee;
            turnoverEventsCount++;
            totalTurnoverVolume += 1.0;
            shortSym = nextShortSym;
            longSym = nextLongSym;
          }
        }

        let periodRet = 0;
        if (longSym && shortSym && candles && t > 0) {
          activePeriodsCount++;
          const pLong0 = candles[longSym][t - 1].close;
          const pLong1 = candles[longSym][t].close;
          const retPriceLong = (pLong1 - pLong0) / pLong0;

          const pShort0 = candles[shortSym][t - 1].close;
          const pShort1 = candles[shortSym][t].close;
          const retPriceShort = -(pShort1 - pShort0) / pShort0;

          const fundLong = -panel[longSym][t].fundingRate;
          const fundShort = panel[shortSym][t].fundingRate;

          periodRet = 0.5 * (retPriceLong + fundLong) + 0.5 * (retPriceShort + fundShort);
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
    }

    // Aggregate 14-day calendar blocks for bootstrap
    // 14 days = 14 * 3 = 42 periods of 8H
    const blockReturns = [];
    const periodsPerBlock = 42;
    for (let i = 0; i < totalPeriods; i += periodsPerBlock) {
      const end = Math.min(totalPeriods, i + periodsPerBlock);
      let blkRet = 1.0;
      for (let j = i; j < end; j++) {
        blkRet *= (1 + periodReturns[j]);
      }
      blockReturns.push(blkRet - 1.0);
    }

    const annReturnPct = (Math.pow(equity, (365 * 3) / totalPeriods) - 1) * 100;
    const totalReturnPct = (equity - 1.0) * 100;

    const meanR = periodReturns.reduce((s, x) => s + x, 0) / periodReturns.length;
    const varR = periodReturns.reduce((s, x) => s + Math.pow(x - meanR, 2), 0) / periodReturns.length;
    const sharpeRatio = Math.sqrt(varR) > 0 ? (meanR / Math.sqrt(varR)) * Math.sqrt(365 * 3) : 0;
    const percentActive = (activePeriodsCount / totalPeriods) * 100;

    return {
      cellId: cell.id,
      equity,
      annReturnPct,
      totalReturnPct,
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

  /**
   * Determine spread-sensitive leverage based on trailing funding vs borrow cost.
   */
  static calculateLeverage(rateAnnPct, annualBorrowRatePct, maxLeverage, leverageMode) {
    if (leverageMode !== 'DYNAMIC_SPREAD') {
      return typeof leverageMode === 'number' ? leverageMode : maxLeverage;
    }
    // Dynamic rule:
    // If rate >= borrowRate + 4.0% (e.g. 8.0%), full leverage (e.g. 2.0x)
    // Else if rate >= borrowRate + 1.0% (e.g. 5.0%), intermediate leverage (1.5x)
    // Else (rate < 5.0%), 1.0x unleveraged (zero borrow cost!)
    if (rateAnnPct >= annualBorrowRatePct + 4.0) {
      return maxLeverage;
    } else if (rateAnnPct >= annualBorrowRatePct + 1.0) {
      return (1.0 + maxLeverage) / 2.0;
    } else {
      return 1.0;
    }
  }
}
