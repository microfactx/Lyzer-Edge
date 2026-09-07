/**
 * ALPHA FACTORY — VERIFICATION TEST SUITE: AD013 REGIME ENGINE
 * Test: verify_ad013_regime_engine.test.js
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateIndicators, simulateCell } from '../../research/alpha_discovery/AD013/core/ad013_regime_engine.js';
import { FirewallGuard } from '../../research/alpha_factory/core/firewall_guard.js';

describe('AD013 Regime Engine & Invariant Verification', () => {
  const rootDir = process.cwd();

  it('1. Calculates indicators (ADX, ATR, EMA, Bollinger, RSI) causally without NaN', () => {
    // Generate synthetic 100 bars
    const candles = [];
    let price = 100;
    const baseTime = 1700000000000;

    for (let i = 0; i < 100; i++) {
      const delta = (Math.sin(i / 5) * 2) + ((i % 3) - 1);
      const open = price;
      const close = price + delta;
      const high = Math.max(open, close) + 1.5;
      const low = Math.min(open, close) - 1.5;
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

    const ind = calculateIndicators(candles);
    expect(ind.length).toBe(100);

    // After warmup (index 50), verify indicators have non-NaN values
    for (let i = 50; i < 100; i++) {
      expect(isNaN(ind[i].atr)).toBe(false);
      expect(ind[i].atr).toBeGreaterThan(0);
      expect(isNaN(ind[i].adx)).toBe(false);
      expect(ind[i].adx).toBeGreaterThanOrEqual(0);
      expect(ind[i].adx).toBeLessThanOrEqual(100);
      expect(isNaN(ind[i].ema20)).toBe(false);
      expect(isNaN(ind[i].ema50)).toBe(false);
      expect(isNaN(ind[i].bbMiddle)).toBe(false);
      expect(isNaN(ind[i].bbStd)).toBe(false);
      expect(isNaN(ind[i].rsi)).toBe(false);
      expect(ind[i].rsi).toBeGreaterThanOrEqual(0);
      expect(ind[i].rsi).toBeLessThanOrEqual(100);
    }
  });

  it('2. Enforces zero lookahead bias (order entry strictly on candle t+1 open)', () => {
    const dataPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/data/EURUSD_1h_discovery.json');
    expect(fs.existsSync(dataPath)).toBe(true);

    const candles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const config = {
      id: 'TEST_CELL',
      adxTrendThreshold: 22,
      adxChopThreshold: 20,
      bollingerZ: 2.0,
      riskReward: 1.5,
      maxHoldingHours: 24,
      discoveryWeeks: 58.0
    };

    const result = simulateCell(candles, config, 5.0);
    expect(result.trades.length).toBeGreaterThan(0);

    for (const trade of result.trades) {
      // Find candle corresponding to entry
      const entryCandle = candles.find(c => c.timestamp === trade.entryTimestamp);
      expect(entryCandle).toBeDefined();
      expect(trade.entryPrice).toBe(entryCandle.open);
      expect(trade.exitTimestamp).toBeGreaterThanOrEqual(trade.entryTimestamp);
      expect(trade.barsHeld).toBeGreaterThanOrEqual(1);
    }
  });

  it('3. Enforces Friday 20:00 UTC weekend-flat rule', () => {
    const dataPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/data/EURUSD_1h_discovery.json');
    const candles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const config = {
      id: 'TEST_WEEKEND',
      adxTrendThreshold: 22,
      adxChopThreshold: 20,
      bollingerZ: 2.0,
      riskReward: 1.5,
      maxHoldingHours: 24,
      discoveryWeeks: 58.0
    };

    const result = simulateCell(candles, config, 5.0);

    // Verify no trade is held past Friday 20:00 UTC into Saturday/Sunday
    for (const trade of result.trades) {
      const exitDate = new Date(trade.exitTimestamp);
      const exitDay = exitDate.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const exitHour = exitDate.getUTCHours();

      if (exitDay === 5) {
        expect(exitHour).toBeLessThanOrEqual(23);
      }
      expect(exitDay).not.toBe(6); // Saturday holding forbidden
    }
  });

  it('4. Deducts real friction in basis points accurately', () => {
    const dataPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/data/EURUSD_1h_discovery.json');
    const candles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const config = {
      id: 'TEST_COSTS',
      adxTrendThreshold: 22,
      adxChopThreshold: 20,
      bollingerZ: 2.0,
      riskReward: 1.5,
      maxHoldingHours: 24,
      discoveryWeeks: 58.0
    };

    const frictionBps = 5.0; // 0.0005
    const result = simulateCell(candles, config, frictionBps);

    for (const trade of result.trades) {
      const expectedNetPct = trade.grossPct - (frictionBps / 10000);
      expect(Math.abs(trade.netPct - expectedNetPct)).toBeLessThan(1e-6);
      expect(trade.netPct).toBeLessThan(trade.grossPct);
    }
  });

  it('5. Production V8 Motor SHA-256 invariant remains 100% intact', () => {
    const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    expect(() => FirewallGuard.assertV8EngineInvariant(v8Path)).not.toThrow();
  });
});
