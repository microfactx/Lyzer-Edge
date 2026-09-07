/**
 * ALPHA FACTORY — AD012 CROSS-ASSET TREND BREAKOUT DISCOVERY RUNNER
 * Script: run_ad012_discovery.js
 * 
 * Objectives:
 * 1. Evaluates 24 Trend Breakout & Volatility Expansion cells across TradFi (SPY, QQQ, EURUSD, GBPUSD, GLD) & Crypto (BTCUSDT).
 * 2. Strict Discovery window (2023-11-21 -> 2024-12-31T23:59:59.999Z).
 * 3. Exact TradFi & Crypto friction modeling (fees, slippage, bid-ask spread).
 * 4. 14-Day Calendar Block Bootstrap (B=10,000, trade-weighted, Hall centered, seed 888888).
 * 5. Multiplicity control via Benjamini-Yekutieli (BY, 2001) for M=24 cells.
 * 6. Generates full forensic reports, result JSON, and manifest.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FirewallGuard } from '../../../alpha_factory/core/firewall_guard.js';
import { AD012BreakoutEngine } from '../core/ad012_breakout_engine.js';
import { runCalendarBlockBootstrap, computeBenjaminiYekutieli } from '../../../alpha_factory/core/inference_battery.js';

const rootDir = process.cwd();

async function main() {
  console.log('================================================================');
  console.log('🏛️ ALPHA FACTORY — PROGRAM AD012: TREND BREAKOUT DISCOVERY');
  console.log('================================================================\n');

  // Step 1: V8 Engine Invariance Check
  const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
  FirewallGuard.assertV8EngineInvariant(v8Path);
  console.log('✔ Engine V8 Invariant Verified: fc19e807...b4db1 intact.');

  // Step 2: Load Campaign Spec
  const specPath = path.resolve(rootDir, 'research/alpha_discovery/AD012/spec/AD012_CAMPAIGN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  const dataDir = path.resolve(rootDir, 'research/alpha_discovery/AD011/data');
  const targetAssets = spec.targetAssets;

  console.log(`Universe: ${targetAssets.join(', ')}`);
  console.log(`Discovery Period: ${spec.period.label}`);
  console.log(`Friction Matrix: Loaded for ${Object.keys(spec.friction).length} asset classes.`);
  console.log(`Grid Cells: ${spec.cells.length} hypotheses to evaluate.\n`);

  // Step 3: Load Discovery Candles and enforce Firewall Guard
  const panel = {};
  for (const sym of targetAssets) {
    const fPath = path.join(dataDir, `${sym}_1h_discovery.json`);
    const candles = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    FirewallGuard.assertDiscoveryCandles(candles, `${sym}_1h_discovery`);
    panel[sym] = candles;
    console.log(`✔ [${sym}] Loaded ${candles.length} discovery candles.`);
  }
  console.log('');

  const rawResults = [];

  // Step 4: Run Simulation for Each Hypothesis Cell
  console.log('--- Executing Trend Breakout Simulation & 14-Day Calendar Block Bootstrap ---');
  for (let i = 0; i < spec.cells.length; i++) {
    const cell = spec.cells[i];
    const assetCandles = panel[cell.asset];
    const friction = spec.friction[cell.asset];

    const simRes = AD012BreakoutEngine.simulate(assetCandles, cell, friction);
    const trades = simRes.trades;

    // 14-Day Block Bootstrap
    const boot = runCalendarBlockBootstrap(trades, {
      replications: 10000,
      seed: 888888
    });

    const wins = trades.filter(t => t.netR > 0).length;
    const winRatePct = trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;

    rawResults.push({
      id: cell.id,
      asset: cell.asset,
      macroLookback: cell.macroLookback,
      riskReward: cell.riskReward,
      description: cell.description,
      nTrades: trades.length,
      winRatePct,
      meanNetR: boot.meanNetR,
      profitFactor: boot.profitFactor,
      ci95Lower: boot.ci95Lower,
      ci95Upper: boot.ci95Upper,
      pBlock: boot.pBlock,
      mddR: boot.mddR,
      totalNetR: boot.totalNetR,
      isDegenerate: boot.isDegenerate,
      trades
    });

    process.stdout.write(`[${i + 1}/${spec.cells.length}] ${cell.id.padEnd(24)} -> N=${String(trades.length).padStart(3)} | E[R]=${boot.meanNetR.toFixed(3).padStart(6)}R | PF=${String(boot.profitFactor).padStart(4)} | p=${boot.pBlock.toFixed(4)}\n`);
  }

  // Step 5: Multiplicity Correction (Benjamini-Yekutieli)
  console.log('\n--- Computing Benjamini-Yekutieli Multiplicity Corrections (M=24) ---');
  const pValues = rawResults.map(r => r.pBlock);
  const byResults = computeBenjaminiYekutieli(pValues, 0.05);

  const finalResults = rawResults.map((r, idx) => {
    const qBY = byResults[idx]?.qValue !== undefined ? byResults[idx].qValue : 1.0;
    
    // Gate 1: N >= 60
    const passN = r.nTrades >= 60;
    // Gate 2: E[R] >= +0.200R
    const passExp = r.meanNetR >= 0.200;
    // Gate 3: PF >= 1.40
    const passPF = r.profitFactor >= 1.40;
    // Gate 4: p_block < 0.0500
    const passP = r.pBlock < 0.0500;
    // Gate 5: q_BY < 0.0500
    const passBY = qBY < 0.0500;

    const allPassed = passN && passExp && passPF && passP && passBY;

    return {
      id: r.id,
      asset: r.asset,
      macroLookback: r.macroLookback,
      riskReward: r.riskReward,
      description: r.description,
      nTrades: r.nTrades,
      winRatePct: r.winRatePct,
      meanNetR: r.meanNetR,
      profitFactor: r.profitFactor,
      ci95Lower: r.ci95Lower,
      ci95Upper: r.ci95Upper,
      pBlock: r.pBlock,
      qBY,
      mddR: r.mddR,
      totalNetR: r.totalNetR,
      gates: {
        passN,
        passExp,
        passPF,
        passP,
        passBY,
        allPassed
      },
      status: allPassed ? 'ELIGIBLE_FOR_CONFIRMATION' : 'FALSIFIED_OR_UNDERPOWERED'
    };
  });

  // Step 6: Summary and Decision
  const eligibleCells = finalResults.filter(r => r.gates.allPassed);
  console.log(`\n================================================================`);
  console.log(`EVALUATION COMPLETE: ${eligibleCells.length}/${finalResults.length} cells passed ALL 5 CONSTITUTIONAL GATES.`);
  console.log(`================================================================\n`);

  // Step 7: Save Results JSON
  const outResultsPath = path.resolve(rootDir, 'research/alpha_discovery/AD012/discovery/AD012_DISCOVERY_RESULTS.json');
  fs.writeFileSync(outResultsPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD012',
    executionDate: new Date().toISOString(),
    totalCells: finalResults.length,
    eligibleCount: eligibleCells.length,
    cells: finalResults
  }, null, 2), 'utf8');
  console.log(`✔ Results saved to: ${outResultsPath}`);

  // Step 8: Generate Comprehensive Markdown Report
  generateDiscoveryReport(finalResults, eligibleCells);

  // Step 9: Save Manifest
  const manifestPath = path.resolve(rootDir, 'research/alpha_discovery/AD012/discovery/AD012_DISCOVERY_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD012',
    timestamp: new Date().toISOString(),
    resultsSha256: crypto.createHash('sha256').update(fs.readFileSync(outResultsPath)).digest('hex'),
    eligibleCells: eligibleCells.map(c => c.id)
  }, null, 2), 'utf8');
  console.log(`✔ Manifest saved to: ${manifestPath}\n`);
}

function generateDiscoveryReport(results, eligible) {
  const reportPath = path.resolve(rootDir, 'research/alpha_discovery/AD012/discovery/AD012_DISCOVERY_REPORT.md');

  let md = `# 🏛️ AD012 DISCOVERY REPORT — CROSS-ASSET TREND BREAKOUT & VOLATILITY EXPANSION\n\n`;
  md += `**Programa:** AD012  \n`;
  md += `**Data da Execução:** ${new Date().toISOString()}  \n`;
  md += `**Autoridade:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Status:** ${eligible.length > 0 ? '🟢 DISCOVERY SUCCESS' : '🔴 ALL CELLS FALSIFIED / UNDERPOWERED'}  \n\n`;

  md += `## 1. Sumário Executivo\n\n`;
  md += `O programa **AD012** investigou formalmente se o rompimento de canais macro de 4H (Donchian Breakout) acompanhado por expansão intradiária de volatilidade ($ATR_{14} \\ge 1.15 \\times MA(ATR)_{50}$) captura alfa de continuação direcional (Trend Following / Momentum) em 6 ativos: \`SPY\`, \`QQQ\`, \`EURUSD\`, \`GBPUSD\`, \`GLD\` e \`BTCUSDT\`.\n\n`;
  md += `Foram simuladas **24 células combinatórias** no período de Discovery (2023-11-21 a 2024-12-31), aplicando fricções realistas de corretagem, spread e slippage, com **Block Bootstrap de 14 dias (B=10.000)** e penalidade de **Benjamini-Yekutieli (BY, 2001)**.\n\n`;

  md += `## 2. Matriz Forense de Resultados (Todas as 24 Células)\n\n`;
  md += `| ID | Ativo | L (4H) | R:R | N | Win% | E[R] (Net) | PF | 95% CI | p_block | q_BY | Status |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    const statusIcon = r.gates.allPassed ? '🟢 PASS' : '🔴 REJECT';
    md += `| **${r.id}** | ${r.asset} | ${r.macroLookback} | ${r.riskReward} | ${r.nTrades} | ${r.winRatePct}% | **${r.meanNetR > 0 ? '+' : ''}${r.meanNetR.toFixed(3)}R** | ${r.profitFactor} | [${r.ci95Lower.toFixed(2)}, ${r.ci95Upper.toFixed(2)}] | ${r.pBlock.toFixed(4)} | ${r.qBY.toFixed(4)} | ${statusIcon} |\n`;
  }

  md += `\n## 3. Diagnóstico e Avaliação dos 5 Gates Constitucionais\n\n`;
  md += `1. **Gate 1 (Densidade Amostral)**: $N \\ge 60$ trades não-sobrepostos.\n`;
  md += `2. **Gate 2 (Expectativa Líquida)**: $E[R] \\ge +0.200R$ pós-custos.\n`;
  md += `3. **Gate 3 (Fator de Lucro)**: $\\text{PF} \\ge 1.40$.\n`;
  md += `4. **Gate 4 (Significância de Bootstrap)**: $p_{\\text{block}} < 0.0500$.\n`;
  md += `5. **Gate 5 (Controle Benjamini-Yekutieli)**: $q_{\\text{BY}} < 0.0500$.\n\n`;

  if (eligible.length > 0) {
    md += `### 🟢 Células Aprovadas para Promoção:\n`;
    for (const e of eligible) {
      md += `* **\`${e.id}\`** (${e.asset}): $N=${e.nTrades}$, $E[R]=+${e.meanNetR.toFixed(3)}R$, $\\text{PF}=${e.profitFactor}$, $p=${e.pBlock.toFixed(4)}$, $q_{\\text{BY}}=${e.qBY.toFixed(4)}$.\n`;
    }
  } else {
    md += `### 🔴 Veredito: Falsificação / Poder Estatístico Insuficiente\n`;
    md += `Nenhuma das 24 variações atingiu cumulativamente os 5 gates constitucionais.\n`;
  }

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`✔ Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('[FATAL DISCOVERY ERROR]:', err);
  process.exit(1);
});
