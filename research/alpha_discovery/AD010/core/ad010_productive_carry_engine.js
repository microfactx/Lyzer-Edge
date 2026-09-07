/**
 * ALPHA FACTORY — AD010 PRODUCTIVE COLLATERAL BASIS CARRY ENGINE
 * Module: ad010_productive_carry_engine.js
 * 
 * Implements:
 * 1. Multi-Asset Staking-Enhanced Basis Carry across 6 core cryptos.
 * 2. Causal trailing moving averages of gross expected yield (Funding + Spot LST Staking).
 * 3. Exact modeling of spot staking yield (ETH: 3.5%, SOL: 6.0%, AVAX: 5.0%).
 * 4. Institutional cash / USD collateral yield (4.0% p.a. benchmark).
 * 5. Friction-buffered inertia schedule (2.0% / 3.0% buffer on monthly rebalance).
 * 6. Dynamic spread-sensitive leverage (1.0x to 2.0x).
 * 7. 14-day Calendar Block Returns for Hall-centered bootstrap inference.
 */

export class AD010ProductiveCarryEngine {
  /**
   * Run simulation for an AD010 hypothesis cell.
   * @param {Object} panel - Map of sym -> array of 8H records { fundingTime, fundingRate }
   * @param {Array<string>} targetAssets - Array of asset symbols
   * @param {Object} cell - Cell configuration from AD010_CAMPAIGN_SPEC.json
   * @param {Object} friction - Friction config { totalRoundtripBpsPerCycle: 24 }
   * @param {Object} borrowing - Borrowing config { annualBorrowRatePct: 4.0 }
   * @param {Object} cashRate - Cash yield config { annualCashRatePct: 4.0 }
   * @param {Object} stakingYields - Map of sym -> annual staking yield %
   * @returns {Object} Simulation results including metrics and block returns
   */
  static simulate(panel, targetAssets, cell, friction, borrowing, cashRate, stakingYields) {
    const sym0 = targetAssets[0];
    const totalPeriods = panel[sym0].length;
    const annualBorrowRate = borrowing.annualBorrowRatePct !== undefined ? borrowing.annualBorrowRatePct : 4.0;
    const annualCashRate = (cell.enableCashYield !== false && cashRate.annualCashRatePct !== undefined) 
      ? cashRate.annualCashRatePct 
      : 0.0;
    const cashRatePerPeriod = (annualCashRate / 100) / (365 * 3);
    const roundtripBps = friction.totalRoundtripBpsPerCycle !== undefined ? friction.totalRoundtripBpsPerCycle : 24;
    const baseFeePerUnit = roundtripBps / 10000;

    // Precompute annualized funding rates and effective spot yields per asset
    const annFunding = {};
    const assetStakingYields = {};
    for (const sym of targetAssets) {
      annFunding[sym] = new Float64Array(totalPeriods);
      const isStakingActive = cell.enableStaking !== false;
      const sYield = isStakingActive && stakingYields[sym] ? stakingYields[sym] : 0.0;
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

    // -------------------------------------------------------------
    // STATIC STAKING DUO (ETH + SOL 50/50 Unconditional)
    // -------------------------------------------------------------
    if (cell.type === 'STATIC_STAKING_PAIR') {
      const lev = cell.leverage || 2.0;
      const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
      const initialFee = (baseFeePerUnit / 2) * lev;
      equity *= (1 - initialFee);
      totalFeePaid += initialFee;
      turnoverEventsCount = 2;
      totalTurnoverVolume = 1.0;

      for (let t = 0; t < totalPeriods; t++) {
        const ethFund = panel['ETHUSDT'][t].fundingRate;
        const solFund = panel['SOLUSDT'][t].fundingRate;
        const ethStaking8h = (assetStakingYields['ETHUSDT'] / 100) / (365 * 3);
        const solStaking8h = (assetStakingYields['SOLUSDT'] / 100) / (365 * 3);

        const ethGross = (ethFund + ethStaking8h) * lev - borrowRatePerPeriod;
        const solGross = (solFund + solStaking8h) * lev - borrowRatePerPeriod;
        const periodRet = 0.5 * ethGross + 0.5 * solGross;

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
    // DYNAMIC / INERT BUFFERED CARRY (11 CELLS)
    // -------------------------------------------------------------
    else {
      const topK = cell.topK || 2;
      const lookbackPeriods = Math.max(1, (cell.lookbackDays || 30) * 3);
      const rebalPeriods = Math.max(1, Math.round((cell.rebalanceDays || 30) * 3));
      const bufferPct = cell.bufferPct !== undefined ? cell.bufferPct : 2.0;
      const hurdlePct = cell.hurdlePct !== undefined ? cell.hurdlePct : 3.0;
      const maxLev = cell.maxLeverage || 2.0;

      for (let t = 0; t < totalPeriods; t++) {
        const isRebalanceTrigger = (t >= lookbackPeriods && (t % rebalPeriods === 0 || currentPortfolio.size === 0));

        if (isRebalanceTrigger) {
          // 1. Calculate trailing average funding + spot staking yield for each asset
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
            const eligible = scores.filter(s => s.rate >= hurdlePct).slice(0, topK);
            for (const item of eligible) {
              const lev = AD010ProductiveCarryEngine.calculateLeverage(item.rate, annualBorrowRate, maxLev, cell.leverage);
              newPortfolio.set(item.sym, { leverage: lev, rate: item.rate });
            }
          } else {
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
                  const lev = AD010ProductiveCarryEngine.calculateLeverage(currentRate, annualBorrowRate, maxLev, cell.leverage);
                  newPortfolio.set(heldSym, { leverage: lev, rate: currentRate });
                }
              }
            }

            // Fill available slots
            for (const cand of scores) {
              if (newPortfolio.size >= topK) break;
              if (cand.rate >= hurdlePct && !newPortfolio.has(cand.sym)) {
                const lev = AD010ProductiveCarryEngine.calculateLeverage(cand.rate, annualBorrowRate, maxLev, cell.leverage);
                newPortfolio.set(cand.sym, { leverage: lev, rate: cand.rate });
              }
            }
          }

          // 3. Turnover friction
          // Exits / deleveraging
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
          // Entries / leveraging
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
            const staking8h = (assetStakingYields[sym] / 100) / (365 * 3);
            const lev = pos.leverage;
            const borrowRatePerPeriod = ((lev - 1.0) * (annualBorrowRate / 100)) / (365 * 3);
            const legRet = ((fund8h + staking8h) * lev - borrowRatePerPeriod) / topK;
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
    }

    // 14-day calendar block returns for Hall-centered bootstrap
    const blockReturns = [];
    const periodsPerBlock = 42; // 14 days * 3
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

  static calculateLeverage(rateAnnPct, annualBorrowRatePct, maxLeverage, leverageMode) {
    if (leverageMode !== 'DYNAMIC_SPREAD') {
      return typeof leverageMode === 'number' ? leverageMode : maxLeverage;
    }
    if (rateAnnPct >= annualBorrowRatePct + 4.0) {
      return maxLeverage; // 2.0x
    } else if (rateAnnPct >= annualBorrowRatePct + 1.0) {
      return (1.0 + maxLeverage) / 2.0; // 1.5x
    } else {
      return 1.0; // 1.0x unleveraged
    }
  }
}
