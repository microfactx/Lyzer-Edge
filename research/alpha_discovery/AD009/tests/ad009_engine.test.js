import { describe, it, expect } from 'vitest';
import { AD009SpreadEngine } from '../core/ad009_spread_engine.js';

describe('AD009 Spread & Friction-Buffered Carry Engine Unit Tests', () => {
  function makeMockPanel(rateMap) {
    const panel = {};
    const syms = Object.keys(rateMap);
    for (const sym of syms) {
      panel[sym] = rateMap[sym].map((rate, i) => ({
        fundingTime: 1672531200000 + i * 8 * 3600 * 1000,
        fundingRate: rate
      }));
    }
    return panel;
  }

  it('G-ENG-01: Correctly selects Top-K assets above hurdle', () => {
    // 60 periods
    // BTC: 10% a.a. (rate = 0.0000913)
    // ETH: 15% a.a. (rate = 0.000137)
    // SOL: 2% a.a. (rate = 0.000018)
    const rateBTC = 10 / (365 * 3 * 100);
    const rateETH = 15 / (365 * 3 * 100);
    const rateSOL = 2 / (365 * 3 * 100);

    const panel = makeMockPanel({
      BTCUSDT: new Array(60).fill(rateBTC),
      ETHUSDT: new Array(60).fill(rateETH),
      SOLUSDT: new Array(60).fill(rateSOL)
    });

    const cell = {
      id: 'TEST_TOP2',
      type: 'BUFFERED_DYNAMIC',
      topK: 2,
      leverage: 'DYNAMIC_SPREAD',
      maxLeverage: 2.0,
      lookbackDays: 7,
      rebalanceDays: 7,
      bufferPct: 2.0,
      hurdlePct: 3.0
    };

    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const res = AD009SpreadEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], cell, friction, borrowing);
    expect(res.annReturnPct).toBeGreaterThan(5.0);
    expect(res.percentActive).toBeGreaterThan(50);
  });

  it('G-ENG-02: Buffer inertia prevents turnover when challenger rate < incumbent + buffer', () => {
    // 90 periods
    // Incumbent A has 10% a.a.
    // Challenger B starts at 8%, rises to 11% (difference is 1%, below buffer of 2%)
    const rate10 = 10 / (365 * 3 * 100);
    const rate08 = 8 / (365 * 3 * 100);
    const rate11 = 11 / (365 * 3 * 100);

    const aRates = new Array(90).fill(rate10);
    const bRates = new Array(90).fill(rate08);
    for (let i = 45; i < 90; i++) bRates[i] = rate11; // 11% vs 10% -> diff = 1.0% < buffer (2.0%)

    const panel = makeMockPanel({
      ASSET_A: aRates,
      ASSET_B: bRates
    });

    const cellBuffered = {
      id: 'TEST_BUFFERED',
      type: 'BUFFERED_DYNAMIC',
      topK: 1,
      leverage: 1.0,
      maxLeverage: 1.0,
      lookbackDays: 7,
      rebalanceDays: 7,
      bufferPct: 2.0, // Requires at least +2% spread to switch
      hurdlePct: 3.0
    };

    const cellUnbuffered = {
      id: 'TEST_UNBUFFERED',
      type: 'BUFFERED_DYNAMIC',
      topK: 1,
      leverage: 1.0,
      maxLeverage: 1.0,
      lookbackDays: 7,
      rebalanceDays: 7,
      bufferPct: 0.0, // Switches as soon as challenger is 0.001% higher
      hurdlePct: 3.0
    };

    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const resBuffered = AD009SpreadEngine.simulate(panel, ['ASSET_A', 'ASSET_B'], cellBuffered, friction, borrowing);
    const resUnbuffered = AD009SpreadEngine.simulate(panel, ['ASSET_A', 'ASSET_B'], cellUnbuffered, friction, borrowing);

    // Buffered engine must have fewer turnover events than unbuffered
    expect(resBuffered.turnoverEventsCount).toBeLessThan(resUnbuffered.turnoverEventsCount);
    expect(resBuffered.turnoverFeePct).toBeLessThan(resUnbuffered.turnoverFeePct);
  });

  it('G-ENG-03: Spread-sensitive leverage scales down to 1.0x when funding compresses', () => {
    // Borrow rate is 4.0%.
    // If rate >= 8.0%, lev = 2.0
    // If rate = 6.0%, lev = 1.5
    // If rate = 3.5%, lev = 1.0
    expect(AD009SpreadEngine.calculateLeverage(10.0, 4.0, 2.0, 'DYNAMIC_SPREAD')).toBe(2.0);
    expect(AD009SpreadEngine.calculateLeverage(6.0, 4.0, 2.0, 'DYNAMIC_SPREAD')).toBe(1.5);
    expect(AD009SpreadEngine.calculateLeverage(3.5, 4.0, 2.0, 'DYNAMIC_SPREAD')).toBe(1.0);
  });

  it('G-ENG-04: Zero borrowing cost paid when unleveraged (1.0x)', () => {
    // 60 periods of 0% funding. With 1.0x leverage and 10% borrow rate, 0 borrow fee paid.
    const panel = makeMockPanel({
      BTCUSDT: new Array(60).fill(0.0),
      ETHUSDT: new Array(60).fill(0.0)
    });

    const cell = {
      id: 'TEST_ZERO_BORROW',
      type: 'STATIC_CONTROL',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.0,
      maxLeverage: 1.0
    };

    const friction = { totalRoundtripBpsPerCycle: 0 };
    const borrowing = { annualBorrowRatePct: 10.0 };

    const res = AD009SpreadEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT'], cell, friction, borrowing);
    expect(res.totalReturnPct).toBe(0.0);
    expect(res.annReturnPct).toBe(0.0);
  });

  it('G-ENG-05: Unhedged cross-perp ablation exhibits price divergence drawdown', () => {
    const N = 60;
    const rateHigh = 15 / (365 * 3 * 100);
    const rateLow = 1 / (365 * 3 * 100);

    const panel = makeMockPanel({
      ASSET_HIGH: new Array(N).fill(rateHigh),
      ASSET_LOW: new Array(N).fill(rateLow)
    });

    // Asset Low price drops 30%, Asset High price rises 20%
    const candles = {
      ASSET_HIGH: Array.from({ length: N }, (_, i) => ({ close: 100 * (1 + 0.2 * (i / N)) })),
      ASSET_LOW: Array.from({ length: N }, (_, i) => ({ close: 100 * (1 - 0.3 * (i / N)) }))
    };

    const cell = {
      id: 'TEST_ABLATION_CROSS',
      type: 'CROSS_PERP_UNHEDGED',
      lookbackDays: 7,
      rebalanceDays: 7
    };

    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const res = AD009SpreadEngine.simulate(panel, ['ASSET_HIGH', 'ASSET_LOW'], cell, friction, borrowing, { annualCashRatePct: 0.0 }, candles);
    // Because price diverged, unhedged spread suffered severe drawdown
    expect(res.maxDrawdownPct).toBeGreaterThan(15.0);
    expect(res.totalReturnPct).toBeLessThan(0.0);
  });
});
