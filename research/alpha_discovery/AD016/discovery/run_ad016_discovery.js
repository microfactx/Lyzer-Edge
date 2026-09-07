/**
 * ALPHA FACTORY — AD016 DISCOVERY CAMPAIGN RUNNER
 * Script: run_ad016_discovery.js
 * 
 * Executes the pre-registered 24-cell matrix for:
 * - Track A: Dual-Funding G10 Carry Basket (8 cells)
 * - Track B: High-Yield Emerging Markets Basket (8 cells)
 * - Track C: Hybrid Multi-Asset All-Weather Carry (8 cells)
 * 
 * Applies:
 * - 14-day block bootstrap (1,000 resamples) for empirical p-values
 * - Benjamini-Yekutieli (BY, 2001) False Discovery Rate control on M=24
 * - Gate verification against the 5 Constitutional Passive Income Gates
 * 
 * Outputs:
 * - research/alpha_discovery/AD016/discovery/AD016_DISCOVERY_RESULTS.json
 * - research/alpha_discovery/AD016/discovery/AD016_DISCOVERY_REPORT.md
 */

import fs from 'fs';
import path from 'path';
import { Ad016CarryEngine } from '../core/ad016_carry_engine.js';

const rootDir = process.cwd();
const specPath = path.resolve(rootDir, 'research/alpha_discovery/AD016/spec/AD016_CAMPAIGN_SPEC.json');
const dataDir = path.resolve(rootDir, 'research/alpha_discovery/AD016/data');
const discoveryDir = path.resolve(rootDir, 'research/alpha_discovery/AD016/discovery');

fs.mkdirSync(discoveryDir, { recursive: true });

function calculateBenjaminiYekutieli(results) {
  const m = results.length;
  // c(m) = sum(1/i for i in 1..m)
  let cm = 0;
  for (let i = 1; i <= m; i++) cm += 1.0 / i;

  const indexed = results.map((r, idx) => ({ idx, p: r.pBlock }));
  indexed.sort((a, b) => a.p - b.p);

  const qValues = new Array(m);
  let minQ = 1.0;

  for (let rank = m; rank >= 1; rank--) {
    const item = indexed[rank - 1];
    const rawQ = (item.p * m * cm) / rank;
    minQ = Math.min(minQ, rawQ);
    qValues[item.idx] = Math.min(1.0, Math.max(0, minQ));
  }

  return qValues;
}

