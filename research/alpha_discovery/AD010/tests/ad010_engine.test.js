import { describe, it, expect } from 'vitest';
import { AD010ProductiveCarryEngine } from '../core/ad010_productive_carry_engine.js';

describe('AD010 Productive Carry Engine Unit Tests', () => {
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

  const defaultStaking = {
    ETHUSDT: 3.5,
    SOLUSDT: 6.0,
    AVAXUSDT: 5.0,
    BTCUSDT: 0.0
  };

  it('G-ENG-01: Staking yield accumulates positively even when funding is flat zero', () => {
    // 90 periods (30 days) with 0.0 funding rate
    const panel = makeMockPanel({
      ETHUSDT: new Array(90).fill(0.0),
      SOLUSDT: new Array(90).fill(0.0)
    });

    const cell = {
      id: 'TEST_STAKING_PAIR',
      type: 'STATIC_STAKING_PAIR',
      leverage: 1.0
    };

    const friction = { totalRoundtripBpsPerCycle: 0 };
    const borrowing = { annualBorrowRatePct: 4.0 };
    const cashRate = { annualCashRatePct: 4.0 };

    const res = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cell,
      friction,
      borrowing,
      cashRate,
      defaultStaking
    );

    // Staking average: 0.5 * 3.5% + 0.5 * 6.0% = 4.75% a.a.
    expect(res.annReturnPct).toBeGreaterThan(4.5);
    expect(res.annReturnPct).toBeLessThan(5.0);
    expect(res.totalReturnPct).toBeGreaterThan(0.0);
  });

  it('G-ENG-02: Zero borrowing drag is incurred under unleveraged (1.0x) execution', () => {
    // When leverage is 1.0x, borrowing cost formula ((lev - 1.0) * borrowRate) must yield 0.0
    const panel = makeMockPanel({
      ETHUSDT: new Array(90).fill(0.0),
      SOLUSDT: new Array(90).fill(0.0)
    });

    const cell = {
      id: 'TEST_UNLEVERAGED',
      type: 'STATIC_STAKING_PAIR',
      leverage: 1.0
    };

    const friction = { totalRoundtripBpsPerCycle: 0 };
    const borrowingHigh = { annualBorrowRatePct: 25.0 }; // Extreme borrow rate
    const borrowingZero = { annualBorrowRatePct: 0.0 };
    const cashRate = { annualCashRatePct: 0.0 };

    const resHigh = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cell,
      friction,
      borrowingHigh,
      cashRate,
      defaultStaking
    );

    const resZero = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cell,
      friction,
      borrowingZero,
      cashRate,
      defaultStaking
    );

    // Both must match exactly because 1.0x borrows 0
    expect(resHigh.equity).toBeCloseTo(resZero.equity, 8);
  });

  it('G-ENG-03: Friction buffer suppresses churn when challenger edge is within bufferPct', () => {
    // Asset A: 4.0% funding + 3.5% staking = 7.5% gross
    // Asset B: starts at 5.0% gross, then rises to 8.5% gross (diff = 1.0% < buffer of 2.0%)
    const rateA = 4.0 / (365 * 3 * 100);
    const rateB_low = 5.0 / (365 * 3 * 100);
    const rateB_mid = 8.5 / (365 * 3 * 100);

    const aRates = new Array(180).fill(rateA);
    const bRates = new Array(180).fill(rateB_low);
    for (let i = 90; i < 180; i++) bRates[i] = rateB_mid;

    const panel = makeMockPanel({
      ASSET_A: aRates,
      ASSET_B: bRates
    });

    const mockStaking = { ASSET_A: 3.5, ASSET_B: 0.0 };

    const cellBuffered = {
      id: 'TEST_BUFFERED',
      type: 'BUFFERED_DYNAMIC',
      topK: 1,
      leverage: 1.0,
      maxLeverage: 1.0,
      lookbackDays: 14,
      rebalanceDays: 14,
      bufferPct: 2.0, // Needs > 2% excess to switch
      hurdlePct: 3.0
    };

    const cellUnbuffered = {
      id: 'TEST_UNBUFFERED',
      type: 'BUFFERED_DYNAMIC',
      topK: 1,
      leverage: 1.0,
      maxLeverage: 1.0,
      lookbackDays: 14,
      rebalanceDays: 14,
      bufferPct: 0.0, // Churns as soon as challenger > incumbent
      hurdlePct: 3.0
    };

    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };
    const cashRate = { annualCashRatePct: 4.0 };

    const resBuffered = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ASSET_A', 'ASSET_B'],
      cellBuffered,
      friction,
      borrowing,
      cashRate,
      mockStaking
    );

    const resUnbuffered = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ASSET_A', 'ASSET_B'],
      cellUnbuffered,
      friction,
      borrowing,
      cashRate,
      mockStaking
    );

    expect(resBuffered.turnoverEventsCount).toBeLessThan(resUnbuffered.turnoverEventsCount);
    expect(resBuffered.turnoverFeePct).toBeLessThan(resUnbuffered.turnoverFeePct);
  });

  it('G-ENG-04: Ablation test: disabling staking reduces return to raw funding carry', () => {
    // ETH funding = 10% a.a., staking = 3.5%
    const rateETH = 10.0 / (365 * 3 * 100);
    const panel = makeMockPanel({
      ETHUSDT: new Array(90).fill(rateETH),
      SOLUSDT: new Array(90).fill(rateETH)
    });

    const cellStakingOn = {
      id: 'TEST_ON',
      type: 'STATIC_STAKING_PAIR',
      enableStaking: true,
      leverage: 1.0
    };

    const cellStakingOff = {
      id: 'TEST_OFF',
      type: 'STATIC_STAKING_PAIR',
      enableStaking: false,
      leverage: 1.0
    };

    const friction = { totalRoundtripBpsPerCycle: 0 };
    const borrowing = { annualBorrowRatePct: 4.0 };
    const cashRate = { annualCashRatePct: 0.0 };

    const resOn = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cellStakingOn,
      friction,
      borrowing,
      cashRate,
      defaultStaking
    );

    const resOff = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cellStakingOff,
      friction,
      borrowing,
      cashRate,
      defaultStaking
    );

    expect(resOn.annReturnPct).toBeGreaterThan(resOff.annReturnPct);
    // Difference should approximately equal average staking (4.75%)
    const diff = resOn.annReturnPct - resOff.annReturnPct;
    expect(diff).toBeGreaterThan(4.0);
    expect(diff).toBeLessThan(5.5);
  });

  it('G-ENG-05: Cash yield floor accumulates when no asset passes hurdle', () => {
    // Funding rates are deeply negative (-5%) and staking yields are 0, so gross < hurdle (3%)
    const rateNeg = -5.0 / (365 * 3 * 100);
    const panel = makeMockPanel({
      ETHUSDT: new Array(90).fill(rateNeg),
      SOLUSDT: new Array(90).fill(rateNeg)
    });

    const zeroStaking = { ETHUSDT: 0.0, SOLUSDT: 0.0 };

    const cell = {
      id: 'TEST_CASH_FLOOR',
      type: 'BUFFERED_DYNAMIC',
      topK: 2,
      lookbackDays: 7,
      rebalanceDays: 7,
      bufferPct: 2.0,
      hurdlePct: 3.0,
      enableCashYield: true
    };

    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };
    const cashRate = { annualCashRatePct: 4.0 };

    const res = AD010ProductiveCarryEngine.simulate(
      panel,
      ['ETHUSDT', 'SOLUSDT'],
      cell,
      friction,
      borrowing,
      cashRate,
      zeroStaking
    );

    // Because no asset passes hurdle, 100% is kept in cash yielding 4.0% p.a.
    expect(res.percentActive).toBe(0.0);
    expect(res.annReturnPct).toBeGreaterThan(3.8);
    expect(res.annReturnPct).toBeLessThan(4.2);
  });
});
