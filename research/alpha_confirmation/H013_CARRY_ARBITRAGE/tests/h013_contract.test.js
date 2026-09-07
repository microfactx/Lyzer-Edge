import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

describe('H013 Confirmatory Contract & Cryptographic Lock Tests', () => {
  const baseDir = path.resolve(process.cwd(), 'research/alpha_confirmation/H013_CARRY_ARBITRAGE');
  const v8Path = path.resolve(process.cwd(), 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');

  it('G-LOCK-01: Engine V8 SHA-256 matches production invariant', () => {
    const buf = fs.readFileSync(v8Path);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    expect(sha).toBe('fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1');
  });

  it('G-LOCK-02: Preregistration Lock exists and is valid', () => {
    const lockPath = path.join(baseDir, 'preregistration/H013_PREREGISTRATION_LOCK.json');
    expect(fs.existsSync(lockPath)).toBe(true);

    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(lock.hypothesisId).toBe('H013');
    expect(lock.status).toBe('UNLOCKED');
    expect(lock.executiveUnlockToken).toBeTruthy();
  });

  it('G-LOCK-03: Frozen files match their recorded SHA-256 hashes bit-for-bit', () => {
    const lockPath = path.join(baseDir, 'preregistration/H013_PREREGISTRATION_LOCK.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

    for (const [relPath, meta] of Object.entries(lock.fileHashes)) {
      const fullPath = path.join(baseDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      expect(sha).toBe(meta.sha256);
      expect(buf.length).toBe(meta.sizeBytes);
    }
  });

  it('G-LOCK-04: Confirmatory Charter specifies non-adaptive single-hypothesis protocol (M=1)', () => {
    const charterPath = path.join(baseDir, 'charter/H013_CONFIRMATORY_CHARTER.md');
    const content = fs.readFileSync(charterPath, 'utf8');
    expect(content).toContain('M = 1');
    expect(content).toContain('AnnReturn_net >= +6.0%');
    expect(content).toContain('Sharpe >= 5.00');
    expect(content).toContain('MaxDD <= 2.00%');
    expect(content).toContain('p_block < 0.0500');
  });

  it('G-LOCK-05: Holdout datasets for BTCUSDT and ETHUSDT exist and are intact', () => {
    const btcPath = path.join(baseDir, 'holdout_data/BTCUSDT_funding_rates.json');
    const ethPath = path.join(baseDir, 'holdout_data/ETHUSDT_funding_rates.json');
    expect(fs.existsSync(btcPath)).toBe(true);
    expect(fs.existsSync(ethPath)).toBe(true);

    const btc = JSON.parse(fs.readFileSync(btcPath, 'utf8'));
    const eth = JSON.parse(fs.readFileSync(ethPath, 'utf8'));
    expect(btc.length).toBeGreaterThan(1000);
    expect(eth.length).toBeGreaterThan(1000);
    expect(btc.length).toBe(eth.length);
  });
});
