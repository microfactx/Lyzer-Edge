/**
 * LYZER LABS — H018 CONFIRMATORY EXECUTION RUNNER
 * Script: run_h018_confirmatory_validation.js
 * 
 * Objectives:
 * 1. Verifies H018 Preregistration Lock against tampering.
 * 2. Loads the Virgin Temporal Holdout (2025-01-01 -> Present) under strict firewall.
 * 3. Simulates frozen candidate AD012_BTCUSDT_L50_RR30 with exact 24 bps friction.
 * 4. Executes 14-Day Calendar Block Bootstrap (B=10,000, Hall centered, seed 888888).
 * 5. Issues irreversible formal verdict on the 5 Constitutional Gates.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { H018ConfirmatoryEngine } from '../core/h018_confirmatory_engine.js';
import { runCalendarBlockBootstrap } from '../../../alpha_factory/core/inference_battery.js';

const rootDir = process.cwd();
const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function main() {
  console.log('======================================================================');
  console.log('🏛️ LYZER LABS — H018 CONFIRMATORY VALIDATION (VIRGIN HOLDOUT 2025–2026)');
  console.log('======================================================================\n');

  // Step 1: Verify Preregistration Cryptographic Lock
  const lockPath = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/preregistration/H018_PREREGISTRATION_LOCK.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  const charterSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/charter/H018_CONFIRMATORY_CHARTER.md'));
  const specSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/frozen_spec/H018_FROZEN_SPEC.json'));
  const engineSha = hashFile(path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/core/h018_confirmatory_engine.js'));
  const v8Sha = hashFile(path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js'));

  if (charterSha !== lock.files.charter || specSha !== lock.files.frozenSpec || engineSha !== lock.files.engine || v8Sha !== lock.files.v8Invariant) {
    throw new Error('[LOCK_VIOLATION] Cryptographic hash mismatch! Code or spec tampered before holdout validation.');
  }
  console.log('✔ Preregistration Cryptographic Lock Verified: 100% Intact.');

  // Step 2: Load Frozen Spec
  const specPath = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/frozen_spec/H018_FROZEN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  console.log(`✔ Frozen Spec Loaded: Candidate ${spec.originCandidateId} (L=${spec.parameters.macroLookbackBars}, R:R=${spec.parameters.riskRewardRatio}, SL=${spec.parameters.stopLossAtrMultiple}x ATR).`);

  // Step 3: Load Virgin Holdout Candles
  const btcPath = path.resolve(rootDir, 'research/datasets/BTCUSDT_1h_multiyear_2023_2026.json');
  const allCandles = JSON.parse(fs.readFileSync(btcPath, 'utf8'));

  const holdoutStartMs = spec.period.startMs; // 1735689600000 (2025-01-01T00:00:00.000Z)
  const holdoutCandles = allCandles.filter(c => c.timestamp >= holdoutStartMs);

  if (holdoutCandles.length < 5000) {
    throw new Error(`[DATASET_ERROR] Insufficient holdout candles (${holdoutCandles.length} bars found).`);
  }
  console.log(`✔ Virgin Holdout Loaded: ${holdoutCandles.length} 1H bars (${new Date(holdoutCandles[0].timestamp).toISOString()} to ${new Date(holdoutCandles[holdoutCandles.length - 1].timestamp).toISOString()}).\n`);

  // Step 4: Execute Confirmatory Simulation
  console.log('--- Executing Confirmatory Simulation on Virgin Holdout ---');
  const sim = H018ConfirmatoryEngine.simulate(holdoutCandles, spec);
  const trades = sim.trades;
  console.log(`Simulation finished: ${trades.length} trades executed under strict 24 bps friction.\n`);

  // Step 5: Execute 14-Day Calendar Block Bootstrap (B=10,000)
  console.log('--- Executing 14-Day Calendar Block Bootstrap (B=10,000, seed 888888) ---');
  const boot = runCalendarBlockBootstrap(trades, {
    replications: 10000,
    seed: 888888,
    epochStartMs: holdoutStartMs
  });

  const wins = trades.filter(t => t.netR > 0).length;
  const winRatePct = trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;

  // Step 6: Evaluate Constitutional Gates
  const gate1_pBlock = boot.pBlock < spec.constitutionalGates.maxPBlock;
  const gate2_sampleN = trades.length >= spec.constitutionalGates.minTrades;
  const gate3_expectancy = boot.meanNetR >= spec.constitutionalGates.minMeanNetR;
  const gate4_profitFactor = boot.profitFactor >= spec.constitutionalGates.minProfitFactor;
  const gate5_drawdown = boot.totalNetR > 0 && boot.mddR <= spec.constitutionalGates.maxDrawdownR;

  const passedAllGates = gate1_pBlock && gate2_sampleN && gate3_expectancy && gate4_profitFactor && gate5_drawdown;
  const verdict = passedAllGates ? 'CONFIRMATORY_PASS' : 'CONFIRMATORY_REJECTION';

  console.log('\n======================================================================');
  console.log(`CONSTITUTIONAL GATES EVALUATION — VERDICT: ${verdict}`);
  console.log('======================================================================');
  console.log(`Gate 1 (Statistical Significance): p_block = ${boot.pBlock.toFixed(4)} (< 0.0500) -> ${gate1_pBlock ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 2 (Sample Size Power)       : N = ${trades.length} (>= 60)              -> ${gate2_sampleN ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 3 (Economic Expectancy)     : E[R] = ${boot.meanNetR.toFixed(3)}R (>= +0.200R)   -> ${gate3_expectancy ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 4 (Profit Factor)           : PF = ${boot.profitFactor.toFixed(2)} (>= 1.40)          -> ${gate4_profitFactor ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Gate 5 (Net Profit & MaxDD)      : Net = ${boot.totalNetR.toFixed(2)}R, MaxDD = ${boot.mddR.toFixed(2)}R (<= 12.0R) -> ${gate5_drawdown ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`95% Confidence Interval (Net R)  : [${boot.ci95Lower.toFixed(3)}R, ${boot.ci95Upper.toFixed(3)}R]`);
  console.log(`Win Rate                         : ${winRatePct}%\n`);

  // Step 7: Save Results JSON
  const resultsDir = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/results');
  const resultsJsonPath = path.join(resultsDir, 'H018_CONFIRMATORY_RESULTS.json');

  const resultData = {
    hypothesisId: 'H018',
    verdict,
    passedAllGates,
    evaluatedHoldoutBars: holdoutCandles.length,
    holdoutStart: new Date(holdoutCandles[0].timestamp).toISOString(),
    holdoutEnd: new Date(holdoutCandles[holdoutCandles.length - 1].timestamp).toISOString(),
    nTrades: trades.length,
    winRatePct,
    meanNetR: boot.meanNetR,
    profitFactor: boot.profitFactor,
    totalNetR: boot.totalNetR,
    maxDrawdownR: boot.mddR,
    pBlock: boot.pBlock,
    ci95Lower: boot.ci95Lower,
    ci95Upper: boot.ci95Upper,
    gates: {
      gate1_pBlock,
      gate2_sampleN,
      gate3_expectancy,
      gate4_profitFactor,
      gate5_drawdown
    },
    trades
  };

  fs.writeFileSync(resultsJsonPath, JSON.stringify(resultData, null, 2), 'utf8');
  console.log(`✔ Results saved to: ${resultsJsonPath}`);

  // Step 8: Generate Verdict Markdown Report
  generateVerdictReport(resultData);
  console.log('======================================================================\n');
}

function generateVerdictReport(res) {
  const verdictPath = path.resolve(rootDir, 'research/alpha_confirmation/H018_BTC_TREND_BREAKOUT/results/H018_CONFIRMATORY_VERDICT.md');

  let md = `# 🏛️ LYZER LABS — LAUDO DE VEREDITO CONFIRMATÓRIO: HIPÓTESE H018\n`;
  md += `## Auditoria Forense em Holdout Temporal Virgem (2025–2026)\n\n`;
  md += `**Identificador da Hipótese:** \`H018\`  \n`;
  md += `**Data da Homologação:** ${new Date().toISOString()}  \n`;
  md += `**Autoridade Auditante:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Invariante de Produção (Motor V8):** SHA-256 \`fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1\` (**100% INTACTO**)  \n`;
  md += `**Veredito Constitucional:** **${res.passedAllGates ? '🟢 CONFIRMATORY_PASS / HOMOLOGADO' : '🔴 CONFIRMATORY_REJECTION / FALSIFICADO'}**  \n\n`;

  md += `--- \n\n`;
  md += `### 1. Resumo da Performance em Holdout (População Virgem: 2025–2026)\n\n`;
  md += `| Métrica | Limiar Constitucional | Resultado Observado no Holdout | Status |\n`;
  md += `|---|:---:|:---:|:---:|\n`;
  md += `| **Significância Estatística ($p_{\\text{block}}$)** | $< 0.0500$ | **${res.pBlock.toFixed(4)}** | ${res.gates.gate1_pBlock ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Potência Amostral ($N$)** | $\\ge 60$ trades | **${res.nTrades} trades** | ${res.gates.gate2_sampleN ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Expectativa Econômica Líquida ($E[R]$)** | $\\ge +0.200R$ | **${res.meanNetR > 0 ? '+' : ''}${res.meanNetR.toFixed(3)}R** | ${res.gates.gate3_expectancy ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Fator de Lucro (Profit Factor)** | $\\ge 1.40$ | **${res.profitFactor.toFixed(2)}** | ${res.gates.gate4_profitFactor ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Drawdown Máximo em $R$** | $\\le 12.0R$ | **${res.maxDrawdownR.toFixed(2)}R** | ${res.gates.gate5_drawdown ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Retorno Total Líquido** | $> 0.00R$ | **${res.totalNetR > 0 ? '+' : ''}${res.totalNetR.toFixed(2)}R** | ${res.totalNetR > 0 ? '🟢 PASS' : '🔴 FAIL'} |\n`;
  md += `| **Intervalo de Confiança 95%** | $CI_{\\text{lower}} > 0$ | **[${res.ci95Lower.toFixed(3)}R, ${res.ci95Upper.toFixed(3)}R]** | ${res.ci95Lower > 0 ? '🟢 PASS' : '🟡 NEUTRAL'} |\n`;
  md += `| **Taxa de Acerto (Win Rate)** | Informativo | **${res.winRatePct}%** | ℹ️ INFO |\n\n`;

  md += `--- \n\n`;
  md += `### 2. Diagnóstico Científico & Veredito Final\n\n`;
  if (res.passedAllGates) {
    md += `A hipótese **H018 foi HOMOLOGADA COM SUCESSO**. Ela comprovou capacidade de gerar borda positiva e estatisticamente significante fora da amostra no período de 2025–2026 sob estritos custos reais de execução.\n`;
  } else {
    md += `A hipótese **H018 NÃO ATENDEU CUMULATIVAMENTE AOS 5 GATES** no Holdout Temporal Virgem (2025–2026). Em conformidade com o Artigo 19 e 20 da Constituição da Engenharia (\`MASTER_PROMPT.md\`), a promoção para produção é **PERMANENTEMENTE BLOQUEADA**, e o resultado negativo é arquivado sem relaxamento post-hoc de parâmetros.\n`;
  }

  fs.writeFileSync(verdictPath, md, 'utf8');
  console.log(`✔ Verdict Report saved to: ${verdictPath}`);
}

main().catch(err => {
  console.error('[FATAL CONFIRMATORY ERROR]:', err);
  process.exit(1);
});
