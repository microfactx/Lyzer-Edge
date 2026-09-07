import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { FirewallGuard } from '../../../alpha_factory/core/firewall_guard.js';

describe('H016 Confirmatory Contract & Cryptographic Lock Tests', () => {
  const rootDir = process.cwd();
  const baseDir = path.resolve(rootDir, 'research/alpha_confirmation/H016_BUFFERED_CROSS_CARRY');
  const lockPath = path.join(baseDir, 'preregistration/H016_PREREGISTRATION_LOCK.json');
  const charterPath = path.join(baseDir, 'charter/H016_CONFIRMATORY_CHARTER.md');

  it('G-LOCK-01: Engine V8 SHA-256 invariant matches bit-for-bit', () => {
    const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    expect(() => FirewallGuard.assertV8EngineInvariant(v8Path)).not.toThrow();
  });

  it('G-LOCK-02: Preregistration Lock exists and has valid lifecycle state', () => {
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(lock.hypothesisId).toBe('H016');
    expect(['LOCKED_AWAITING_EXECUTIVE_UNLOCK', 'UNLOCKED']).toContain(lock.status);
    if (lock.status === 'UNLOCKED') {
      expect(lock.executiveUnlockToken).toBeTruthy();
    }
  });

  it('G-LOCK-03: Frozen files match their recorded SHA-256 hashes bit-for-bit', () => {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const [relPath, meta] of Object.entries(lock.frozenFiles)) {
      const fullPath = path.join(baseDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      expect(sha).toBe(meta.sha256);
      expect(buf.length).toBe(meta.sizeBytes);
    }
  });

  it('G-LOCK-04: Confirmatory Charter defines all 5 mandatory constitutional gates', () => {
    expect(fs.existsSync(charterPath)).toBe(true);
    const content = fs.readFileSync(charterPath, 'utf8');
    expect(content).toContain('Gate 1: Rendimento Anualizado Líquido');
    expect(content).toContain('Gate 2: Retorno Total Líquido');
    expect(content).toContain('Gate 3: Índice de Sharpe Anualizado');
    expect(content).toContain('Gate 4: Drawdown Máximo Residual');
    expect(content).toContain('Gate 5: Significância Estatística Primária');
  });

  it('G-LOCK-05: Holdout datasets for all 6 core assets exist and are synchronized', () => {
    const assets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOGEUSDT'];
    for (const a of assets) {
      const p = path.join(baseDir, `holdout_data/${a}_funding_rates.json`);
      expect(fs.existsSync(p)).toBe(true);
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      expect(d.length).toBe(1917);
    }
  });
});
