/**
 * LYZER LABS — H019 CONFIRMATORY EXECUTION RUNNER
 * Script: run_h019_confirmatory_validation.js
 * 
 * Objectives:
 * 1. Verifies H019 Preregistration Lock against tampering (Charter, Spec, Engine, V8 Invariant).
 * 2. Loads Virgin Temporal Holdout (2025-01-01 -> Present) across all 4 JPY carry pairs.
 * 3. Simulates frozen candidate AD015_EW_UNIFIED_EMA200_VOL135 with 3.0 bps turnover friction and 5.0% T-Bills refuge.
 * 4. Executes 14-Day Calendar Block Bootstrap (B=10,000, Hall centered, seed 888888).
 * 5. Issues irreversible formal verdict on the 5 Constitutional Gates.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { H019ConfirmatoryEngine } from '../core/h019_confirmatory_engine.js';
import { runCalendarBlockBootstrap } from '../../../alpha_factory/core/inference_battery.js';

const rootDir = process.cwd();
const hashFile = p => {
  const content = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

async function main() {
  console.log('======================================================================');
  console.log('🏛️ LYZER LABS — H019 CONFIRMATORY VALIDATION (VIRGIN HOLDOUT 2025–2026)');
  console.log('Strategy: Diversified Multi-Currency Carry Basket (4-JPY + T-Bills)');
  console.log('======================================================================\n');

  // Step 1: Verify Preregistration Cryptographic Lock
  const lockPath = path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/preregistration/H019_PREREGISTRATION_LOCK.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  const charterSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/charter/H019_CONFIRMATORY_CHARTER.md'));
  const specSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/frozen_spec/H019_FROZEN_SPEC.json'));
  const engineSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/core/h019_confirmatory_engine.js'));
  const v8Sha = hashFile(path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js'));

  if (charterSha !== lock.files.charter || specSha !== lock.files.frozenSpec || engineSha !== lock.files.engine || v8Sha !== lock.files.v8Invariant) {
    console.error('SHA Check:', {
      charter: { computed: charterSha, expected: lock.files.charter },
      spec: { computed: specSha, expected: lock.files.frozenSpec },
      engine: { computed: engineSha, expected: lock.files.engine },
      v8: { computed: v8Sha, expected: lock.files.v8Invariant }
    });
    throw new Error('[LOCK_VIOLATION] Cryptographic hash mismatch! Code or spec tampered before holdout validation.');
  }
  console.log('✔ Preregistration Cryptographic Lock Verified: 100% Intact.');

  // Step 2: Load Frozen Spec
  const specPath = path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/frozen_spec/H019_FROZEN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  console.log(`✔ Frozen Spec Loaded: Candidate ${spec.cellOrigin} (EMA=${spec.parameters.emaLookback}, Vol=${spec.parameters.volRatioThreshold}x, Dwell=${spec.parameters.dwellHours}h).`);

  // Step 3: Load Virgin Holdout Datasets for All 4 Pairs
  const holdoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD015/holdout_sealed');
  const pairs = Object.keys(spec.pairs);
  const rawPanels = {};

  for (const p of pairs) {
    const filePath = path.join(holdoutDir, `${p}_1h_holdout.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`[DATASET_ERROR] Missing sealed holdout dataset for ${p} at: ${filePath}`);
    }
    const candles = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    rawPanels[p] = candles;
    console.log(`✔ [${p}] Loaded ${candles.length} sealed virgin holdout candles.`);
  }

  // Step 4: Synchronize Multi-Asset Panels
  const syncedData = H019ConfirmatoryEngine.synchronizePanels(rawPanels);
  const totalBars = syncedData.timestamps.length;
  if (totalBars < 5000) {
    throw new Error(`[DATASET_ERROR] Insufficient synchronized holdout candles (${totalBars} bars found).`);
  }

  const startDateIso = new Date(syncedData.timestamps[0]).toISOString();
  const endDateIso = new Date(syncedData.timestamps[totalBars - 1]).toISOString();
  console.log(`✔ Synchronized: ${totalBars} common hourly bars (${startDateIso} to ${endDateIso}).\n`);

  // Step 5: Execute Confirmatory Simulation
  console.log('--- Executing Confirmatory Simulation on Virgin Holdout ---');
  const sim = H019ConfirmatoryEngine.simulate(syncedData, spec);
  const summary = sim.summary;

  console.log(`Simulation complete:`);
  console.log(`  Total Evaluated: ${summary.totalHours} hours (${summary.totalDays} days, ${summary.yearsEvaluated} years)`);
  console.log(`  Total Net Return: ${summary.totalNetReturnPct > 0 ? '+' : ''}${summary.totalNetReturnPct}%`);
  console.log(`  Annualized Return: ${summary.annualizedReturnPct > 0 ? '+' : ''}${summary.annualizedReturnPct}% a.a.`);
  console.log(`  Max Drawdown: ${summary.maxDrawdownPct}%`);
  console.log(`  Annualized Sharpe: ${summary.annualizedSharpe}`);
  console.log(`  Time in Carry: ${summary.activeHoursRatioPct}% | Time in T-Bills: ${summary.tBillsHoursRatioPct}%`);
  console.log(`  Turnover Transitions: ${summary.turnoverTransitions} | Fee Drag: ${summary.totalTurnoverFrictionPct}%\n`);

  // Step 6: Execute 14-Day Calendar Block Bootstrap (B=10,000, seed 888888)
  console.log('--- Executing 14-Day Calendar Block Bootstrap (B=10,000, seed 888888) ---');
  const blockReturns = sim.blockReturns;
  console.log(`Partitioned equity curve into ${blockReturns.length} calendar blocks of 14 days.`);

  const boot = runCalendarBlockBootstrap(blockReturns, {
    replications: spec.confirmatoryGates.gate5_statisticalSignificance.bootstrapIterations || 10000,
    seed: 888888,
    epochStartMs: spec.holdoutPeriod.startMs
  });

  console.log(`Bootstrap Evaluation Completed:`);
  console.log(`  p_block: ${boot.pBlock.toFixed(4)}`);
  console.log(`  Mean Block Return: ${boot.meanNetR.toFixed(3)}%`);
  console.log(`  95% CI: [${boot.ci95Lower.toFixed(3)}%, ${boot.ci95Upper.toFixed(3)}%]\n`);

  // Step 7: Evaluate the 5 Constitutional Gates
  const gate1_annReturn = summary.annualizedReturnPct >= 6.00;
  const gate2_netReturn = summary.totalNetReturnPct > 0.00;
  const gate3_sharpe = summary.annualizedSharpe >= 1.20;
  const gate4_maxDrawdown = summary.maxDrawdownPct <= 4.00;
  const gate5_pBlock = boot.pBlock < 0.0500;

  const passedAllGates = gate1_annReturn && gate2_netReturn && gate3_sharpe && gate4_maxDrawdown && gate5_pBlock;
  const verdict = passedAllGates ? 'CONFIRMATORY_PASS' : 'CONFIRMATORY_REJECTION';

  console.log('======================================================================');
  console.log(`CONSTITUTIONAL GATES EVALUATION — VERDICT: ${verdict}`);
  console.log('======================================================================');
  console.log(`Gate 1 (Annualized Net Yield) : AnnYield = ${summary.annualizedReturnPct.toFixed(2)}% a.a. (>= +6.00% a.a.) -> ${gate1_annReturn ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 2 (Total Net Return)     : NetReturn = ${summary.totalNetReturnPct.toFixed(2)}% (> 0.00%)              -> ${gate2_netReturn ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 3 (Annualized Sharpe)    : Sharpe = ${summary.annualizedSharpe.toFixed(2)} (>= 1.20)                    -> ${gate3_sharpe ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 4 (Capital Preservation) : MaxDD = ${summary.maxDrawdownPct.toFixed(2)}% (<= 4.00%)                   -> ${gate4_maxDrawdown ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 5 (Statistical Significance): p_block = ${boot.pBlock.toFixed(4)} (< 0.0500)                        -> ${gate5_pBlock ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('======================================================================\n');

  // Step 8: Save Structured Results JSON
  const resultsDir = path.resolve(rootDir, 'research/alpha_confirmation/H019_BASKET_CARRY/results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const resultsJsonPath = path.join(resultsDir, 'H019_CONFIRMATORY_RESULTS.json');
  const resultData = {
    hypothesisId: 'H019',
    name: spec.name,
    cellOrigin: spec.cellOrigin,
    verdict,
    passedAllGates,
    evaluationWindow: {
      totalBars,
      totalHours: summary.totalHours,
      totalDays: summary.totalDays,
      yearsEvaluated: summary.yearsEvaluated,
      startDate: startDateIso,
      endDate: endDateIso
    },
    metrics: summary,
    bootstrap: {
      nBlocks: blockReturns.length,
      pBlock: boot.pBlock,
      meanBlockReturnPct: boot.meanNetR,
      profitFactor: boot.profitFactor,
      ci95Lower: boot.ci95Lower,
      ci95Upper: boot.ci95Upper
    },
    gates: {
      gate1_annualizedReturn: { passed: gate1_annReturn, actual: summary.annualizedReturnPct, threshold: '>= 6.00' },
      gate2_totalReturn: { passed: gate2_netReturn, actual: summary.totalNetReturnPct, threshold: '> 0.00' },
      gate3_sharpeRatio: { passed: gate3_sharpe, actual: summary.annualizedSharpe, threshold: '>= 1.20' },
      gate4_maxDrawdown: { passed: gate4_maxDrawdown, actual: summary.maxDrawdownPct, threshold: '<= 4.00' },
      gate5_statisticalSignificance: { passed: gate5_pBlock, actual: boot.pBlock, threshold: '< 0.0500' }
    }
  };

  fs.writeFileSync(resultsJsonPath, JSON.stringify(resultData, null, 2), 'utf8');
  console.log(`✔ Results JSON saved to: ${resultsJsonPath}`);

  // Step 9: Generate Verdict Markdown Report
  generateVerdictReport(resultData, path.join(resultsDir, 'H019_CONFIRMATORY_VERDICT.md'));
  console.log('======================================================================\n');
}

function generateVerdictReport(res, verdictPath) {
  let md = `# 🏛️ LYZER LABS — LAUDO DE VEREDITO CONFIRMATÓRIO: HIPÓTESE H019\n`;
  md += `## Auditoria Forense em Holdout Temporal Virgem (2025–2026)\n\n`;
  md += `**Identificador da Hipótese:** \`H019\`  \n`;
  md += `**Estratégia:** ${res.name} (\`${res.cellOrigin}\`)  \n`;
  md += `**Data da Homologação:** ${new Date().toISOString()}  \n`;
  md += `**Autoridade Auditante:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Invariante de Produção (Motor V8):** SHA-256 \`fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1\` (**100% INTACTO**)  \n`;
  md += `**Veredito Constitucional:** **${res.passedAllGates ? '🟢 CONFIRMATORY_PASS / HOMOLOGADO PARA PRODUÇÃO' : '🔴 CONFIRMATORY_REJECTION / ARQUIVADO'}**  \n\n`;

  md += `--- \n\n`;
  md += `### 1. Resumo da Performance no Holdout Virgem (2025–2026)\n\n`;
  md += `| Métrica | Limiar Constitucional | Resultado Observado no Holdout | Status |\n`;
  md += `|---|:---:|:---:|:---:|\n`;
  md += `| **Gate 1: Rendimento Anualizado Líquido** | $\\ge +6.00\\%\\text{ a.a.}$ | **${res.metrics.annualizedReturnPct > 0 ? '+' : ''}${res.metrics.annualizedReturnPct.toFixed(2)}\\% a.a.** | ${res.gates.gate1_annualizedReturn.passed ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Gate 2: Retorno Total Líquido** | $> 0.00\\%$ | **${res.metrics.totalNetReturnPct > 0 ? '+' : ''}${res.metrics.totalNetReturnPct.toFixed(2)}\\%** | ${res.gates.gate2_totalReturn.passed ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Gate 3: Índice de Sharpe Anualizado** | $\\ge 1.20$ | **${res.metrics.annualizedSharpe.toFixed(2)}** | ${res.gates.gate3_sharpeRatio.passed ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Gate 4: Drawdown Máximo (Preservação)** | $\\le 4.00\\%$ | **${res.metrics.maxDrawdownPct.toFixed(2)}\\%** | ${res.gates.gate4_maxDrawdown.passed ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Gate 5: Significância Primária ($p_{\\text{block}}$)** | $< 0.0500$ | **${res.bootstrap.pBlock.toFixed(4)}** | ${res.gates.gate5_statisticalSignificance.passed ? '🟢 PASS' : '🔴 FAIL'} |\n\n`;

  md += `### 2. Métricas Operacionais e Dinâmica de Regime\n\n`;
  md += `- **Período Avaliado:** ${res.evaluationWindow.startDate} até ${res.evaluationWindow.endDate} (${res.evaluationWindow.totalDays} dias / ${res.evaluationWindow.yearsEvaluated} anos)\n`;
  md += `- **Tempo Ativo em Carry (Cesta 4-JPY):** ${res.metrics.activeHoursRatioPct}%\n`;
  md += `- **Tempo em Refúgio Soberano (US T-Bills a 5.0%):** ${res.metrics.tBillsHoursRatioPct}%\n`;
  md += `- **Transições de Regime / Giros:** ${res.metrics.turnoverTransitions}\n`;
  md += `- **Fricção Total de Turnover (Atrito):** ${res.metrics.totalTurnoverFrictionPct}%\n`;
  md += `- **Intervalo de Confiança 95% do Retorno Médio:** [${res.bootstrap.ci95Lower.toFixed(3)}%, ${res.bootstrap.ci95Upper.toFixed(3)}%]\n\n`;

  md += `--- \n\n`;
  md += `### 3. Veredito Final & Diretrizes Constitucionais\n\n`;
  if (res.passedAllGates) {
    md += `A hipótese **H019 FOI HOMOLOGADA COM SUCESSO**. Todos os 5 Gates Constitucionais foram atendidos cumulativamente no Holdout Virgem (2025–2026). A estratégia comprovou sua capacidade de colher o carrego de juros do G10, conter o drawdown via disjuntor unificado e acumular rendimento seguro em T-Bills durante reversões cambiais severas.\n\n`;
    md += `Ela junta-se a **H017** no seleto grupo de estratégias de **Produção Homologada** da Lyzer Labs.\n`;
  } else {
    md += `A hipótese **H019 NÃO ATENDEU A TODOS OS 5 GATES** no Holdout Temporal Virgem (2025–2026). Em consonância estrita com a Constituição da Engenharia (*"O Tribunal Nunca Aprende"*), a promoção para produção é **PERMANENTEMENTE BLOQUEADA**, vedando-se qualquer relaxamento *post-hoc* de parâmetros ou busca de dados adicionais.\n`;
  }

  fs.writeFileSync(verdictPath, md, 'utf8');
  console.log(`✔ Verdict Markdown saved to: ${verdictPath}`);
}

main().catch(err => {
  console.error('[FATAL CONFIRMATORY ERROR]:', err);
  process.exit(1);
});
