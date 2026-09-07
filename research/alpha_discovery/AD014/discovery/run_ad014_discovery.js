/**
 * ALPHA FACTORY — AD014 MACRO CARRY & PASSIVE INCOME DISCOVERY RUNNER
 * Script: run_ad014_discovery.js
 * 
 * Evaluates 16 Regime-Protected Macro Carry cells across 4 assets:
 * - USDJPY (Long Carry: Fed vs BoJ differential ~5.20% a.a.)
 * - EURUSD (Short Carry: Fed vs ECB differential ~1.68% a.a.)
 * - GBPUSD (Short Carry: Fed vs BoE differential ~0.33% a.a.)
 * - BTCUSDT (Delta-Neutral Basis Carry with Staking + Funding ~8.50% a.a.)
 * 
 * Features:
 * - Safe-Haven T-Bill rate (5.00% a.a.) accrued during risk-off cash states.
 * - 14-Day Calendar Block Bootstrap (B=10,000, seed 888888).
 * - Benjamini-Yekutieli multiplicity control for M=16 cells.
 * - Acceptance gates tailored for passive income (AnnYield >= 6.0%, MaxDD <= 4.0%, Sharpe >= 3.0, p < 0.05).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FirewallGuard } from '../../../alpha_factory/core/firewall_guard.js';
import { simulateMacroCarry } from '../core/ad014_macro_carry_engine.js';
import { runCalendarBlockBootstrap, computeBenjaminiYekutieli } from '../../../alpha_factory/core/inference_battery.js';

const rootDir = process.cwd();

async function main() {
  console.log('================================================================');
  console.log('🏛️ ALPHA FACTORY — PROGRAM AD014: PASSIVE MACRO CARRY DISCOVERY');
  console.log('================================================================\n');

  // Step 1: V8 Invariant Verification
  const v8Path = path.resolve(rootDir, 'packages/lyzer-shared/src/providers/institutional_quant_signal_engine.js');
  FirewallGuard.assertV8EngineInvariant(v8Path);
  console.log('✔ Engine V8 Invariant Verified: fc19e807...b4db1 intact.');

  // Step 2: Load Campaign Spec
  const specPath = path.resolve(rootDir, 'research/alpha_discovery/AD014/spec/AD014_CAMPAIGN_SPEC.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  const dataDir = path.resolve(rootDir, 'research/alpha_discovery/AD014/data');
  const targetAssets = ['USDJPY', 'EURUSD', 'GBPUSD', 'BTCUSDT'];

  console.log(`Universe: ${targetAssets.join(', ')}`);
  console.log(`Grid Cells: ${spec.cells.length} hypotheses under BY (M=${spec.governance.totalHypotheses}).`);
  console.log(`Safe-Haven T-Bill Yield: ${(spec.macroRates.SAFE_HAVEN_TBILL_RATE * 100).toFixed(2)}% p.a. in cash states.\n`);

  // Step 3: Load Discovery Candles & Enforce Firewall
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

  // Step 4: Run Simulation & Block Bootstrap for Each Cell
  console.log('--- Executing Macro Carry Simulation & 14-Day Block Bootstrap ---');
  for (let i = 0; i < spec.cells.length; i++) {
    const cell = spec.cells[i];
    const assetCandles = panel[cell.asset];
    const profile = spec.assetCarryProfiles[cell.asset];

    const simRes = simulateMacroCarry(assetCandles, cell, profile, spec.macroRates.SAFE_HAVEN_TBILL_RATE);
    const hourlyReturns = simRes.hourlyReturns;

    // Partition into 14-day blocks (336 hours per block) for Block Bootstrap
    const blockSize = 336;
    const blockReturns = [];
    for (let b = 0; b < hourlyReturns.length; b += blockSize) {
      const chunk = hourlyReturns.slice(b, b + blockSize);
      if (chunk.length >= blockSize * 0.5) {
        let blockNav = 1.0;
        for (const r of chunk) blockNav *= (1 + r);
        const blockRetPct = (blockNav - 1.0) * 100;
        blockReturns.push({
          netR: blockRetPct,
          timestamp: simRes.equityCurve[Math.min(b + blockSize - 1, simRes.equityCurve.length - 1)].timestamp
        });
      }
    }

    // Run Calendar Block Bootstrap
    const boot = runCalendarBlockBootstrap(blockReturns, {
      replications: spec.governance.bootstrapIterations || 10000,
      seed: 888888
    });

    rawResults.push({
      id: cell.id,
      asset: cell.asset,
      emaLookback: cell.emaLookback,
      volRatioThreshold: cell.volRatioThreshold,
      totalHours: simRes.summary.totalHours,
      totalReturnPct: simRes.summary.totalReturnPct,
      annualizedReturnPct: simRes.summary.annualizedReturnPct,
      maxDrawdownPct: simRes.summary.maxDrawdownPct,
      sharpeRatio: simRes.summary.sharpeRatio,
      transitions: simRes.summary.transitions,
      activeCarryRatioPct: simRes.summary.activeCarryRatioPct,
      finalNav: simRes.summary.finalNav,
      nBlocks: blockReturns.length,
      meanNetRPerBlock: boot.meanNetR,
      ci95Lower: boot.ci95Lower,
      ci95Upper: boot.ci95Upper,
      pBlock: boot.pBlock,
      profitFactor: boot.profitFactor
    });

    process.stdout.write(`[${String(i + 1).padStart(2)}/${spec.cells.length}] ${cell.id.padEnd(30)} -> AnnRet=+${simRes.summary.annualizedReturnPct.toFixed(2).padStart(5)}% | MaxDD=${simRes.summary.maxDrawdownPct.toFixed(2).padStart(4)}% | Sharpe=${simRes.summary.sharpeRatio.toFixed(2).padStart(4)} | Active=${simRes.summary.activeCarryRatioPct.toFixed(1)}% | p=${boot.pBlock.toFixed(4)}\n`);
  }

  // Step 5: Multiplicity Correction (Benjamini-Yekutieli, M=16)
  console.log('\n--- Computing Benjamini-Yekutieli Multiplicity Corrections (M=16) ---');
  const pValues = rawResults.map(r => r.pBlock);
  const byResults = computeBenjaminiYekutieli(pValues, spec.governance.significanceLevel || 0.05);

  const finalResults = rawResults.map((r, idx) => {
    const qBY = byResults[idx]?.qValue !== undefined ? byResults[idx].qValue : 1.0;

    // Gate 1: Annualized Return >= 6.00% p.a.
    const passAnnYield = r.annualizedReturnPct >= spec.gates.gate1_minAnnualizedReturnPct;
    // Gate 2: Total Return > 0.00%
    const passTotRet = r.totalReturnPct > spec.gates.gate2_minTotalReturnPct;
    // Gate 3: Sharpe Ratio >= 3.00
    const passSharpe = r.sharpeRatio >= spec.gates.gate3_minSharpeRatio;
    // Gate 4: Max Drawdown <= 4.00%
    const passMaxDD = r.maxDrawdownPct <= spec.gates.gate4_maxDrawdownPct;
    // Gate 5: p_block < 0.0500 and q_BY < 0.0500
    const passP = r.pBlock < spec.gates.gate5_maxBlockBootstrapPValue;
    const passBY = qBY < spec.gates.gate5_maxBenjaminiYekutieliQ;

    const allPassed = passAnnYield && passTotRet && passSharpe && passMaxDD && passP && passBY;

    return {
      ...r,
      qBY,
      gates: {
        passAnnYield,
        passTotRet,
        passSharpe,
        passMaxDD,
        passP,
        passBY,
        allPassed
      },
      status: allPassed ? 'ELIGIBLE_FOR_CONFIRMATION' : 'FALSIFIED_OR_FAILED_GATES'
    };
  });

  // Step 6: Summary and Decision
  const eligibleCells = finalResults.filter(r => r.gates.allPassed);
  console.log(`\n================================================================`);
  console.log(`EVALUATION COMPLETE: ${eligibleCells.length}/${finalResults.length} cells passed ALL 5 PASSIVE INCOME GATES.`);
  console.log(`================================================================\n`);

  if (eligibleCells.length > 0) {
    console.log('🏆 APPROVED PASSIVE INCOME CANDIDATES:');
    for (const e of eligibleCells) {
      console.log(`- ${e.id.padEnd(30)}: AnnRet=+${e.annualizedReturnPct}% | Sharpe=${e.sharpeRatio} | MaxDD=${e.maxDrawdownPct}% | p=${e.pBlock.toFixed(4)} | q_BY=${e.qBY.toFixed(4)}`);
    }
  }

  // Step 7: Save Results JSON
  const outResultsPath = path.resolve(rootDir, 'research/alpha_discovery/AD014/discovery/AD014_DISCOVERY_RESULTS.json');
  fs.writeFileSync(outResultsPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD014',
    executionDate: new Date().toISOString(),
    totalCells: finalResults.length,
    eligibleCount: eligibleCells.length,
    eligibleCells: eligibleCells.map(c => c.id),
    cells: finalResults
  }, null, 2), 'utf8');
  console.log(`\n✔ Results saved to: ${outResultsPath}`);

  // Step 8: Generate Comprehensive Markdown Report
  generateDiscoveryReport(finalResults, eligibleCells);

  // Step 9: Save Manifest
  const manifestPath = path.resolve(rootDir, 'research/alpha_discovery/AD014/discovery/AD014_DISCOVERY_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    program: 'ALPHA_DISCOVERY_AD014',
    timestamp: new Date().toISOString(),
    resultsSha256: crypto.createHash('sha256').update(fs.readFileSync(outResultsPath)).digest('hex'),
    eligibleCells: eligibleCells.map(c => c.id)
  }, null, 2), 'utf8');
  console.log(`✔ Manifest saved to: ${manifestPath}\n`);
}

function generateDiscoveryReport(results, eligible) {
  const reportPath = path.resolve(rootDir, 'research/alpha_discovery/AD014/discovery/AD014_DISCOVERY_REPORT.md');

  let md = `# 🏛️ AD014 DISCOVERY REPORT — ALGORITHMIC PASSIVE INCOME & REGIME-PROTECTED MACRO CARRY\n\n`;
  md += `**Programa:** AD014  \n`;
  md += `**Data da Execução:** ${new Date().toISOString()}  \n`;
  md += `**Autoridade:** Senior CTO & Executive Engineering Director  \n`;
  md += `**Status:** ${eligible.length > 0 ? '🟢 DISCOVERY SUCCESS — PASSIVE INCOME ALPHAS HOMOLOGATED' : '🔴 ALL CELLS FALSIFIED / FAILED'}  \n\n`;

  md += `## 1. Sumário Executivo\n\n`;
  md += `O programa **AD014** investigou formalmente motores de **Renda Passiva Algorítmica** baseados em Carry Trade Macro com Disjuntor Dinâmico de Regime e Rendimento Seguro em T-Bills Soberanas ($5,00\\%\\text{ a.a.}$). Foram avaliadas 16 células cobrindo moedas G10 e Cripto Delta-Neutro:\n`;
  md += `* **USDJPY**: Long Carry capturando diferencial Fed ($5,33\\%$) vs BoJ ($0,10\\%$) $= +5,20\\%\\text{ a.a.}$\n`;
  md += `* **EURUSD**: Short Carry capturando diferencial Fed ($5,33\\%$) vs ECB ($3,65\\%$) $= +1,68\\%\\text{ a.a.}$\n`;
  md += `* **GBPUSD**: Short Carry capturando diferencial Fed ($5,33\\%$) vs BoE ($5,00\\%$) $= +0,33\\%\\text{ a.a.}$\n`;
  md += `* **BTCUSDT**: Delta-Neutral Basis Carry com Staking Líquido e Funding Perpétuo ($+8,50\\%\\text{ a.a.}$) benchmark.\n\n`;

  md += `## 2. Matriz Forense de Resultados (16 Células no Discovery 2023–2024)\n\n`;
  md += `| ID | Ativo | EMA | Vol Lim | Ret. Anual | Ret. Total | Sharpe | MaxDD | % Tempo Ativo | Giros | p_block | q_BY | Status |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    const statusIcon = r.gates.allPassed ? '🟢 PASS' : '🔴 REJECT';
    md += `| **${r.id}** | ${r.asset} | ${r.emaLookback} | ${r.volRatioThreshold} | **+${r.annualizedReturnPct}%** | +${r.totalReturnPct}% | **${r.sharpeRatio}** | **${r.maxDrawdownPct}%** | ${r.activeCarryRatioPct}% | ${r.transitions} | ${r.pBlock.toFixed(4)} | ${r.qBY.toFixed(4)} | ${statusIcon} |\n`;
  }

  md += `\n## 3. Avaliação dos 5 Gates Constitucionais de Renda Passiva\n\n`;
  md += `1. **Gate 1 (Rendimento Anual Líquido)**: Retorno Anual $\\ge +6.00\\%\\text{ a.a.}$ em dólares.  \n`;
  md += `2. **Gate 2 (Retorno Total Líquido)**: Lucro Total Líquido $> 0.00\\%$.  \n`;
  md += `3. **Gate 3 (Índice de Sharpe)**: Sharpe Ratio $\\ge 3.00$.  \n`;
  md += `4. **Gate 4 (Preservação de Capital / Max Drawdown)**: Drawdown Máximo $\\le 4.00\\%$.  \n`;
  md += `5. **Gate 5 (Significância de Bootstrap & Multiplicidade)**: $p_{\\text{block}} < 0.0500$ e $q_{\\text{BY}} < 0.0500$ sob Benjamini-Yekutieli ($m=16$).  \n\n`;

  if (eligible.length > 0) {
    md += `### 🟢 Células Aprovadas para Promoção Confirmatória:\n`;
    for (const e of eligible) {
      md += `* **\`${e.id}\`** (${e.asset}): Retorno Anualizado **+${e.annualizedReturnPct}% a.a.**, Sharpe **${e.sharpeRatio}**, MaxDD **${e.maxDrawdownPct}%**, Ativo **${e.activeCarryRatioPct}%** do tempo, $p=${e.pBlock.toFixed(4)}$, $q_{\\text{BY}}=${e.qBY.toFixed(4)}$.\n`;
    }
  } else {
    md += `### 🔴 Veredito: Nenhuma célula atingiu simultaneamente os 5 gates constitucionais.\n`;
  }

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`✔ Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('[FATAL DISCOVERY ERROR]:', err);
  process.exit(1);
});
