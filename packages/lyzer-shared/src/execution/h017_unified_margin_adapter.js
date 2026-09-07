/**
 * LYZER LABS — H017 UNIFIED MARGIN & COLLATERAL ADAPTER
 * Module: h017_unified_margin_adapter.js
 * 
 * Formal Modeling:
 * 1. Multi-Asset Unified Portfolio Margin haircuts (stETH 95%, JitoSOL 90%, sAVAX 85%, USD 100%).
 * 2. Maintenance Margin & Initial Margin calculations for Delta-Neutral Perp hedges.
 * 3. Continuous 4.0% p.a. margin borrowing cost accrual.
 * 4. Real-time LST depeg detection guard against native spot benchmark.
 */

export class H017UnifiedMarginAdapter {
  constructor(config = {}) {
    this.haircuts = {
      stETH: 0.95,
      ETH: 0.95,
      JitoSOL: 0.90,
      SOL: 0.90,
      sAVAX: 0.85,
      AVAX: 0.85,
      BTC: 0.95,
      USDT: 1.00,
      USD: 1.00,
      ...(config.haircuts || {})
    };

    this.annualBorrowRatePct = config.annualBorrowRatePct !== undefined ? config.annualBorrowRatePct : 4.0;
    this.defaultMmrPct = config.defaultMmrPct !== undefined ? config.defaultMmrPct : 2.5; // 2.5% maintenance margin
    this.depegThresholdPct = config.depegThresholdPct !== undefined ? config.depegThresholdPct : 1.5; // 1.5% max depeg discount
    this.minHealthyMarginRatio = config.minHealthyMarginRatio !== undefined ? config.minHealthyMarginRatio : 1.30;
  }

  /**
   * Get collateral discount haircut for a specific asset.
   * @param {string} asset 
   * @returns {number} Haircut factor between 0.0 and 1.0
   */
  getHaircut(asset) {
    const cleanSym = asset.replace(/USDT$/, '').replace(/USD$/, '');
    return this.haircuts[cleanSym] !== undefined ? this.haircuts[cleanSym] : (this.haircuts[asset] || 0.80);
  }

  /**
   * Calculate total effective collateral value after institutional haircuts.
   * @param {Object} balances - Map of asset -> quantity
   * @param {Object} prices - Map of asset -> price in USD
   * @returns {number} Total discounted collateral value in USD
   */
  calculateCollateralValue(balances, prices) {
    let totalValue = 0;
    for (const [asset, qty] of Object.entries(balances)) {
      if (qty <= 0) continue;
      const price = prices[asset] || (asset === 'USDT' || asset === 'USD' ? 1.0 : 0);
      const haircut = this.getHaircut(asset);
      totalValue += qty * price * haircut;
    }
    return totalValue;
  }

  /**
   * Calculate total maintenance margin required across all short perp positions.
   * @param {Object} positions - Map of perpSymbol -> notionalUSD
   * @returns {number} Maintenance margin in USD
   */
  calculateMaintenanceMargin(positions) {
    let totalMmr = 0;
    for (const notional of Object.values(positions)) {
      totalMmr += Math.abs(notional) * (this.defaultMmrPct / 100);
    }
    return totalMmr;
  }

  /**
   * Calculate margin health score (Total Collateral Value / Maintenance Margin).
   * @param {number} collateralValueUSD 
   * @param {number} maintenanceMarginUSD 
   * @returns {number} Ratio (Infinity if no positions open)
   */
  calculateMarginHealthRatio(collateralValueUSD, maintenanceMarginUSD) {
    if (maintenanceMarginUSD <= 0) return Infinity;
    return collateralValueUSD / maintenanceMarginUSD;
  }

  /**
   * Check margin health against risk policy floor.
   * @param {number} collateralValueUSD 
   * @param {number} maintenanceMarginUSD 
   * @returns {Object} Health check report
   */
  checkMarginHealth(collateralValueUSD, maintenanceMarginUSD) {
    const ratio = this.calculateMarginHealthRatio(collateralValueUSD, maintenanceMarginUSD);
    const healthy = ratio >= this.minHealthyMarginRatio;
    return {
      healthy,
      ratio: Number(ratio.toFixed(4)),
      needsDeleveraging: !healthy,
      collateralValueUSD,
      maintenanceMarginUSD
    };
  }

  /**
   * Calculate continuous borrowing interest cost.
   * @param {number} borrowedUSD 
   * @param {number} elapsedSeconds 
   * @returns {number} Accrued borrow cost in USD
   */
  calculateBorrowingInterest(borrowedUSD, elapsedSeconds) {
    if (borrowedUSD <= 0 || elapsedSeconds <= 0) return 0;
    const ratePerSecond = (this.annualBorrowRatePct / 100) / (365 * 86400);
    return borrowedUSD * ratePerSecond * elapsedSeconds;
  }

  /**
   * Detect LST depeg against native spot underlying price.
   * @param {number} lstPrice - Market price of Liquid Staking Token
   * @param {number} nativePrice - Market price of underlying native token (e.g. ETH for stETH)
   * @param {number} expectedRatio - Theoretical redemption ratio (default 1.0 for rebasing LSTs like stETH)
   * @returns {Object} Depeg analysis result
   */
  checkDepeg(lstPrice, nativePrice, expectedRatio = 1.0) {
    if (!nativePrice || nativePrice <= 0 || !lstPrice || lstPrice <= 0) {
      return { depegDetected: false, discountPct: 0 };
    }
    const fairPrice = nativePrice * expectedRatio;
    const discountPct = ((fairPrice - lstPrice) / fairPrice) * 100;
    const depegDetected = discountPct > this.depegThresholdPct;
    return {
      depegDetected,
      discountPct: Number(discountPct.toFixed(3)),
      fairPrice,
      observedPrice: lstPrice,
      thresholdPct: this.depegThresholdPct
    };
  }
}
