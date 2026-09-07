/**
 * ALPHA FACTORY — AD007 DYNAMIC LEVERAGED BASIS ENGINE
 * Module: ad007_basis_engine.js
 * 
 * Formal Mechanics:
 * - Delta-neutral basis carry: Delta = +L (Spot) - L (Perp) = 0.
 * - Gross cash flow: L * sum(w_s * FR_s,t).
 * - Continuous USD borrowing cost: (L - 1.0) * (annualBorrowRate / 1095) per 8h period.
 * - Friction: 24 bps roundtrip per full entry/exit cycle scaled by L.
 * - Tracks equity curve, annualized Sharpe, max drawdown, and 14-day calendar block returns.
 */

export class AD007BasisEngine {
  /**
   * Simulates a leveraged delta-neutral basis carry cell over the funding panel.
   * 
   * @param {Object} panel - Map of symbol -> array of funding records
   * @param {Array<string>} symbols - List of symbols in universe
   * @param {Object} cell - Cell configuration from spec
   * @param {Object} friction - Friction configuration (totalRoundtripBpsPerCycle: 24)
   * @param {Object} borrowing - Borrowing configuration (annualBorrowRatePct: 4.0)
   */
  static simulate(panel, symbols, cell, friction, borrowing = { annualBorrowRatePct: 4.0 }) {
    const totalPeriods = panel[symbols[0]].length;
    const roundtripCost = friction.totalRoundtripBpsPerCycle / 10000; // 0.0024 (24 bps)
    const halfTurnoverCost = roundtripCost / 2; // 0.0012 per one-way turn
    const L = Number(cell.leverage || 1.0);

    // Period borrowing cost rate: annual rate / (365 * 3 periods/year)
    const annualBorrowRate = (borrowing.annualBorrowRatePct !== undefined ? borrowing.annualBorrowRatePct : 4.0) / 100;
    const periodBorrowCostRate = L > 1.0 ? (L - 1.0) * (annualBorrowRate / 1095) : 0;

    let currentWeights = {};
    for (const s of symbols) currentWeights[s] = 0;

    const periodNetReturns = new Float64Array(totalPeriods);
    const cumulativeEquity = new Float64Array(totalPeriods);
    let equity = 1.0;
    cumulativeEquity[0] = 1.0;

    // Track 14-day blocks (42 8-hour periods = 14 days)
    const blockReturns = [];
    let currentBlockNet = 0;
    let blockPeriodCount = 0;
    let blockStartTime = panel[symbols[0]][0].fundingTime;

    const rebalancePeriods = cell.rebalanceDays > 0 ? cell.rebalanceDays * 3 : 0;
    const lookbackPeriods = cell.lookbackDays > 0 ? cell.lookbackDays * 3 : 0;

    for (let t = 0; t < totalPeriods; t++) {
      let targetWeights = { ...currentWeights };

      if (cell.type === 'STATIC_BENCHMARK') {
        if (t === 0) {
          if (cell.allocation === 'BTC_ETH_50_50') {
            targetWeights['BTCUSDT'] = 0.5;
            targetWeights['ETHUSDT'] = 0.5;
          } else if (cell.allocation === 'ALL_6_EQUAL_WEIGHT') {
            for (const s of symbols) targetWeights[s] = 1.0 / symbols.length;
          }
        }
      } else if (cell.type === 'DYNAMIC_ROTATION') {
        if (t >= lookbackPeriods && (t % rebalancePeriods === 0)) {
          // Rank all assets by rolling mean funding rate
          const yieldRanking = [];
          for (const s of symbols) {
            let sumFR = 0;
            for (let k = 1; k <= lookbackPeriods; k++) {
              sumFR += panel[s][t - k].fundingRate;
            }
            yieldRanking.push({ symbol: s, avgFR: sumFR / lookbackPeriods });
          }
          yieldRanking.sort((a, b) => b.avgFR - a.avgFR);

          for (const s of symbols) targetWeights[s] = 0;

          if (cell.allocation === 'TOP_2_YIELDERS') {
            targetWeights[yieldRanking[0].symbol] = 0.5;
            targetWeights[yieldRanking[1].symbol] = 0.5;
          } else if (cell.allocation === 'TOP_3_YIELDERS') {
            targetWeights[yieldRanking[0].symbol] = 1.0 / 3.0;
            targetWeights[yieldRanking[1].symbol] = 1.0 / 3.0;
            targetWeights[yieldRanking[2].symbol] = 1.0 / 3.0;
          } else if (cell.allocation === 'TOP_1_YIELDER') {
            targetWeights[yieldRanking[0].symbol] = 1.0;
          }
        }
      } else if (cell.type === 'VOLATILITY_ADJUSTED_ROTATION') {
        if (t >= lookbackPeriods && (t % rebalancePeriods === 0)) {
          // Rank all assets by yield-to-volatility ratio
          const volAdjRanking = [];
          for (const s of symbols) {
            let sumFR = 0;
            for (let k = 1; k <= lookbackPeriods; k++) {
              sumFR += panel[s][t - k].fundingRate;
            }
            const avgFR = sumFR / lookbackPeriods;
            let sumSq = 0;
            for (let k = 1; k <= lookbackPeriods; k++) {
              sumSq += Math.pow(panel[s][t - k].fundingRate - avgFR, 2);
            }
            const stdFR = Math.sqrt(sumSq / lookbackPeriods);
            const score = stdFR > 0.00001 ? avgFR / stdFR : avgFR / 0.00001;
            volAdjRanking.push({ symbol: s, score, avgFR });
          }
          volAdjRanking.sort((a, b) => b.score - a.score);

          for (const s of symbols) targetWeights[s] = 0;
          targetWeights[volAdjRanking[0].symbol] = 0.5;
          targetWeights[volAdjRanking[1].symbol] = 0.5;
        }
      }

      // Compute turnover cost scaled by leverage L
      let turnoverCost = 0;
      for (const s of symbols) {
        const deltaW = Math.abs(targetWeights[s] - currentWeights[s]);
        turnoverCost += L * deltaW * halfTurnoverCost;
        currentWeights[s] = targetWeights[s];
      }

      // Compute gross yield from funding received scaled by L
      let grossYield = 0;
      for (const s of symbols) {
        grossYield += currentWeights[s] * panel[s][t].fundingRate;
      }
      const leveragedGrossYield = L * grossYield;

      // Net yield after borrowing cost and turnover friction
      const netYield = leveragedGrossYield - periodBorrowCostRate - turnoverCost;
      periodNetReturns[t] = netYield;
      equity *= (1.0 + netYield);
      cumulativeEquity[t] = equity;

      // Accumulate into 14-day blocks
      currentBlockNet += netYield;
      blockPeriodCount++;

      if (blockPeriodCount === 42 || t === totalPeriods - 1) {
        blockReturns.push({
          entryTime: blockStartTime,
          exitTime: panel[symbols[0]][t].fundingTime,
          netPct: currentBlockNet,
          netR: currentBlockNet / 0.01 // 1R = 100 bps net yield
        });
        currentBlockNet = 0;
        blockPeriodCount = 0;
        if (t + 1 < totalPeriods) {
          blockStartTime = panel[symbols[0]][t + 1].fundingTime;
        }
      }
    }

    // Performance Metrics
    const totalNetReturnPct = (equity - 1.0) * 100;
    const annualizedReturnPct = (Math.pow(equity, 1095 / totalPeriods) - 1.0) * 100;

    // Maximum Drawdown
    let peak = 1.0;
    let maxDrawdownPct = 0;
    for (let t = 0; t < totalPeriods; t++) {
      if (cumulativeEquity[t] > peak) peak = cumulativeEquity[t];
      const dd = (peak - cumulativeEquity[t]) / peak;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    // Sharpe Ratio (3 periods/day = 1095 periods/year)
    let sumR = 0;
    for (let t = 0; t < totalPeriods; t++) sumR += periodNetReturns[t];
    const meanR = sumR / totalPeriods;
    let sumSq = 0;
    for (let t = 0; t < totalPeriods; t++) sumSq += Math.pow(periodNetReturns[t] - meanR, 2);
    const stdR = Math.sqrt(sumSq / totalPeriods);
    const annualizedSharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(1095) : 0;

    return {
      totalNetReturnPct,
      annualizedReturnPct,
      maxDrawdownPct: maxDrawdownPct * 100,
      annualizedSharpe,
      blockReturns,
      finalEquity: equity
    };
  }
}
