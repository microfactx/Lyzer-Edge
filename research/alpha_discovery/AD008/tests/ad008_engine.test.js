import { describe, it, expect } from 'vitest';
import { AD008GatedEngine } from '../core/ad008_gated_engine.js';

describe('AD008 Regime-Gated Basis Engine Unit Tests', () => {
  // Mock synthetic 8H funding panel
  function makeMockPanel(fundingValues) {
    const records = fundingValues.map((rate, i) => ({
      fundingTime: 1672531200000 + i * 8 * 3600 * 1000,
      fundingRate: rate
    }));
    return {
      BTCUSDT: records,
      ETHUSDT: records
    };
  }

  it('G-ENG-01: Correctly activates when trailing funding >= entryThreshold', () => {
    // 10 periods of 0 funding, then 30 periods of high funding (0.0003 ~ 32.8% a.a.)
    const vals = new Array(50).fill(0.0);
    for (let i = 25; i < 50; i++) vals[i] = 0.0003; // ~32.8% a.a.

    const panel = makeMockPanel(vals);
    const cell = {
      id: 'TEST_GATED_01',
      type: 'GATED_STATIC',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.0,
      gating: {
        enabled: true,
        entryThresholdAnnPct: 8.0,
        exitThresholdAnnPct: 4.0,
        lookbackDays: 7
      }
    };
    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const res = AD008GatedEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT'], cell, friction, borrowing);
    expect(res.activeFractionPct).toBeGreaterThan(0);
    expect(res.activeFractionPct).toBeLessThan(100);
    expect(res.transitions).toBeGreaterThan(0);
  });

  it('G-ENG-02: Zero borrowing cost paid during unallocated periods', () => {
    // Zero funding throughout -> strategy should never activate
    const vals = new Array(60).fill(0.0);
    const panel = makeMockPanel(vals);

    const cell = {
      id: 'TEST_GATED_02',
      type: 'GATED_STATIC',
      allocation: 'BTC_ETH_50_50',
      leverage: 2.0,
      gating: {
        enabled: true,
        entryThresholdAnnPct: 10.0,
        exitThresholdAnnPct: 5.0,
        lookbackDays: 7
      }
    };
    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 10.0 }; // high borrowing rate

    const res = AD008GatedEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT'], cell, friction, borrowing);
    expect(res.activeFractionPct).toBe(0.0);
    expect(res.transitions).toBe(0);
    // With 0% cash return and 0% active, total return should be exactly 0.0%
    expect(res.totalNetReturnPct).toBe(0.0);
  });

  it('G-ENG-03: Hysteresis band prevents premature exit until below exitThreshold', () => {
    // 25 periods high (30%), 10 periods moderate (6%), 15 periods low (1%)
    const vals = new Array(50).fill(0.0003); // ~32.8%
    for (let i = 25; i < 35; i++) vals[i] = 0.00006; // ~6.5% (between 5% and 8%)
    for (let i = 35; i < 50; i++) vals[i] = 0.00001; // ~1% (< 5%)

    const panel = makeMockPanel(vals);
    const cell = {
      id: 'TEST_GATED_03',
      type: 'GATED_STATIC',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.0,
      gating: {
        enabled: true,
        entryThresholdAnnPct: 8.0,
        exitThresholdAnnPct: 5.0,
        lookbackDays: 7
      }
    };
    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const res = AD008GatedEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT'], cell, friction, borrowing);
    expect(res.activeFractionPct).toBeGreaterThan(50);
  });

  it('G-ENG-04: Dynamic selection correctly filters only assets meeting hurdle', () => {
    const btcVals = new Array(50).fill(0.00001); // 1% a.a. (below hurdle)
    const ethVals = new Array(50).fill(0.0002);  // 21.9% a.a. (above hurdle)

    const panel = {
      BTCUSDT: btcVals.map((r, i) => ({ fundingTime: 1672531200000 + i * 8 * 3600 * 1000, fundingRate: r })),
      ETHUSDT: ethVals.map((r, i) => ({ fundingTime: 1672531200000 + i * 8 * 3600 * 1000, fundingRate: r }))
    };

    const cell = {
      id: 'TEST_GATED_04',
      type: 'GATED_DYNAMIC_SELECTION',
      allocation: 'TOP_2_ABOVE_HURDLE',
      leverage: 1.5,
      gating: {
        enabled: true,
        entryThresholdAnnPct: 8.0,
        exitThresholdAnnPct: 5.0,
        lookbackDays: 7
      }
    };
    const friction = { totalRoundtripBpsPerCycle: 24 };
    const borrowing = { annualBorrowRatePct: 4.0 };

    const res = AD008GatedEngine.simulate(panel, ['BTCUSDT', 'ETHUSDT'], cell, friction, borrowing);
    expect(res.totalNetReturnPct).toBeGreaterThan(0);
  });
});
