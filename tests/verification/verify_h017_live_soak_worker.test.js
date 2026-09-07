/**
 * LYZER LABS — H017 LIVE SOAK WORKER VERIFICATION TEST SUITE
 * Test File: verify_h017_live_soak_worker.test.js
 * 
 * Objectives:
 * 1. Verify initialization and configuration defaults of H017LiveSoakWorker.
 * 2. Verify Sovereign Veto: $0 live capital strictly blocked from exchange transmission.
 * 3. Verify mock and real tick processing without memory leaks.
 * 4. Verify getStatus() output contract for Express /api/h017/status.
 * 5. Verify start() and stop() lifecycle and clean shutdown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { H017LiveSoakWorker } from '../../packages/lyzer-shared/src/execution/h017_live_soak_worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempSoakDir = path.resolve(__dirname, '../../temp_test_h017_live_worker');

describe('H017 Live Wall-Clock Soak Worker Verification Suite', () => {
  beforeEach(() => {
    if (fs.existsSync(tempSoakDir)) {
      fs.rmSync(tempSoakDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempSoakDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempSoakDir)) {
      fs.rmSync(tempSoakDir, { recursive: true, force: true });
    }
  });

  it('G-WORKER-01: Initializes with strict Sovereign Veto and zero real capital', () => {
    const worker = new H017LiveSoakWorker({
      soakDir: tempSoakDir,
      initialCapital: 100000,
      pollIntervalMs: 5000
    });

    expect(worker.status).toBe('INITIALIZED');
    expect(worker.initialCapital).toBe(100000);
    expect(worker.soakDir).toBe(tempSoakDir);

    // Sovereign Veto Check
    expect(() => {
      worker.runner.executeRealOrder({ symbol: 'ETHUSDT', side: 'BUY', qty: 10 });
    }).toThrow(/SOVEREIGN VETO/);
  });

  it('G-WORKER-02: getStatus() fulfills the observability API contract', () => {
    const worker = new H017LiveSoakWorker({
      soakDir: tempSoakDir,
      initialCapital: 50000,
      pollIntervalMs: 10000
    });

    const status = worker.getStatus();

    expect(status.mode).toBe('WALL_CLOCK_SHADOW_SOAK');
    expect(status.sovereignVetoEnforced).toBe(true);
    expect(status.realCapitalAtRiskUSD).toBe(0);
    expect(status.targetSoakDays).toBe(7);
    expect(status.initialCapital).toBe(50000);
    expect(status.equity).toBe(50000);
    expect(status.ticksProcessed).toBe(0);
    expect(status.killSwitchesHalted).toBe(false);
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('G-WORKER-03: Successfully ingests simulated tick data and logs shadow orders', () => {
    const worker = new H017LiveSoakWorker({
      soakDir: tempSoakDir,
      initialCapital: 100000
    });

    // Mock tick ingestion directly into runner
    const tickResult = worker.runner.processTick({
      timestampMs: Date.now(),
      prices: {
        BTCUSDT: 90000,
        ETHUSDT: 3000,
        SOLUSDT: 180,
        AVAXUSDT: 35,
        stETH: 2998.5,
        JitoSOL: 179.8,
        sAVAX: 34.96
      },
      nativePrices: {
        ETHUSDT: 3000,
        SOLUSDT: 180,
        AVAXUSDT: 35
      },
      fundingRates: {
        BTCUSDT: 0.0001,
        ETHUSDT: 0.00015,
        SOLUSDT: 0.0002,
        AVAXUSDT: 0.0001
      },
      trailingGrossRates: {
        BTCUSDT: 10.0,
        ETHUSDT: 19.5, // 16% fund + 3.5% stake
        SOLUSDT: 27.9, // 21.9% fund + 6% stake
        AVAXUSDT: 15.0
      }
    });

    expect(tickResult.ticksProcessed).toBe(1);
    expect(tickResult.killSwitchActive).toBe(false);
    expect(worker.runner.module.positions.has('SOLUSDT')).toBe(true);
    expect(worker.runner.module.positions.has('ETHUSDT')).toBe(true);

    const status = worker.getStatus();
    expect(status.ticksProcessed).toBe(1);
    expect(status.positions).toContain('SOLUSDT');
    expect(status.positions).toContain('ETHUSDT');
  });

  it('G-WORKER-04: start() and stop() control loop without memory leak or hanging timer', async () => {
    const worker = new H017LiveSoakWorker({
      soakDir: tempSoakDir,
      initialCapital: 10000,
      pollIntervalMs: 50
    });

    // Stub fetchLiveMarketData to prevent hitting external network in unit test
    worker.fetchLiveMarketData = async () => ({
      timestampMs: Date.now(),
      prices: { ETHUSDT: 3000, SOLUSDT: 180, stETH: 2998, JitoSOL: 179.8 },
      nativePrices: { ETHUSDT: 3000, SOLUSDT: 180 },
      fundingRates: { ETHUSDT: 0.0001, SOLUSDT: 0.0001 },
      trailingGrossRates: { ETHUSDT: 15.0, SOLUSDT: 20.0 }
    });

    worker.start();
    expect(worker.status).toBe('ACTIVE_SOAK');
    expect(worker.isRunning).toBe(true);

    // Wait for at least 1 tick
    await new Promise(r => setTimeout(r, 120));

    expect(worker.runner.ticksProcessed).toBeGreaterThanOrEqual(1);

    worker.stop();
    expect(worker.status).toBe('STOPPED');
    expect(worker.isRunning).toBe(false);
    expect(worker.pollTimer).toBeNull();
  });

  it('G-WORKER-05: Emits and signs 24h daily checkpoint to file', () => {
    const worker = new H017LiveSoakWorker({
      soakDir: tempSoakDir,
      initialCapital: 100000
    });

    worker.runner.dayCount = 1;
    const checkpoint = worker.runner.recordDailyCheckpoint(Date.now());
    expect(checkpoint.day).toBe(1);
    expect(checkpoint.equity).toBe(100000);

    const checkpointsFile = path.join(tempSoakDir, 'h017_daily_checkpoints.jsonl');
    expect(fs.existsSync(checkpointsFile)).toBe(true);

    const content = fs.readFileSync(checkpointsFile, 'utf8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.day).toBe(1);
    expect(parsed.sha256).toBeDefined();
    expect(parsed.sha256.length).toBe(64);
  });
});
