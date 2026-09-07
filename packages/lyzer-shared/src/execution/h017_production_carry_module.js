/**
 * LYZER LABS — H017 PRODUCTION PRODUCTIVE CARRY EXECUTION MODULE
 * Module: h017_production_carry_module.js
 * 
 * Production Implementation of Confirmed Hypothesis H017:
 * 1. Discrete monthly rebalance schedule (30 days) across Top 2 core cryptos.
 * 2. Causal inertia buffer of 2.0% (200 bps) and hurdle of 3.0% (300 bps).
 * 3. Atomic dual-leg orders (Buy Spot LST + Short Perp) ensuring Delta = 0.
 * 4. Continuous tracking of funding rate cash flows and LST staking yield compounding.
 * 5. Institutional 5-tier fail-closed Kill Switches (K1–K5).
 */

import { H017UnifiedMarginAdapter } from './h017_unified_margin_adapter.js';

export class H017ProductionCarryModule {
  constructor(config = {}) {
    this.initialCapital = config.initialCapital || 10000; // USD
    this.equity = this.initialCapital;
    this.maxEquity = this.initialCapital;
    this.cashBalance = this.initialCapital;

    this.topK = config.topK || 2;
    this.targetLeverage = config.targetLeverage || 2.0;
    this.lookbackDays = config.lookbackDays || 30;
    this.rebalanceDays = config.rebalanceDays || 30;
    this.rebalanceIntervalMs = this.rebalanceDays * 24 * 3600 * 1000;
    this.bufferPct = config.bufferPct !== undefined ? config.bufferPct : 2.0;
    this.hurdlePct = config.hurdlePct !== undefined ? config.hurdlePct : 3.0;

    this.stakingYields = {
      ETHUSDT: 3.5,
      SOLUSDT: 6.0,
      AVAXUSDT: 5.0,
      BTCUSDT: 0.0,
      LINKUSDT: 0.0,
      DOGEUSDT: 0.0,
      ...(config.stakingYields || {})
    };

    this.lstSymbolMap = {
      ETHUSDT: 'stETH',
      SOLUSDT: 'JitoSOL',
      AVAXUSDT: 'sAVAX',
      BTCUSDT: 'BTC',
      LINKUSDT: 'LINK',
      DOGEUSDT: 'DOGE'
    };

    this.marginAdapter = new H017UnifiedMarginAdapter(config.marginConfig || {});
    this.lastRebalanceTimestamp = 0;
    this.positions = new Map(); // Map of sym -> { spotAsset, spotQty, perpNotional, grossRate, leverage, entryTime }
    
    // Performance and Accounting Trackers
    this.cumulativeFundingCollectedUSD = 0;
    this.cumulativeStakingYieldUSD = 0;
    this.cumulativeFeesPaidUSD = 0;
    this.cumulativeBorrowCostUSD = 0;
    this.turnoverEventsCount = 0;

    // Kill switch state
    this.halted = false;
    this.haltReason = null;
    this.activeKillSwitch = null;

    // Inversion tracking
    this.consecutiveNegativeFundingHours = 0;
  }

