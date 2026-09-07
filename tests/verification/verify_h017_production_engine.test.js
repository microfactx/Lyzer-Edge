import { describe, it, expect } from 'vitest';
import { H017UnifiedMarginAdapter } from '../../packages/lyzer-shared/src/execution/h017_unified_margin_adapter.js';
import { H017ProductionCarryModule } from '../../packages/lyzer-shared/src/execution/h017_production_carry_module.js';

describe('H017 Stage 3 Production Engine & Unified Margin Verification Suite', () => {
  describe('1. Unified Margin & Collateral Adapter Invariants', () => {
    const adapter = new H017UnifiedMarginAdapter();

    it('G-PROD-01: Correctly applies institutional haircuts per asset tier', () => {
      expect(adapter.getHaircut('stETH')).toBe(0.95);
      expect(adapter.getHaircut('ETHUSDT')).toBe(0.95);
      expect(adapter.getHaircut('JitoSOL')).toBe(0.90);
      expect(adapter.getHaircut('SOLUSDT')).toBe(0.90);
      expect(adapter.getHaircut('sAVAX')).toBe(0.85);
      expect(adapter.getHaircut('BTCUSDT')).toBe(0.95);
      expect(adapter.getHaircut('USDT')).toBe(1.00);
      expect(adapter.getHaircut('UNKNOWN')).toBe(0.80);
    });

    it('G-PROD-02: Accurately calculates total discounted collateral value', () => {
      // 10 stETH at $3000 (haircut 0.95) = $28,500
      // 100 JitoSOL at $150 (haircut 0.90) = $13,500
      // 5,000 USDT at $1.00 (haircut 1.00) = $5,000
      // Total expected: $47,000
      const balances = { stETH: 10, JitoSOL: 100, USDT: 5000 };
      const prices = { stETH: 3000, JitoSOL: 150, USDT: 1.0 };

      const collateralVal = adapter.calculateCollateralValue(balances, prices);
      expect(collateralVal).toBe(47000);
    });

    it('G-PROD-03: Computes maintenance margin and health ratio accurately', () => {
      // Short ETH perp notional: $50,000. MMR = 2.5% -> $1,250
      // Collateral value: $47,000
      // Ratio = 47,000 / 1,250 = 37.6 (extremely healthy)
      const positions = { ETHUSDT: 50000 };
      const mmr = adapter.calculateMaintenanceMargin(positions);
      expect(mmr).toBe(1250);

      const health = adapter.checkMarginHealth(47000, mmr);
      expect(health.healthy).toBe(true);
      expect(health.ratio).toBe(37.6);
      expect(health.needsDeleveraging).toBe(false);
    });

    it('G-PROD-04: Accrues continuous borrowing interest at exact 4.0% p.a. rate', () => {
      // Borrowing $10,000 for 1 full year (365 days = 31,536,000s) -> should be $400.00
      const interest1Year = adapter.calculateBorrowingInterest(10000, 365 * 86400);
      expect(interest1Year).toBeCloseTo(400.0, 2);

      // Borrowing $10,000 for 30 days -> $32.88
      const interest30Days = adapter.calculateBorrowingInterest(10000, 30 * 86400);
      expect(interest30Days).toBeCloseTo(32.8767, 2);
    });

    it('G-PROD-05: Depeg guard triggers when LST discount exceeds threshold', () => {
      // Normal: stETH at $2990 when ETH is $3000 -> 0.33% discount (within 1.5%)
      const normal = adapter.checkDepeg(2990, 3000);
      expect(normal.depegDetected).toBe(false);
      expect(normal.discountPct).toBeCloseTo(0.333, 2);

      // Depeg crisis: stETH drops to $2940 when ETH is $3000 -> 2.0% discount (> 1.5%)
      const depeg = adapter.checkDepeg(2940, 3000);
      expect(depeg.depegDetected).toBe(true);
      expect(depeg.discountPct).toBe(2.0);
    });
  });

  describe('2. Production Carry Module Lifecycle & Invariants', () => {
    it('G-PROD-06: Initial rebalance triggers Top-2 allocation and atomic dual-leg orders', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000 });
      const now = 1735689600000; // 2025-01-01T00:00:00Z

      const trailingRates = {
        SOLUSDT: 14.5, // Funding 8.5% + Staking 6.0%
        ETHUSDT: 11.2, // Funding 7.7% + Staking 3.5%
        AVAXUSDT: 9.0,
        BTCUSDT: 6.0
      };

      const prices = {
        SOLUSDT: 150,
        ETHUSDT: 3000,
        AVAXUSDT: 35,
        BTCUSDT: 90000
      };

      const plan = module.evaluateRebalance(now, trailingRates, prices);
      expect(plan.triggered).toBe(true);
      expect(plan.selectedAssets).toEqual(['SOLUSDT', 'ETHUSDT']);
      expect(plan.atomicOrders.length).toBe(2);

      // Verify atomic orders are delta neutral
      for (const ord of plan.atomicOrders) {
        expect(ord.deltaNeutral).toBe(true);
        expect(ord.legs.spotLeg.side).toBe('BUY');
        expect(ord.legs.perpLeg.side).toBe('SELL_SHORT');
        expect(ord.notionalUSD).toBe(10000); // $10,000 equity / 2 slots * 2.0x lev = $10,000 per asset
      }
    });

    it('G-PROD-07: Respects discrete 30-day rebalance interval', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000 });
      const t0 = 1735689600000;
      const trailingRates = { SOLUSDT: 14.5, ETHUSDT: 11.2 };
      const prices = { SOLUSDT: 150, ETHUSDT: 3000 };

      module.evaluateRebalance(t0, trailingRates, prices);

      // 15 days later -> should NOT trigger
      const t15 = t0 + 15 * 24 * 3600 * 1000;
      const plan15 = module.evaluateRebalance(t15, trailingRates, prices);
      expect(plan15.triggered).toBe(false);
      expect(plan15.reason).toBe('REBALANCE_INTERVAL_NOT_ELAPSED');

      // 30 days later -> SHOULD trigger
      const t30 = t0 + 30 * 24 * 3600 * 1000;
      const plan30 = module.evaluateRebalance(t30, trailingRates, prices);
      expect(plan30.triggered).toBe(true);
    });

    it('G-PROD-08: Buffer of 2.0% prevents churn when challenger edge is insufficient', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000, bufferPct: 2.0 });
      const t0 = 1735689600000;
      const trailingRates1 = { SOLUSDT: 14.0, ETHUSDT: 11.0, AVAXUSDT: 9.0 };
      const prices = { SOLUSDT: 150, ETHUSDT: 3000, AVAXUSDT: 35 };

      module.evaluateRebalance(t0, trailingRates1, prices);
      expect(Array.from(module.positions.keys())).toEqual(['SOLUSDT', 'ETHUSDT']);

      // 30 days later: AVAX rises to 12.0% (beats ETH's 11.0% by 1.0%, but buffer is 2.0%)
      const t30 = t0 + 30 * 24 * 3600 * 1000;
      const trailingRates2 = { SOLUSDT: 14.0, ETHUSDT: 11.0, AVAXUSDT: 12.0 };
      const plan30 = module.evaluateRebalance(t30, trailingRates2, prices);

      // ETH must be kept because AVAX edge (1.0%) < buffer (2.0%)
      expect(Array.from(module.positions.keys())).toEqual(['SOLUSDT', 'ETHUSDT']);
      expect(plan30.atomicOrders.length).toBe(0); // Zero turnover orders generated
    });

    it('G-PROD-09: Accrues funding settlement, staking yield, and borrowing costs', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000 });
      const t0 = 1735689600000;
      const trailingRates = { SOLUSDT: 14.0, ETHUSDT: 11.0 };
      const prices = { SOLUSDT: 150, ETHUSDT: 3000 };

      module.evaluateRebalance(t0, trailingRates, prices);

      const eqBefore = module.equity;

      // 1. Funding settlement for 8 hours (rate = 0.0001 per 8h = 0.01%)
      const netFunding = module.applyFundingSettlement({ SOLUSDT: 0.0001, ETHUSDT: 0.0001 }, 8);
      expect(netFunding).toBeGreaterThan(0);
      expect(module.equity).toBeGreaterThan(eqBefore);

      // 2. Staking yield for 30 days
      const eqBeforeStaking = module.equity;
      const stakingEarned = module.applyStakingYield(30);
      expect(stakingEarned).toBeGreaterThan(0);
      expect(module.equity).toBeGreaterThan(eqBeforeStaking);

      // 3. Borrowing cost for 30 days
      const eqBeforeBorrow = module.equity;
      const borrowCost = module.applyBorrowingCost(30 * 86400);
      expect(borrowCost).toBeGreaterThan(0);
      expect(module.equity).toBeLessThan(eqBeforeBorrow);
    });

    it('G-PROD-10: Kill Switch K1 (Depeg Guard) triggers emergency unwinding', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000 });
      const t0 = 1735689600000;
      const trailingRates = { SOLUSDT: 14.0, ETHUSDT: 11.0 };
      const prices = { SOLUSDT: 150, ETHUSDT: 3000, stETH: 3000, JitoSOL: 150 };

      module.evaluateRebalance(t0, trailingRates, prices);

      // Simulate stETH severe depeg: drops to $2930 while ETH is $3000 (2.33% discount > 1.5%)
      const crisisPrices = { ...prices, stETH: 2930 };
      const nativePrices = { ETHUSDT: 3000, SOLUSDT: 150 };

      const check = module.checkKillSwitches(crisisPrices, nativePrices);
      expect(check.tripped).toBe(true);
      expect(check.activeKillSwitch).toBe('K1_LST_DEPEG');
      expect(module.halted).toBe(true);
      expect(module.positions.size).toBe(0); // Positions unwound
      expect(check.emergencyOrders.length).toBeGreaterThan(0);
    });

    it('G-PROD-11: Kill Switch K5 (Catastrophic Drawdown Stop) trips at 2.0% drawdown', () => {
      const module = new H017ProductionCarryModule({ initialCapital: 10000 });
      module.maxEquity = 10000;
      module.equity = 9750; // 2.5% drawdown

      const check = module.checkKillSwitches({}, {});
      expect(check.tripped).toBe(true);
      expect(check.activeKillSwitch).toBe('K5_MAX_DRAWDOWN_STOP');
      expect(module.halted).toBe(true);
    });
  });
});
