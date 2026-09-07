import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { H017ShadowSoakRunner } from '../../packages/lyzer-shared/src/execution/h017_shadow_soak_runner.js';

describe('H017 Phase 1 Shadow Soak Runner Verification Suite', () => {
  it('G-SOAK-01: Hard Veto blocks any real order transmission', () => {
    const runner = new H017ShadowSoakRunner();
    expect(() => runner.executeRealOrder({ symbol: 'ETHUSDT', side: 'BUY', qty: 1 })).toThrow(/SOVEREIGN VETO/);
  });

  it('G-SOAK-02: Processes ticks and executes shadow rebalances with atomic orders', () => {
    const runner = new H017ShadowSoakRunner({ moduleConfig: { initialCapital: 20000 } });
    const t0 = 1735689600000;

    const tick = {
      timestampMs: t0,
      prices: { SOLUSDT: 150, ETHUSDT: 3000, AVAXUSDT: 35, BTCUSDT: 90000 },
      nativePrices: { SOLUSDT: 150, ETHUSDT: 3000, AVAXUSDT: 35, BTCUSDT: 90000 },
      fundingRates: { SOLUSDT: 0.0001, ETHUSDT: 0.0001 },
      trailingGrossRates: { SOLUSDT: 15.0, ETHUSDT: 12.0, AVAXUSDT: 8.0, BTCUSDT: 6.0 }
    };

    const res = runner.processTick(tick);
    expect(res.ticksProcessed).toBe(1);
    expect(res.activePositions).toEqual(['SOLUSDT', 'ETHUSDT']);
    expect(res.rebalanceTriggered).toBe(true);
    expect(runner.shadowOrdersLog.length).toBe(2);
    expect(runner.shadowOrdersLog[0].deltaNeutral).toBe(true);
  });

  it('G-SOAK-03: Records cryptographically hashed daily checkpoints', () => {
    const runner = new H017ShadowSoakRunner();
    const t0 = 1735689600000;

    const tick1 = {
      timestampMs: t0,
      prices: { SOLUSDT: 150, ETHUSDT: 3000 },
      nativePrices: { SOLUSDT: 150, ETHUSDT: 3000 },
      fundingRates: { SOLUSDT: 0.0001, ETHUSDT: 0.0001 },
      trailingGrossRates: { SOLUSDT: 15.0, ETHUSDT: 12.0 }
    };
    runner.processTick(tick1);

    // Advance by 24 hours (86,400,000 ms)
    const t1 = t0 + 86400000;
    const tick2 = {
      timestampMs: t1,
      prices: { SOLUSDT: 152, ETHUSDT: 3020 },
      nativePrices: { SOLUSDT: 152, ETHUSDT: 3020 },
      fundingRates: { SOLUSDT: 0.00012, ETHUSDT: 0.00011 }
    };
    runner.processTick(tick2);

    expect(runner.dayCount).toBe(2);
    expect(fs.existsSync(runner.checkpointsFile)).toBe(true);

    const lines = fs.readFileSync(runner.checkpointsFile, 'utf8').trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const lastCheckpoint = JSON.parse(lines[lines.length - 1]);
    expect(lastCheckpoint.day).toBe(2);
    expect(lastCheckpoint.sha256).toBeTruthy();
  });

  it('G-SOAK-04: Detects depeg in live tick and triggers kill-switch failsafe', () => {
    const runner = new H017ShadowSoakRunner();
    const t0 = 1735689600000;

    // Normal initial tick
    runner.processTick({
      timestampMs: t0,
      prices: { SOLUSDT: 150, ETHUSDT: 3000, stETH: 3000, JitoSOL: 150 },
      nativePrices: { SOLUSDT: 150, ETHUSDT: 3000 },
      trailingGrossRates: { SOLUSDT: 15.0, ETHUSDT: 12.0 }
    });

    expect(runner.module.halted).toBe(false);

    // Critical depeg tick: stETH drops 3% below ETH
    const t1 = t0 + 3600000;
    const res = runner.processTick({
      timestampMs: t1,
      prices: { SOLUSDT: 150, ETHUSDT: 3000, stETH: 2910, JitoSOL: 150 },
      nativePrices: { SOLUSDT: 150, ETHUSDT: 3000 }
    });

    expect(res.killSwitchActive).toBe(true);
    expect(res.activeKillSwitch).toBe('K1_LST_DEPEG');
    expect(runner.killSwitchTrips.length).toBe(1);
    expect(runner.module.positions.size).toBe(0); // Safely unwound
  });

  it('G-SOAK-05: Accurately generates metrics summary', () => {
    const runner = new H017ShadowSoakRunner({ moduleConfig: { initialCapital: 10000 } });
    const summary = runner.getMetricsSummary();
    expect(summary.initialCapital).toBe(10000);
    expect(summary.currentEquity).toBe(10000);
    expect(summary.isHalted).toBe(false);
  });
});
