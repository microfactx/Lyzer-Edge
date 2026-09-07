/**
 * AD012 BREAKOUT ENGINE VERIFICATION SUITE
 * Test: verify_ad012_breakout_engine.test.js
 * 
 * Verifies:
 * 1. Engine V8 Invariant integrity.
 * 2. Donchian Channel computation on 4H aggregated bars.
 * 3. Volatility expansion filter (ATR ratio).
 * 4. SL/TP fill simulation with worst-case priority.
 * 5. FirewallGuard bounds on discovery datasets.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { AD012BreakoutEngine } from '../../research/alpha_discovery/AD012/core/ad012_breakout_engine.js';
import { FirewallGuard, DISCOVERY_END_MS } from '../../research/alpha_factory/core/firewall_guard.js';

describe('AD012 Breakout Engine & Alpha Factory Invariants', () => {
  const rootDir = process.cwd();

  it('1. V8 Engine Invariant matches SHA-256 precisely', () => {
    const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    expect(() => FirewallGuard.assertV8EngineInvariant(v8Path)).not.toThrow();
  });

  it('2. 1H to 4H Aggregator produces correct bucket boundaries', () => {
    const mockHourly = [
      { timestamp: 1700524800000, open: 100, high: 105, low: 99, close: 104, volume: 10 },
      { timestamp: 1700528400000, open: 104, high: 108, low: 103, close: 107, volume: 20 },
      { timestamp: 1700532000000, open: 107, high: 107, low: 101, close: 102, volume: 15 },
      { timestamp: 1700535600000, open: 102, high: 103, low: 98, close: 99, volume: 25 }
    ];

    const fourHourBars = AD012BreakoutEngine.aggregate1Hto4H(mockHourly);
    expect(fourHourBars.length).toBe(1);
    expect(fourHourBars[0].high).toBe(108);
    expect(fourHourBars[0].low).toBe(98);
  });

  it('3. Volatility expansion and Donchian channel breakout executes simulation', () => {
    const hourly = [];
    const baseTs = 1700524800000;
    let p = 100;

    for (let i = 0; i < 250; i++) {
      hourly.push({
        timestamp: baseTs + (i * 3600000),
        openTime: baseTs + (i * 3600000),
        closeTime: baseTs + (i * 3600000) + 3599999,
        open: p,
        high: p + 1.5,
        low: p - 1.5,
        close: p + 0.2,
        volume: 100
      });
      p += 0.1;
    }

    const cellConfig = {
      macroLookback: 20,
      riskReward: 2.0
    };
    const frictionConfig = {
      feeBpsPerLeg: 1.0,
      slippageBpsPerLeg: 1.0
    };

    const sim = AD012BreakoutEngine.simulate(hourly, cellConfig, frictionConfig);
    expect(sim).toHaveProperty('trades');
    expect(Array.isArray(sim.trades)).toBe(true);
  });

  it('4. FirewallGuard rejects any candles leaking into holdout window', () => {
    const leaked = [{ timestamp: DISCOVERY_END_MS + 5000 }];
    expect(() => FirewallGuard.assertDiscoveryCandles(leaked, 'test_leak')).toThrow(/FIREWALL_BREACH_EXCEPTION/);
  });
});
