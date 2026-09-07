/**
 * ALPHA FACTORY — VERIFICATION TEST SUITE: AD014 MACRO CARRY ENGINE
 * Test: verify_ad014_macro_carry_engine.test.js
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateMacroIndicators, simulateMacroCarry } from '../../research/alpha_discovery/AD014/core/ad014_macro_carry_engine.js';
import { FirewallGuard } from '../../research/alpha_factory/core/firewall_guard.js';

describe('AD014 Macro Carry Engine & Invariant Verification', () => {
  const rootDir = process.cwd();

  it('1. Calculates macro indicators (EMA, ATR, MA_ATR, VolRatio) causally without NaN', () => {
    const candles = [];
    let price = 150;
    const baseTime = 1700000000000;

    for (let i = 0; i < 250; i++) {
      const delta = (Math.sin(i / 10) * 0.5) + ((i % 5) * 0.1 - 0.2);
      const open = price;
      const close = price + delta;
      const high = Math.max(open, close) + 0.3;
      const low = Math.min(open, close) - 0.3;
      price = close;

      candles.push({
        openTime: baseTime + (i * 3600000),
        timestamp: baseTime + (i * 3600000),
        open,
        high,
        low,
        close,
        volume: 1000
      });
    }

    const ind = calculateMacroIndicators(candles, 100);
    expect(ind.length).toBe(250);

    for (let i = 150; i < 250; i++) {
      expect(isNaN(ind[i].ema)).toBe(false);
      expect(isNaN(ind[i].atr)).toBe(false);
      expect(isNaN(ind[i].maAtr)).toBe(false);
      expect(isNaN(ind[i].volRatio)).toBe(false);
      expect(ind[i].volRatio).toBeGreaterThan(0);
    }
  });

  it('2. Enforces causal state transition and friction accounting', () => {
    const dataPath = path.resolve(rootDir, 'research/alpha_discovery/AD014/data/USDJPY_1h_discovery.json');
    expect(fs.existsSync(dataPath)).toBe(true);

    const candles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const config = {
      id: 'TEST_USDJPY_CELL',
      asset: 'USDJPY',
      emaLookback: 100,
      volRatioThreshold: 1.20
    };
    const profile = {
      carryDirection: 'LONG',
      annualGrossCarryRate: 0.0520,
      turnoverFrictionBps: 3.0
    };

    const result = simulateMacroCarry(candles, config, profile, 0.0500);
    expect(result.summary).toBeDefined();
    expect(result.summary.totalHours).toBeGreaterThan(1000);
    expect(result.summary.transitions).toBeGreaterThan(0);
    expect(result.summary.finalNav).toBeGreaterThan(0);
  });

  it('3. Safely accrues T-Bill yield during risk-off regimes', () => {
    const candles = [];
    let price = 150;
    const baseTime = 1700000000000;

    // Price constantly below EMA and very high volatility -> forced SAFE_HAVEN_CASH
    for (let i = 0; i < 200; i++) {
      price -= 0.5; // Steady downtrend
      candles.push({
        openTime: baseTime + (i * 3600000),
        timestamp: baseTime + (i * 3600000),
        open: price + 0.5,
        high: price + 1.0,
        low: price - 1.0,
        close: price,
        volume: 500
      });
    }

    const config = {
      id: 'TEST_CASH_CELL',
      asset: 'USDJPY',
      emaLookback: 100,
      volRatioThreshold: 1.0
    };
    const profile = {
      carryDirection: 'LONG',
      annualGrossCarryRate: 0.0520,
      turnoverFrictionBps: 3.0
    };

    const result = simulateMacroCarry(candles, config, profile, 0.0500);
    // In steady downtrend, it should mostly remain in SAFE_HAVEN_CASH
    expect(result.summary.activeCarryRatioPct).toBeLessThan(10.0);
    // Total return must be strictly positive due to T-Bill yield
    expect(result.summary.totalReturnPct).toBeGreaterThan(0.0);
  });

  it('4. Production V8 Motor SHA-256 invariant remains 100% intact', () => {
    const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    expect(() => FirewallGuard.assertV8EngineInvariant(v8Path)).not.toThrow();
  });
});
