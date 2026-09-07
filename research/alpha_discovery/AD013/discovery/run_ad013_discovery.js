/**
 * ALPHA FACTORY — AD013 REGIME-ADAPTIVE TRADFI DISCOVERY RUNNER
 * Script: run_ad013_discovery.js
 * 
 * Objectives:
 * 1. Evaluates 28 High-Frequency Regime-Adaptive cells across 7 assets:
 *    SPY, QQQ, GLD, EURUSD, GBPUSD, USDJPY, BTCUSDT.
 * 2. Strict Discovery window (2023-11-21 -> 2024-12-31T23:59:59.999Z, 58 weeks).
 * 3. Exact TradFi & Crypto friction modeling (2 bps to 24 bps).
 * 4. Frequency Constraint: N >= 116 trades (>= 2 trades/week).
 * 5. 14-Day Calendar Block Bootstrap (B=10,000, trade-weighted, Hall centered, seed 888888).
 * 6. Multiplicity control via Benjamini-Yekutieli (BY, 2001) for M=28 cells.
 * 7. Generates forensic reports, result JSON, and manifest.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FirewallGuard } from '../../../alpha_factory/core/firewall_guard.js';
import { simulateCell } from '../core/ad013_regime_engine.js';
import { runCalendarBlockBootstrap, computeBenjaminiYekutieli } from '../../../alpha_factory/core/inference_battery.js';

const rootDir = process.cwd();

async function main() {
  console.log('================================================================');
  console.log('🏛️ ALPHA FACTORY — PROGRAM AD013: REGIME-ADAPTIVE TRADFI DISCOVERY');
  console.log('================================================================\n');

  // Step 1: V8 Engine Invariance Check
  const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
  FirewallGuard.assertV8EngineInvariant(v8Path);
  console.log('✔ Engine V8 Invariant Verified: fc19e807...b4db1 intact.');

  // Step 2: Load Campaign Spec
  const specPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/spec/AD013_CAMPAIGN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  const dataDir = path.resolve(rootDir, 'research/alpha_discovery/AD013/data');
  const targetAssets = ['SPY', 'QQQ', 'GLD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT'];

  console.log(`Universe: ${targetAssets.join(', ')}`);
  console.log(`Frequency Threshold: >= ${spec.constraints.minimumWeeklyTrades} trades/week (N >= ${spec.constraints.minimumDiscoveryTrades} in ${spec.constraints.discoveryWeeks} weeks)`);
  console.log(`Grid Cells: ${spec.cells.length} hypotheses to evaluate under BY (M=${spec.governance.totalHypotheses}).\n`);

  // Step 3: Load Discovery Candles & Enforce Firewall Guard
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

  // Step 4: Run Simulation & Block Bootstrap for Each Hypothesis Cell
  console.log('--- Executing Regime Simulation & 14-Day Calendar Block Bootstrap ---');
  for (let i = 0; i < spec.cells.length; i++) {
    const cell = spec.cells[i];
    const assetCandles = panel[cell.asset];
    const costConfig = spec.costModel[cell.asset];
    const frictionBps = costConfig.totalFrictionBps;

    const cellConfig = {
      ...cell,
      maxHoldingHours: spec.constraints.maximumHoldingHours,
      discoveryWeeks: spec.constraints.discoveryWeeks
    };

    const simRes = simulateCell(assetCandles, cellConfig, frictionBps);
    const trades = simRes.trades;

    // 14-Day Calendar Block Bootstrap
    const boot = runCalendarBlockBootstrap(trades, {
      replications: spec.governance.bootstrapIterations || 10000,
      seed: 888888
    });

    const wins = trades.filter(t => t.netR > 0).length;
    const winRatePct = trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;
    const weeklyFreq = Number((trades.length / spec.constraints.discoveryWeeks).toFixed(2));

    rawResults.push({
      id: cell.id,
      asset: cell.asset,
      regimeMode: cell.regimeMode,
      riskReward: cell.riskReward,
      bollingerZ: cell.bollingerZ,
      adxTrendThreshold: cell.adxTrendThreshold,
      adxChopThreshold: cell.adxChopThreshold,
      nTrades: trades.length,
      weeklyFreq,
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

    process.stdout.write(`[${String(i + 1).padStart(2)}/${spec.cells.length}] ${cell.id.padEnd(28)} -> N=${String(trades.length).padStart(3)} (${weeklyFreq.toFixed(1)}/wk) | E[R]=${boot.meanNetR.toFixed(3).padStart(6)}R | PF=${String(boot.profitFactor).padStart(4)} | p=${boot.pBlock.toFixed(4)}\n`);
  }

  // Step 5: Multiplicity Correction (Benjamini-Yekutieli, M=28)
  console.log('\n--- Computing Benjamini-Yekutieli Multiplicity Corrections (M=28) ---');
  const pValues = rawResults.map(r => r.pBlock);
  const byResults = computeBenjaminiYekutieli(pValues, spec.governance.significanceLevel || 0.05);

  const finalResults = rawResults.map((r, idx) => {
    const qBY = byResults[idx]?.qValue !== undefined ? byResults[idx].qValue : 1.0;

    // Gate 1: N >= 116 (>= 2 trades/week)
    const passN = r.nTrades >= spec.gates.gate1_minTrades;
    // Gate 2: E[R] >= +0.150R
    const passExp = r.meanNetR >= spec.gates.gate2_minExpectancyR;
    // Gate 3: PF >= 1.30
    const passPF = r.profitFactor >= spec.gates.gate3_minProfitFactor;
    // Gate 4: p_block < 0.0500
    const passP = r.pBlock < spec.gates.gate4_maxBlockBootstrapPValue;
    // Gate 5: q_BY < 0.0500
    const passBY = qBY < spec.gates.gate5_maxBenjaminiYekutieliQ;

    const allPassed = passN && passExp && passPF && passP && passBY;

    return {
      id: r.id,
      asset: r.asset,
      regimeMode: r.regimeMode,
      riskReward: r.riskReward,
      bollingerZ: r.bollingerZ,
      nTrades: r.nTrades,
      weeklyFreq: r.weeklyFreq,
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
  const outResultsPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/discovery/AD013_DISCOVERY_RESULTS.json');
  fs.writeFileSync(outResultsPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD013',
    executionDate: new Date().toISOString(),
    totalCells: finalResults.length,
    eligibleCount: eligibleCells.length,
    cells: finalResults
  }, null, 2), 'utf8');
  console.log(`✔ Results saved to: ${outResultsPath}`);

  // Step 8: Generate Comprehensive Markdown Report
  generateDiscoveryReport(finalResults, eligibleCells);

  // Step 9: Save Manifest
  const manifestPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/discovery/AD013_DISCOVERY_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD013',
    timestamp: new Date().toISOString(),
    resultsSha256: crypto.createHash('sha256').update(fs.readFileSync(outResultsPath)).digest('hex'),
    eligibleCells: eligibleCells.map(c => c.id)
  }, null, 2), 'utf8');
  console.log(`✔ Manifest saved to: ${manifestPath}\n`);
}

function generateDiscoveryReport(results, eligible) {
  const reportPath = path.resolve(rootDir, 'research/alpha_discovery/AD013/discovery/AD013_DISCOVERY_REPORT.md');

  let md = `# 🏛️ AD013 DISCOVERY REPORT — HIGH-FREQUENCY TRADFI REGIME-ADAPTIVE ALPHA\n\n`;
  md += `**Programa:** AD013  \n`;
  md += `**Data da Execução:** ${new Date().toISOString()}  \n`;
  md += `**Autoridade:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Status:** ${eligible.length > 0 ? '🟢 DISCOVERY SUCCESS' : '🔴 ALL CELLS FALSIFIED / UNDERPOWERED'}  \n\n`;

  md += `## 1. Sumário Executivo\n\n`;
  md += `O programa **AD013** investigou formalmente um motor intradiário (1H) adaptativo condicionado por regimes de mercado (Trend Pullback em $\\text{ADX} \\ge 22$ vs Reversão Extrema de Bandas de Bollinger em $\\text{ADX} < 20$) em 7 ativos representativos de TradFi e Cripto:\n`;
  md += `* **Índices de Ações EUA**: \`SPY\` (S&P 500), \`QQQ\` (Nasdaq 100)\n`;
  md += `* **Commodities**: \`GLD\` (Ouro)\n`;
  md += `* **Forex G10**: \`EURUSD\`, \`GBPUSD\`, \`USDJPY\`\n`;
  md += `* **Controle Cripto**: \`BTCUSDT\`\n\n`;
  md += `Foi imposta uma **restrição mandatória de frequência de pelo menos 2 trades/semana** ($N \\ge 116$ trades nas 58 semanas do Discovery).\n\n`;

  md += `## 2. Matriz Forense de Resultados (Todas as 28 Células)\n\n`;
  md += `| ID | Ativo | Modo | R:R | Z | N | Freq/wk | Win% | E[R] (Net) | PF | 95% CI | p_block | q_BY | Status |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    const statusIcon = r.gates.allPassed ? '🟢 PASS' : '🔴 REJECT';
    md += `| **${r.id}** | ${r.asset} | ${r.regimeMode} | ${r.riskReward} | ${r.bollingerZ} | ${r.nTrades} | ${r.weeklyFreq} | ${r.winRatePct}% | **${r.meanNetR > 0 ? '+' : ''}${r.meanNetR.toFixed(3)}R** | ${r.profitFactor} | [${r.ci95Lower.toFixed(2)}, ${r.ci95Upper.toFixed(2)}] | ${r.pBlock.toFixed(4)} | ${r.qBY.toFixed(4)} | ${statusIcon} |\n`;
  }

  md += `\n## 3. Avaliação dos 5 Gates Constitucionais\n\n`;
  md += `1. **Gate 1 (Densidade & Frequência)**: $N \\ge 116$ trades ($\\ge 2.0\\text{ trades/semana}$).  \n`;
  md += `2. **Gate 2 (Expectativa Líquida)**: $E[R] \\ge +0.150R$ pós-custos.  \n`;
  md += `3. **Gate 3 (Fator de Lucro)**: $\\text{PF} \\ge 1.30$.  \n`;
  md += `4. **Gate 4 (Significância de Bootstrap)**: $p_{\\text{block}} < 0.0500$ (14-day Calendar Block Bootstrap, $B=10.000$).  \n`;
  md += `5. **Gate 5 (Controle Benjamini-Yekutieli)**: $q_{\\text{BY}} < 0.0500$ ($m=28$).  \n\n`;

  if (eligible.length > 0) {
    md += `### 🟢 Células Aprovadas para Promoção Confirmatória:\n`;
    for (const e of eligible) {
      md += `* **\`${e.id}\`** (${e.asset}): $N=${e.nTrades}$ (${e.weeklyFreq}/wk), $E[R]=+${e.meanNetR.toFixed(3)}R$, $\\text{PF}=${e.profitFactor}$, $p=${e.pBlock.toFixed(4)}$, $q_{\\text{BY}}=${e.qBY.toFixed(4)}$.\n`;
    }
  } else {
    md += `### 🔴 Veredito: Falsificação / Rejeição por Ausência de Alfa Líquido\n`;
    md += `Nenhuma das 28 células atingiu cumulativamente todos os 5 critérios constitucionais após fricções reais.\n`;
  }

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`✔ Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('[FATAL DISCOVERY ERROR]:', err);
  process.exit(1);
});
