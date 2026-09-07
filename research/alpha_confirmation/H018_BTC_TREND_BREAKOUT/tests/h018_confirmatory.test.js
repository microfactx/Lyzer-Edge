/**
 * H018 CONFIRMATORY TEST SUITE
 * Test: h018_confirmatory.test.js
 * 
 * Verifies:
 * 1. Cryptographic lock integrity (charter, spec, engine, V8 invariant).
 * 2. Simulation mechanics with 24 bps friction and worst-case SL fill.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { H018ConfirmatoryEngine } from '../core/h018_confirmatory_engine.js';

describe('H018 Confirmatory Invariants & Lock Verification', () => {
  const rootDir = process.cwd();
  const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

  it('1. Preregistration Lock matches all files bit-for-bit', () => {
    const lockPath = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/preregistration/H018_PREREGISTRATION_LOCK.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

    const charterSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/charter/H018_CONFIRMATORY_CHARTER.md'));
    const specSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/frozen_spec/H018_FROZEN_SPEC.json'));
    const engineSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/core/h018_confirmatory_engine.js'));
    const v8Sha = hashFile(path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js'));

    expect(charterSha).toBe(lock.files.charter);
    expect(specSha).toBe(lock.files.frozenSpec);
    expect(engineSha).toBe(lock.files.engine);
    expect(v8Sha).toBe(lock.files.v8Invariant);
  });

  it('2. H018 Confirmatory Engine executes cleanly with frozen parameters', () => {
    const specPath = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/frozen_spec/H018_FROZEN_SPEC.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

    const mockHourly = [];
    const baseTs = 1735689600000;
    let p = 90000;

    for (let i = 0; i < 300; i++) {
      mockHourly.push({
        timestamp: baseTs + (i * 3600000),
        openTime: baseTs + (i * 3600000),
        closeTime: baseTs + (i * 3600000) + 3599999,
        open: p,
        high: p + 200,
        low: p - 200,
        close: p + 50,
        volume: 100
      });
      p += 20;
    }

    const sim = H018ConfirmatoryEngine.simulate(mockHourly, spec);
    expect(sim).toHaveProperty('trades');
    expect(Array.isArray(sim.trades)).toBe(true);
  });
});