async function main() {
  console.log('================================================================');
  console.log('🏛️  LYZER QUANT LAB — AD016 MULTI-ASSET PASSIVE CARRY DISCOVERY');
  console.log('================================================================\n');

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const engine = new Ad016CarryEngine(spec);

  console.log(`[DISCOVERY] Evaluating ${spec.cells.length} pre-registered cells under BY FDR...`);
  console.log(`[DISCOVERY] Discovery Window: ${spec.discoveryWindow.start} -> ${spec.discoveryWindow.end}\n`);

  const rawResults = [];

  for (let i = 0; i < spec.cells.length; i++) {
    const cell = spec.cells[i];
    process.stdout.write(`[${i + 1}/${spec.cells.length}] Simulating ${cell.id}... `);
    const startMs = Date.now();
    const res = engine.runSimulation(cell, dataDir);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
    console.log(`Done (${elapsed}s) -> Ann: +${res.annualizedReturnPct}%, Sharpe: ${res.sharpeRatio}, MaxDD: ${res.maxDrawdownPct}%, p: ${res.pBlock}`);
    rawResults.push(res);
  }

  // Calculate Benjamini-Yekutieli q-values
  const qValues = calculateBenjaminiYekutieli(rawResults);

  const evaluatedCells = rawResults.map((r, idx) => {
    const qBY = Number(qValues[idx].toFixed(4));
    const gate1 = r.annualizedReturnPct >= spec.evaluationGates.gate1_annualizedNetReturn;
    const gate2 = r.totalNetReturnPct > spec.evaluationGates.gate2_totalNetReturn;
    const gate3 = r.sharpeRatio >= spec.evaluationGates.gate3_sharpeRatio;
    const gate4 = r.maxDrawdownPct <= spec.evaluationGates.gate4_maxDrawdown;
    const gate5 = r.pBlock < spec.evaluationGates.gate5_pValueBlock && qBY < spec.evaluationGates.gate5_qBY;

    const passesAll = gate1 && gate2 && gate3 && gate4 && gate5;

    return {
      ...r,
      qBY,
      gates: { gate1, gate2, gate3, gate4, gate5 },
      verdict: passesAll ? 'APPROVED_FOR_PROMOTION' : 'REJECTED'
    };
  });

  const approvedCount = evaluatedCells.filter(c => c.verdict === 'APPROVED_FOR_PROMOTION').length;

  const summary = {
    campaignId: spec.campaignId,
    timestamp: new Date().toISOString(),
    totalEvaluated: evaluatedCells.length,
    approvedCount,
    status: approvedCount > 0 ? 'DISCOVERY_SUCCESS' : 'ALL_CELLS_REJECTED',
    byFactor: 3.77596,
    results: evaluatedCells
  };

  // Write JSON
  const jsonPath = path.resolve(discoveryDir, 'AD016_DISCOVERY_RESULTS.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`\n[DISCOVERY] Results JSON saved to ${jsonPath}`);

  // Generate Markdown Report
  let md = `# 🏛️ AD016 DISCOVERY REPORT — DUAL-FUNDING G10 & HIGH-YIELD EM CARRY BASKET ENGINES\n\n`;
  md += `**Programa:** AD016  \n`;
  md += `**Data da Execução:** ${summary.timestamp}  \n`;
  md += `**Autoridade:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Status:** ${approvedCount > 0 ? '🟢 BREAKTHROUGH CONFIRMED / APPROVED FOR PROMOTION' : '🔴 ALL CELLS FALSIFIED / FAILED'}  \n\n`;

  md += `## 1. Sumário Executivo\n\n`;
  md += `O programa **AD016** avaliou a diversificação da perna de financiamento entre Iene e Franco Suíço (**Trilha A: Dual-Funding G10 Carry**), a exploração dos diferenciais soberanos de mercados emergentes (**Trilha B: High-Yield EM Carry** com MXN, BRL, ZAR, PLN), e uma alocação híbrida (**Trilha C: All-Weather Multi-Asset Carry**) respaldada por T-Bills a 5,00% a.a. nos períodos defensivos.\n\n`;

  md += `## 2. Matriz Forense de Resultados (${evaluatedCells.length} Células no Discovery 2023–2024)\n\n`;
  md += `| ID | Trilha | Ponderação | EMA | Vol Mult | Ret. Anual | Ret. Total | Sharpe | MaxDD | % T-Bills | p_block | q_BY | Status |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const c of evaluatedCells) {
    const statusIcon = c.verdict === 'APPROVED_FOR_PROMOTION' ? '🟢 PASS' : '🔴 REJECT';
    md += `| **${c.cellId}** | ${c.track.replace('TRACK_', '')} | ${c.weighting} | ${c.emaLookback} | ${c.volatilityMultiplier} | **+${c.annualizedReturnPct}%** | +${c.totalNetReturnPct}% | **${c.sharpeRatio}** | **${c.maxDrawdownPct}%** | ${c.tBillActiveRatioPct}% | ${c.pBlock} | ${c.qBY} | ${statusIcon} |\n`;
  }

  md += `\n## 3. Avaliação dos 5 Gates Constitucionais de Renda Passiva\n\n`;
  md += `1. **Gate 1 (Rendimento Anual Líquido)**: Retorno Anual $\\ge +7,50\\%\\text{ a.a.}$ em dólares.  \n`;
  md += `2. **Gate 2 (Total Return Positivo)**: Lucro Total Líquido $> 0.00\\%$.  \n`;
  md += `3. **Gate 3 (Índice de Sharpe)**: Sharpe Ratio $\\ge 1,50$.  \n`;
  md += `4. **Gate 4 (Preservação Estrita de Capital)**: Drawdown Máximo $\\le 3,50\\%$.  \n`;
  md += `5. **Gate 5 (Significância de Bootstrap & Multiplicidade)**: $p_{\\text{block}} < 0,0500$ e $q_{\\text{BY}} < 0,0500$ sob Benjamini-Yekutieli ($m=24$).  \n\n`;

  if (approvedCount > 0) {
    md += `### 🟢 Veredito: ${approvedCount} célula(s) foram aprovadas em todos os 5 Gates Constitucionais!\n\n`;
    const approved = evaluatedCells.filter(c => c.verdict === 'APPROVED_FOR_PROMOTION');
    for (const a of approved) {
      md += `- **${a.cellId}**: Retorno Anual **+${a.annualizedReturnPct}% a.a.**, Sharpe **${a.sharpeRatio}**, MaxDD **${a.maxDrawdownPct}%**, p_block **${a.pBlock}**, q_BY **${a.qBY}**.\n`;
    }
  } else {
    md += `### 🔴 Veredito: Nenhuma célula atingiu simultaneamente todos os 5 gates constitucionais sob BY FDR.\n`;
  }

  const reportPath = path.resolve(discoveryDir, 'AD016_DISCOVERY_REPORT.md');
  fs.writeFileSync(reportPath, md);
  console.log(`[DISCOVERY] Markdown Report written to ${reportPath}\n`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
