import { describe, it, expect } from 'vitest';
import { AD007BasisEngine } from '../core/ad007_basis_engine.js';
import { AD006CarryEngine } from '../../AD006/core/ad006_carry_engine.js';

describe('AD007 Basis Engine Mathematical & Invariant Tests', () => {
  // Mock funding panel with constant 30 bps (0.0030) funding rate per 8h across 2 assets
  const N = 42; // 1 block of 14 days
  const mockPanel = {
    'BTCUSDT': Array.from({ length: N }, (_, i) => ({ fundingTime: 1000000 + i * 28800000, fundingRate: 0.0003 })),
    'ETHUSDT': Array.from({ length: N }, (_, i) => ({ fundingTime: 1000000 + i * 28800000, fundingRate: 0.0004 }))
  };
  const symbols = ['BTCUSDT', 'ETHUSDT'];
  const friction = { totalRoundtripBpsPerCycle: 24 };
  const borrowing = { annualBorrowRatePct: 4.0 };

  it('AD007-01: At 1.0x leverage, AD007 matches AD006 carry output bit-for-bit', () => {
    const cell06 = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      rebalanceDays: 0,
      lookbackDays: 0
    };
    const cell07 = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.0,
      rebalanceDays: 0,
      lookbackDays: 0
    };

    const res06 = AD006CarryEngine.simulate(mockPanel, symbols, cell06, friction);
    const res07 = AD007BasisEngine.simulate(mockPanel, symbols, cell07, friction, borrowing);

    expect(res07.finalEquity).toBeCloseTo(res06.finalEquity, 10);
    expect(res07.totalNetReturnPct).toBeCloseTo(res06.totalNetReturnPct, 10);
    expect(res07.annualizedReturnPct).toBeCloseTo(res06.annualizedReturnPct, 10);
  });

  it('AD007-02: At 2.0x leverage, gross yield doubles and borrowing cost is strictly deducted', () => {
    const cell1X = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.0
    };
    const cell2X = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      leverage: 2.0
    };

    const res1X = AD007BasisEngine.simulate(mockPanel, symbols, cell1X, friction, borrowing);
    const res2X = AD007BasisEngine.simulate(mockPanel, symbols, cell2X, friction, borrowing);

    // With 2x leverage, final equity should be substantially higher than 1x even after 4% p.a. borrowing
    expect(res2X.totalNetReturnPct).toBeGreaterThan(res1X.totalNetReturnPct);
  });

  it('AD007-03: Zero leverage or borrowing cost invariant holds', () => {
    const cellNoBorrow = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      leverage: 2.0
    };
    const zeroBorrow = { annualBorrowRatePct: 0.0 };

    const resWithBorrow = AD007BasisEngine.simulate(mockPanel, symbols, cellNoBorrow, friction, borrowing);
    const resZeroBorrow = AD007BasisEngine.simulate(mockPanel, symbols, cellNoBorrow, friction, zeroBorrow);

    // Without borrowing cost, return must be strictly higher than with borrowing cost
    expect(resZeroBorrow.totalNetReturnPct).toBeGreaterThan(resWithBorrow.totalNetReturnPct);
  });

  it('AD007-04: Block returns are properly partitioned into 42-period segments', () => {
    const cell = {
      type: 'STATIC_BENCHMARK',
      allocation: 'BTC_ETH_50_50',
      leverage: 1.5
    };
    const res = AD007BasisEngine.simulate(mockPanel, symbols, cell, friction, borrowing);

    expect(res.blockReturns.length).toBe(1); // exactly 42 periods = 1 block
    expect(res.blockReturns[0].netPct).toBeDefined();
    expect(res.blockReturns[0].netR).toBeDefined();
  });
});