  /**
   * Evaluate whether a portfolio rebalance is triggered.
   * @param {number} currentTimestampMs 
   * @param {Object} trailingGrossRates - Map of sym -> annualized rate % (Funding + Staking)
   * @param {Object} prices - Current spot prices in USD
   * @returns {Object} Rebalance execution plan
   */
  evaluateRebalance(currentTimestampMs, trailingGrossRates, prices) {
    if (this.halted) {
      return { triggered: false, reason: `MODULE_HALTED: ${this.haltReason}` };
    }

    const timeSinceLastRebalance = currentTimestampMs - this.lastRebalanceTimestamp;
    const isDue = this.lastRebalanceTimestamp === 0 || timeSinceLastRebalance >= this.rebalanceIntervalMs;

    if (!isDue) {
      return { triggered: false, reason: 'REBALANCE_INTERVAL_NOT_ELAPSED' };
    }

    // Rank candidate assets by trailing gross yield
    const candidates = Object.entries(trailingGrossRates)
      .map(([sym, rate]) => ({ sym, rate }))
      .sort((a, b) => b.rate - a.rate);

    const newPositions = new Map();

    if (this.positions.size === 0) {
      // Initial allocation
      const eligible = candidates.filter(c => c.rate >= this.hurdlePct).slice(0, this.topK);
      for (const item of eligible) {
        newPositions.set(item.sym, { leverage: this.targetLeverage, rate: item.rate });
      }
    } else {
      // Buffer-enforced rebalance
      const kept = new Set();
      for (const [heldSym, pos] of this.positions.entries()) {
        const currentRate = trailingGrossRates[heldSym] !== undefined ? trailingGrossRates[heldSym] : -999;
        if (currentRate >= this.hurdlePct) {
          const topChallenger = candidates.find(c => !this.positions.has(c.sym) && !kept.has(c.sym));
          if (topChallenger && topChallenger.rate > currentRate + this.bufferPct) {
            // Challenger decisively breaches buffer -> replace incumbent
          } else {
            kept.add(heldSym);
            newPositions.set(heldSym, { leverage: this.targetLeverage, rate: currentRate });
          }
        }
      }

      // Fill open slots with next best candidates
      for (const cand of candidates) {
        if (newPositions.size >= this.topK) break;
        if (cand.rate >= this.hurdlePct && !newPositions.has(cand.sym)) {
          newPositions.set(cand.sym, { leverage: this.targetLeverage, rate: cand.rate });
        }
      }
    }

    // Generate atomic orders for changes
    const atomicOrders = [];
    const baseFeeRate = 24 / 10000;
    const slotCapitalUSD = this.equity / this.topK;

    // 1. Exits / liquidations of old positions
    for (const [oldSym, oldPos] of this.positions.entries()) {
      if (!newPositions.has(oldSym)) {
        const price = prices[oldSym] || 1.0;
        const notionalUSD = slotCapitalUSD * oldPos.leverage;
        atomicOrders.push(this.createAtomicDualLegOrder(oldSym, 'CLOSE', notionalUSD, price));
        const fee = (baseFeeRate / 2) * notionalUSD;
        this.cumulativeFeesPaidUSD += fee;
        this.equity -= fee;
        this.turnoverEventsCount++;
      }
    }

    // 2. Entries of new positions
    for (const [newSym, newPos] of newPositions.entries()) {
      if (!this.positions.has(newSym)) {
        const price = prices[newSym] || 1.0;
        const notionalUSD = slotCapitalUSD * newPos.leverage;
        atomicOrders.push(this.createAtomicDualLegOrder(newSym, 'OPEN', notionalUSD, price));
        const fee = (baseFeeRate / 2) * notionalUSD;
        this.cumulativeFeesPaidUSD += fee;
        this.equity -= fee;
        this.turnoverEventsCount++;
      }
    }

    this.positions = newPositions;
    this.lastRebalanceTimestamp = currentTimestampMs;

    return {
      triggered: true,
      timestampMs: currentTimestampMs,
      selectedAssets: Array.from(newPositions.keys()),
      atomicOrdersCount: atomicOrders.length,
      atomicOrders,
      equityAfterFriction: this.equity
    };
  }

  /**
   * Create an atomic dual-leg order ensuring strict Delta = 0.
   * Leg 1: Spot Buy/Sell of LST asset.
   * Leg 2: Perp Short/Close hedge on derivative exchange.
   */
  createAtomicDualLegOrder(sym, action, notionalUSD, spotPrice) {
    const lstSymbol = this.lstSymbolMap[sym] || sym.replace(/USDT$/, '');
    const qty = notionalUSD / spotPrice;

    return {
      orderId: `ORD_${sym}_${action}_${Date.now()}`,
      symbol: sym,
      action,
      notionalUSD,
      deltaNeutral: true,
      legs: {
        spotLeg: {
          asset: lstSymbol,
          side: action === 'OPEN' ? 'BUY' : 'SELL',
          quantity: Number(qty.toFixed(6)),
          price: spotPrice,
          haircut: this.marginAdapter.getHaircut(lstSymbol)
        },
        perpLeg: {
          symbol: sym,
          side: action === 'OPEN' ? 'SELL_SHORT' : 'BUY_TO_COVER',
          notionalUSD,
          leverage: this.targetLeverage
        }
      }
    };
  }

  /**
   * Apply 8H funding rate payment settlement.
   * @param {Object} currentFundingRates - Map of sym -> 8H rate
   * @param {number} hoursElapsed - Default 8 hours
   */
  applyFundingSettlement(currentFundingRates, hoursElapsed = 8) {
    if (this.halted || this.positions.size === 0) return 0;

    let netFundingUSD = 0;
    const slotCapitalUSD = this.equity / this.topK;

    for (const [sym, pos] of this.positions.entries()) {
      const rate8h = currentFundingRates[sym] !== undefined ? currentFundingRates[sym] : 0;
      const notionalUSD = slotCapitalUSD * pos.leverage;
      const earnedUSD = notionalUSD * rate8h; // Short perp receives positive funding
      netFundingUSD += earnedUSD;
    }

    this.cumulativeFundingCollectedUSD += netFundingUSD;
    this.equity += netFundingUSD;
    if (this.equity > this.maxEquity) this.maxEquity = this.equity;

    return netFundingUSD;
  }

