/**
 * LYZER LABS — H019 CONFIRMATORY ENGINE UNIT TEST SUITE
 * Test: h019_confirmatory.test.js
 */

import { describe, it, expect } from 'vitest';
import { H019ConfirmatoryEngine } from '../core/h019_confirmatory_engine.js';

describe('H019 Confirmatory Engine Verification', () => {
  it('should correctly synchronize multi-asset panels with common timestamps', () => {
    const rawPanels = {
      USDJPY: [
        { timestamp: 100, open: 150, high: 151, low: 149, close: 150.5 },
        { timestamp: 200, open: 150.5, high: 152, low: 150, close: 151.0 },
        { timestamp: 300, open: 151.0, high: 153, low: 151, close: 152.0 }
      ],
      GBPJPY: [
        { timestamp: 100, open: 190, high: 191, low: 189, close: 190.5 },
        { timestamp: 200, open: 190.5, high: 192, low: 190, close: 191.0 },
        { timestamp: 400, open: 191.0, high: 193, low: 191, close: 192.0 }
      ]
    };

    const synced = H019ConfirmatoryEngine.synchronizePanels(rawPanels);
    expect(synced.timestamps).toEqual([100, 200]);
    expect(synced.panel.USDJPY.length).toBe(2);
    expect(synced.panel.GBPJPY.length).toBe(2);
  });

  it('should compute Wilder ATR, baseline ATR, and EMA indicators causally', () => {
    const candles = [];
    let price = 150;
    for (let i = 0; i < 300; i++) {
      price += (i % 2 === 0 ? 0.2 : -0.1);
      candles.push({
        timestamp: 1000 + i * 3600000,
        open: price,
        high: price + 0.5,
        low: price - 0.5,
        close: price + 0.1
      });
    }

    const inds = H019ConfirmatoryEngine.calculatePairIndicators(candles, 200);
    expect(inds.length).toBe(300);
    expect(inds[250].ema).toBeGreaterThan(0);
    expect(inds[250].atr).toBeGreaterThan(0);
    expect(inds[250].volRatio).toBeGreaterThan(0);
  });

  it('should throw error when candles are insufficient for warmup', () => {
    const syncedData = {
      timestamps: [1000, 2000],
      panel: {
        USDJPY: [
          { timestamp: 1000, close: 150 },
          { timestamp: 2000, close: 151 }
        ]
      }
    };

    const mockSpec = {
      parameters: { emaLookback: 200 },
      pairs: { USDJPY: { annualCarryRate: 0.052, turnoverFrictionBps: 3.0 } }
    };

    expect(() => {
      H019ConfirmatoryEngine.simulate(syncedData, mockSpec);
    }).toThrow(/insufficient for warmup/i);
  });

  it('should execute simulation and produce equity curve and 14-day blocks', () => {
    const pairs = ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'];
    const n = 600;
    const timestamps = [];
    const panel = {};
    for (const p of pairs) panel[p] = [];

    for (let i = 0; i < n; i++) {
      const ts = 1735689600000 + i * 3600000;
      timestamps.push(ts);
      for (const p of pairs) {
        const base = p === 'USDJPY' ? 150 : (p === 'GBPJPY' ? 190 : (p === 'AUDJPY' ? 100 : 110));
        const pClose = base + Math.sin(i / 50) * 2 + (i * 0.01);
        panel[p].push({
          timestamp: ts,
          open: pClose - 0.1,
          high: pClose + 0.3,
          low: pClose - 0.3,
          close: pClose
        });
      }
    }

    const mockSpec = {
      parameters: {
        weighting: 'EQUAL_WEIGHT',
        circuitBreaker: 'UNIFIED_BASKET',
        emaLookback: 200,
        volRatioThreshold: 1.35,
        dwellHours: 24
      },
      pairs: {
        USDJPY: { annualCarryRate: 0.0520, turnoverFrictionBps: 3.0 },
        GBPJPY: { annualCarryRate: 0.0490, turnoverFrictionBps: 3.0 },
        AUDJPY: { annualCarryRate: 0.0425, turnoverFrictionBps: 3.0 },
        CADJPY: { annualCarryRate: 0.0465, turnoverFrictionBps: 3.0 }
      },
      safeHavenTBillRate: 0.0500,
      friction: {
        turnoverFrictionBpsPerLeg: 3.0
      }
    };

    const synced = { timestamps, panel };
    const res = H019ConfirmatoryEngine.simulate(synced, mockSpec);

    expect(res.summary).toBeDefined();
    expect(res.summary.totalHours).toBeGreaterThan(0);
    expect(res.summary.finalNav).toBeGreaterThan(0);
    expect(res.equityCurve.length).toBe(res.summary.totalHours);
    expect(res.blockReturns.length).toBeGreaterThan(0);
  });
});
