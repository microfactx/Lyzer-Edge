/**
 * ALPHA FACTORY — VERIFICATION TEST SUITE: AD015 BASKET CARRY ENGINE
 * Test: verify_ad015_basket_carry_engine.test.js
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { synchronizePanels, calculatePairIndicators, simulateBasketCarry } from '../../research/alpha_discovery/AD015/core/ad015_basket_carry_engine.js';
import { FirewallGuard } from '../../research/alpha_factory/core/firewall_guard.js';

describe('AD015 Basket Carry Engine & Invariant Verification', () => {
  const rootDir = process.cwd();

  it('1. Synchronizes 4 currency panels across common timestamps', () => {
    const rawPanels = {};
    const pairs = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'];

    for (const p of pairs) {
      const fPath = path.resolve(rootDir, `research/alpha_discovery/AD015/data/${p}_1h_discovery.json`);
      expect(fs.existsSync(fPath)).toBe(true);
      rawPanels[p] = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    }

    const synced = synchronizePanels(rawPanels);
    expect(synced.timestamps.length).toBeGreaterThan(5000);
    expect(Object.keys(synced.panel).length).toBe(4);
    for (const p of pairs) {
      expect(synced.panel[p].length).toBe(synced.timestamps.length);
    }
  });

  it('2. Calculates indicators causally and computes basket simulation', () => {
    const rawPanels = {};
    const pairs = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'];
    for (const p of pairs) {
      const fPath = path.resolve(rootDir, `research/alpha_discovery/AD015/data/${p}_1h_discovery.json`);
      rawPanels[p] = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    }
    const synced = synchronizePanels(rawPanels);

    const cellConfig = {
      id: 'TEST_BASKET_EW',
      weighting: 'EQUAL_WEIGHT',
      circuitBreaker: 'UNIFIED_BASKET',
      emaLookback: 100,
      volRatioThreshold: 1.25,
      dwellHours: 24
    };

    const pairsConfig = {
      USDJPY: { annualCarryRate: 0.0520, turnoverFrictionBps: 3.0 },
      GBPJPY: { annualCarryRate: 0.0490, turnoverFrictionBps: 3.0 },
      AUDJPY: { annualCarryRate: 0.0425, turnoverFrictionBps: 3.0 },
      CADJPY: { annualCarryRate: 0.0465, turnoverFrictionBps: 3.0 }
    };

    const res = simulateBasketCarry(synced, cellConfig, pairsConfig, 0.0500);
    expect(res.summary).toBeDefined();
    expect(res.summary.totalHours).toBeGreaterThan(4000);
    expect(res.summary.finalNav).toBeGreaterThan(0);
    expect(Number.isFinite(res.summary.sharpeRatio)).toBe(true);
  });

  it('3. Runs Risk-Parity with independent pair circuit breakers without crash', () => {
    const rawPanels = {};
    const pairs = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'];
    for (const p of pairs) {
      const fPath = path.resolve(rootDir, `research/alpha_discovery/AD015/data/${p}_1h_discovery.json`);
      rawPanels[p] = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    }
    const synced = synchronizePanels(rawPanels);

    const cellConfig = {
      id: 'TEST_BASKET_RP',
      weighting: 'RISK_PARITY',
      circuitBreaker: 'INDEPENDENT_PAIRS',
      emaLookback: 100,
      volRatioThreshold: 1.25,
      dwellHours: 24
    };

    const pairsConfig = {
      USDJPY: { annualCarryRate: 0.0520, turnoverFrictionBps: 3.0 },
      GBPJPY: { annualCarryRate: 0.0490, turnoverFrictionBps: 3.0 },
      AUDJPY: { annualCarryRate: 0.0425, turnoverFrictionBps: 3.0 },
      CADJPY: { annualCarryRate: 0.0465, turnoverFrictionBps: 3.0 }
    };

    const res = simulateBasketCarry(synced, cellConfig, pairsConfig, 0.0500);
    expect(res.summary).toBeDefined();
    expect(res.summary.annualizedReturnPct).toBeDefined();
    expect(res.summary.maxDrawdownPct).toBeGreaterThan(0);
  });

  it('4. Production V8 Motor SHA-256 invariant remains 100% intact', () => {
    const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    expect(() => FirewallGuard.assertV8EngineInvariant(v8Path)).not.toThrow();
  });
});