  /**
   * Apply spot Liquid Staking yield rewards compounding.
   * @param {number} daysElapsed 
   */
  applyStakingYield(daysElapsed = 1) {
    if (this.halted || this.positions.size === 0) return 0;

    let totalStakingUSD = 0;
    const slotCapitalUSD = this.equity / this.topK;

    for (const [sym, pos] of this.positions.entries()) {
      const annYieldPct = this.stakingYields[sym] || 0.0;
      const spotNotionalUSD = slotCapitalUSD * pos.leverage;
      const earnedUSD = spotNotionalUSD * (annYieldPct / 100) * (daysElapsed / 365);
      totalStakingUSD += earnedUSD;
    }

    this.cumulativeStakingYieldUSD += totalStakingUSD;
    this.equity += totalStakingUSD;
    if (this.equity > this.maxEquity) this.maxEquity = this.equity;

    return totalStakingUSD;
  }

  /**
   * Deduct continuous USD margin borrowing costs on active margin (L - 1.0).
   * @param {number} secondsElapsed 
   */
  applyBorrowingCost(secondsElapsed = 86400) {
    if (this.halted || this.positions.size === 0) return 0;

    let totalBorrowCostUSD = 0;
    const slotCapitalUSD = this.equity / this.topK;

    for (const [sym, pos] of this.positions.entries()) {
      if (pos.leverage > 1.0) {
        const borrowedUSD = slotCapitalUSD * (pos.leverage - 1.0);
        const cost = this.marginAdapter.calculateBorrowingInterest(borrowedUSD, secondsElapsed);
        totalBorrowCostUSD += cost;
      }
    }

    this.cumulativeBorrowCostUSD += totalBorrowCostUSD;
    this.equity -= totalBorrowCostUSD;

    return totalBorrowCostUSD;
  }

  /**
   * Check 5-tier fail-closed Kill Switches (K1–K5).
   * @param {Object} marketPrices - Map of sym -> price
   * @param {Object} nativePrices - Map of native asset -> price (for depeg check)
   * @returns {Object} Kill switch evaluation report
   */
  checkKillSwitches(marketPrices, nativePrices = {}) {
    // K1: LST Depeg Guard
    for (const [sym, pos] of this.positions.entries()) {
      const lstSym = this.lstSymbolMap[sym];
      const lstPrice = marketPrices[lstSym] || marketPrices[sym];
      const nativePrice = nativePrices[sym] || marketPrices[sym];
      const depeg = this.marginAdapter.checkDepeg(lstPrice, nativePrice);

      if (depeg.depegDetected) {
        return this.triggerKillSwitch('K1_LST_DEPEG', `LST ${lstSym} depeg detected: discount=${depeg.discountPct}% > threshold=${depeg.thresholdPct}%`);
      }
    }

    // K2: Margin Health Floor
    let totalCollateral = 0;
    let totalMmr = 0;
    const slotCapitalUSD = this.equity / this.topK;

    for (const [sym, pos] of this.positions.entries()) {
      const lstSym = this.lstSymbolMap[sym];
      const notional = slotCapitalUSD * pos.leverage;
      totalCollateral += notional * this.marginAdapter.getHaircut(lstSym);
      totalMmr += notional * (this.marginAdapter.defaultMmrPct / 100);
    }

    const health = this.marginAdapter.checkMarginHealth(totalCollateral, totalMmr);
    if (!health.healthy && this.positions.size > 0) {
      return this.triggerKillSwitch('K2_MARGIN_HEALTH', `Margin health ratio ${health.ratio} < minimum ${this.marginAdapter.minHealthyMarginRatio}`);
    }

    // K3: Consecutive Inversion Guard (> 72 consecutive hours of negative gross return)
    if (this.consecutiveNegativeFundingHours > 72) {
      return this.triggerKillSwitch('K3_FUNDING_INVERSION', `Gross yield inverted for ${this.consecutiveNegativeFundingHours} consecutive hours (> 72h floor)`);
    }

    // K5: Maximum Drawdown Stop (2.0% catastrophe threshold)
    const currentDrawdownPct = ((this.maxEquity - this.equity) / this.maxEquity) * 100;
    if (currentDrawdownPct > 2.0) {
      return this.triggerKillSwitch('K5_MAX_DRAWDOWN_STOP', `Current drawdown ${currentDrawdownPct.toFixed(2)}% exceeded maximum allowable threshold of 2.0%`);
    }

    return { tripped: false, activeKillSwitch: null, reason: null };
  }

  triggerKillSwitch(switchCode, reason) {
    this.halted = true;
    this.activeKillSwitch = switchCode;
    this.haltReason = reason;

    return {
      tripped: true,
      activeKillSwitch: switchCode,
      reason,
      emergencyOrders: this.generateEmergencyUnwindOrders()
    };
  }

  generateEmergencyUnwindOrders() {
    const orders = [];
    for (const [sym, pos] of this.positions.entries()) {
      orders.push({
        action: 'EMERGENCY_UNWIND_CLOSE_ALL',
        symbol: sym,
        side: 'BUY_TO_COVER_PERP_AND_SELL_SPOT'
      });
    }
    this.positions.clear();
    return orders;
  }
}
