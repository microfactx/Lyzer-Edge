import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Ad016CarryEngine } from '../../research/alpha_discovery/AD016/core/ad016_carry_engine.js';

describe('AD016 — Multi-Asset Carry Engine Contract & Epistemic Invariants', () => {
  const rootDir = process.cwd();
  const specPath = path.resolve(rootDir, 'research/alpha_discovery/AD016/spec/AD016_CAMPAIGN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const engine = new Ad016CarryEngine(spec);
  const dataDir = path.resolve(rootDir, 'research/alpha_discovery/AD016/data');

  it('1. Instantiates engine and verifies contract invariants from spec', () => {
    expect(engine).toBeDefined();
    expect(spec.campaignId).toBe('AD016');
    expect(spec.cells.length).toBe(24);
    expect(spec.frictions.tBillAnnualYieldPct).toBe(5.00);
  });

  it('2. Weights sum strictly to 1.0 across Track A, Track B, and Track C', () => {
    const dummyTimeline = [
      { timestamp: 1000, prices: { USDJPY: 150, USDCHF: 0.90, USDMXN: 17.5, USDBRL: 5.0, USDZAR: 18.0, USDPLN: 4.0, GBPJPY: 190, AUDJPY: 98, CADJPY: 110, GBPCHF: 1.15, AUDCHF: 0.58, CADCHF: 0.65 } },
      { timestamp: 2000, prices: { USDJPY: 150.2, USDCHF: 0.901, USDMXN: 17.48, USDBRL: 4.99, USDZAR: 18.02, USDPLN: 3.99, GBPJPY: 190.2, AUDJPY: 98.1, CADJPY: 110.1, GBPCHF: 1.151, AUDCHF: 0.581, CADCHF: 0.651 } }
    ];

    // Track A Equal Weight
    const cellA = spec.cells.find(c => c.track === 'TRACK_A_DUAL_FUNDING' && c.weighting === 'EQUAL_WEIGHT');
    const symbolsA = [...spec.instruments.trackA_G10_JPY, ...spec.instruments.trackA_G10_CHF];
    const weightsA = engine.calculateWeights(cellA, symbolsA, dummyTimeline);
    const sumA = Object.values(weightsA).reduce((a, b) => a + b, 0);
    expect(sumA).toBeCloseTo(1.0, 5);

    // Track B Carry Weighted
    const cellB = spec.cells.find(c => c.track === 'TRACK_B_EM_HIGH_YIELD' && c.weighting === 'CARRY_WEIGHTED');
    const symbolsB = [...spec.instruments.trackB_EM];
    const weightsB = engine.calculateWeights(cellB, symbolsB, dummyTimeline);
    const sumB = Object.values(weightsB).reduce((a, b) => a + b, 0);
    expect(sumB).toBeCloseTo(1.0, 5);

    // Track C Hybrid
    const cellC = spec.cells.find(c => c.track === 'TRACK_C_HYBRID_MULTI_ASSET' && c.weighting === 'EQUAL_WEIGHT');
    const symbolsC = [...symbolsA, ...symbolsB];
    const weightsC = engine.calculateWeights(cellC, symbolsC, dummyTimeline);
    const sumC = Object.values(weightsC).reduce((a, b) => a + b, 0);
    expect(sumC).toBeCloseTo(1.0, 5);
  });

  it('3. Runs full deterministic simulation on Track A Dual-Funding cell without errors', () => {
    const cell = spec.cells[0]; // AD016_DF_EW_EMA100_VOL120
    const result = engine.runSimulation(cell, dataDir);

    expect(result).toBeDefined();
    expect(result.cellId).toBe('AD016_DF_EW_EMA100_VOL120');
    expect(typeof result.annualizedReturnPct).toBe('number');
    expect(typeof result.maxDrawdownPct).toBe('number');
    expect(typeof result.sharpeRatio).toBe('number');
    expect(typeof result.pBlock).toBe('number');
    expect(result.pBlock).toBeGreaterThanOrEqual(0);
    expect(result.pBlock).toBeLessThanOrEqual(1.0);
  });

  it('4. Verifies fail-closed governance: production V8 SHA-256 is preserved', () => {
    const v8EnginePath = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
    const content = fs.readFileSync(v8EnginePath);
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    expect(sha).toBe('fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1');
  });
});
