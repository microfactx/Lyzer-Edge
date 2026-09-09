/**
 * simulate_ce_b001.js
 * Capital Engine Batch 001 - Full Monthly Simulation (t = 1 to 180 months)
 * Evaluating Consórcio + Real Estate vs BRL Fixed Income Benchmarks
 */

const P0 = 100000; // R$ 100k
const T = 180; // 180 months (15 years)

// Macro Rates
const CDI_ANNUAL = 0.1390; // 13.90% a.a.
const IPCA_ANNUAL = 0.0400; // 4.0% a.a.
const INCC_ANNUAL = 0.0480; // 4.8% a.a. (INCC historic spread over IPCA)

function getMonthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

const r_cdi_monthly = getMonthlyRate(CDI_ANNUAL);
const r_ipca_monthly = getMonthlyRate(IPCA_ANNUAL);
const r_incc_monthly = getMonthlyRate(INCC_ANNUAL);

// Tax on Fixed Income
function getRFTaxRate(month) {
  if (month <= 6) return 0.225;
  if (month <= 12) return 0.200;
  if (month <= 24) return 0.175;
  return 0.150;
}

// 1. Simulate Benchmark (CDB 100%, CDB 115%, LCI 92%)
function simulateBenchmark(type = "CDB100") {
  let balance = P0;
  const history = [balance];
  
  for (let m = 1; m <= T; m++) {
    let grossMonthly;
    let tax;
    if (type === "CDB100") {
      grossMonthly = r_cdi_monthly;
      tax = getRFTaxRate(m);
      balance *= (1 + grossMonthly * (1 - tax));
    } else if (type === "CDB115") {
      grossMonthly = getMonthlyRate(CDI_ANNUAL * 1.15);
      tax = getRFTaxRate(m);
      balance *= (1 + grossMonthly * (1 - tax));
    } else if (type === "LCI92") {
      grossMonthly = getMonthlyRate(CDI_ANNUAL * 0.92);
      balance *= (1 + grossMonthly); // tax exempt
    }
    history.push(balance);
  }
  return history;
}

// 2. Simulate Consorcio + Real Estate Architecture
function simulateConsorcioStrategy(params) {
  const {
    name,
    cartaNominal = 300000,
    lanceEmbutidoPct = 0.20, // 20%
    lanceProprio = 30000,   // R$ 30k
    taxaAdmTotal = 0.20,    // 20%
    fundoReserva = 0.02,    // 2%
    prazo = 180,
    rentYieldGrossMonthly = 0.0050, // 0.50% / month
    vacancyPct = 0.08,             // 8% vacancy (approx 1 month a year)
    admFeeRealEstate = 0.10,       // 10% imobiliária
    taxOnRent = 0.15,              // Carnê-leão
    maintenanceReserve = 0.05,     // 5% of rent for repairs
    entryFrictionPct = 0.04        // 4% ITBI + cartório on property value
  } = params;

  // Initial Financial Setup
  const lanceEmbutidoVal = cartaNominal * lanceEmbutidoPct;
  const netLetterVal = cartaNominal - lanceEmbutidoVal; // Net property purchase power
  const propertyInitialVal = netLetterVal;
  const entryFrictionVal = propertyInitialVal * entryFrictionPct; // ITBI/cartório paid in cash

  let cashCore = P0 - lanceProprio - entryFrictionVal;
  if (cashCore < 0) {
    return { error: "INSOLVENT_AT_T0: Lance proprio + custos de aquisicao superam R$ 100k." };
  }

  // Debt setup: Total cost of letter
  const totalCostNominal = cartaNominal * (1 + taxaAdmTotal + fundoReserva);
  const totalLance = lanceEmbutidoVal + lanceProprio;
  const lanceCoveragePct = totalLance / cartaNominal;

  // Remaining debt amortized proportionally by lance
  let remainingDebt = totalCostNominal * (1 - lanceCoveragePct);
  let baseMonthlyInstallment = remainingDebt / prazo;

  let propertyValue = propertyInitialVal;
  let defaultEvent = false;
  let minCashCore = cashCore;
  let totalCashFlowLyzer = 0;

  const navHistory = [];
  const cashCoreHistory = [];
  const dscrHistory = [];

  let initialInvestedTaxBase = propertyInitialVal + entryFrictionVal;

  for (let m = 1; m <= T; m++) {
    // Annual adjustment by INCC for consórcio
    if (m > 1 && (m - 1) % 12 === 0) {
      remainingDebt *= (1 + INCC_ANNUAL);
      baseMonthlyInstallment *= (1 + INCC_ANNUAL);
    }

    // Property appreciation by IPCA
    propertyValue *= (1 + r_ipca_monthly);

    // Installment deduction
    remainingDebt = Math.max(0, remainingDebt - baseMonthlyInstallment);

    // Rental Income
    const grossRent = propertyValue * rentYieldGrossMonthly;
    // Vacancy effect:
    const effectiveRent = grossRent * (1 - vacancyPct);
    const vacancyCost = (grossRent * vacancyPct) * 0.30; // Condo/IPTU during vacancy
    const netRentBeforeTax = (effectiveRent * (1 - admFeeRealEstate - maintenanceReserve)) - vacancyCost;
    const netRent = netRentBeforeTax * (1 - taxOnRent);

    // Monthly Cash Flow from Asset
    const deltaCashFlowAsset = netRent - baseMonthlyInstallment;

    // Core cash return
    const rfTax = getRFTaxRate(m);
    const coreInterest = cashCore > 0 ? cashCore * (r_cdi_monthly * (1 - rfTax)) : 0;

    // Update Core Cash
    cashCore += coreInterest + deltaCashFlowAsset;

    // Track minimum cash and default
    if (cashCore < minCashCore) minCashCore = cashCore;
    if (cashCore < 0) defaultEvent = true;

    // Free Cash Flow to Lyzer: Only if Core Cash is above safe threshold (e.g. R$ 20k)
    let freeCashToLyzer = 0;
    if (cashCore > 20000 && deltaCashFlowAsset > 0) {
      freeCashToLyzer = deltaCashFlowAsset * 0.50; // 50% can be sent to Lyzer
      cashCore -= freeCashToLyzer;
      totalCashFlowLyzer += freeCashToLyzer;
    }

    // DSCR
    const dscr = (netRent + coreInterest) / (baseMonthlyInstallment > 0 ? baseMonthlyInstallment : 1);
    dscrHistory.push(dscr);

    // True NAV Calculation:
    // Property net of 6% selling broker fee and capital gain tax
    const exitBrokerCost = propertyValue * 0.06;
    const capitalGain = Math.max(0, (propertyValue - exitBrokerCost) - initialInvestedTaxBase);
    const capitalGainTax = capitalGain * 0.15;
    const netPropertyRealizable = propertyValue - exitBrokerCost - capitalGainTax;

    const nav = netPropertyRealizable + cashCore - remainingDebt;
    navHistory.push(nav);
    cashCoreHistory.push(cashCore);
  }

  return {
    name,
    finalNav: navHistory[T - 1],
    navHistory,
    cashCoreHistory,
    dscrHistory,
    minCashCore,
    defaultEvent,
    totalCashFlowLyzer,
    navAt3Y: navHistory[35],
    navAt5Y: navHistory[59],
    navAt10Y: navHistory[119],
    navAt15Y: navHistory[179]
  };
}

// Run Benchmarks
const bCDB100 = simulateBenchmark("CDB100");
const bCDB115 = simulateBenchmark("CDB115");
const bLCI92 = simulateBenchmark("LCI92");

// Run Strategies
const strategies = [
  // Strategy 1: All-In Lance Proprio (R$ 100k lance, no cash reserve left)
  simulateConsorcioStrategy({
    name: "C1: Lance Próprio 100% (All-In)",
    cartaNominal: 300000,
    lanceEmbutidoPct: 0.00,
    lanceProprio: 88000, // Leaves R$ 12k for 4% ITBI
    rentYieldGrossMonthly: 0.0050,
    vacancyPct: 0.08
  }),

  // Strategy 2: Lance Embutido 20% + R$ 30k proprio (Conservative)
  simulateConsorcioStrategy({
    name: "C2: Lance Embutido 20% + R$ 30k Próprio (Baseline Vac 8%)",
    cartaNominal: 300000,
    lanceEmbutidoPct: 0.20,
    lanceProprio: 30000,
    rentYieldGrossMonthly: 0.0050,
    vacancyPct: 0.08
  }),

  // Strategy 3: Lance Embutido 20% + R$ 30k proprio with High Vacancy (Stress 15%)
  simulateConsorcioStrategy({
    name: "C3: Lance Embutido 20% + R$ 30k Próprio (Estresse Vac 15%)",
    cartaNominal: 300000,
    lanceEmbutidoPct: 0.20,
    lanceProprio: 30000,
    rentYieldGrossMonthly: 0.0050,
    vacancyPct: 0.15
  }),

  // Strategy 4: High Yield Property (0.65% month) + Lance Embutido
  simulateConsorcioStrategy({
    name: "C4: Alta Rentabilidade (Yield 0.65%/m) + Embutido",
    cartaNominal: 300000,
    lanceEmbutidoPct: 0.20,
    lanceProprio: 30000,
    rentYieldGrossMonthly: 0.0065,
    vacancyPct: 0.08
  })
];

console.log("==========================================================================================");
console.log("🏛️ CAPITAL ENGINE BATCH 001 — AUDITORIA DE NAV MÊS A MÊS (180 MESES)");
console.log("==========================================================================================");

console.log("\n--- BENCHMARKS DE RENDA FIXA (R$ 100k Base) ---");
console.log(`CDB 100% CDI : 3 Anos: R$ ${bCDB100[35].toFixed(0)} | 5 Anos: R$ ${bCDB100[59].toFixed(0)} | 10 Anos: R$ ${bCDB100[119].toFixed(0)} | 15 Anos: R$ ${bCDB100[179].toFixed(0)}`);
console.log(`CDB 115% CDI : 3 Anos: R$ ${bCDB115[35].toFixed(0)} | 5 Anos: R$ ${bCDB115[59].toFixed(0)} | 10 Anos: R$ ${bCDB115[119].toFixed(0)} | 15 Anos: R$ ${bCDB115[179].toFixed(0)}`);
console.log(`LCI 92% CDI  : 3 Anos: R$ ${bLCI92[35].toFixed(0)} | 5 Anos: R$ ${bLCI92[59].toFixed(0)} | 10 Anos: R$ ${bLCI92[119].toFixed(0)} | 15 Anos: R$ ${bLCI92[179].toFixed(0)}`);

console.log("\n--- ESTRATÉGIAS DE CONSÓRCIO + IMÓVEL (NAV Verdadeiro Líquido de Saída) ---");
for (const s of strategies) {
  console.log(`\n▶ [${s.name}]`);
  console.log(`   NAV 3 Anos  : R$ ${s.navAt3Y.toFixed(0)} (vs CDB 100%: R$ ${(s.navAt3Y - bCDB100[35]).toFixed(0)})`);
  console.log(`   NAV 5 Anos  : R$ ${s.navAt5Y.toFixed(0)} (vs CDB 100%: R$ ${(s.navAt5Y - bCDB100[59]).toFixed(0)})`);
  console.log(`   NAV 10 Anos : R$ ${s.navAt10Y.toFixed(0)} (vs CDB 100%: R$ ${(s.navAt10Y - bCDB100[119]).toFixed(0)})`);
  console.log(`   NAV 15 Anos : R$ ${s.navAt15Y.toFixed(0)} (vs CDB 100%: R$ ${(s.navAt15Y - bCDB100[179]).toFixed(0)})`);
  console.log(`   Mínimo Caixa Core : R$ ${s.minCashCore.toFixed(0)} | Default Event: ${s.defaultEvent ? "🔴 SIM (INSOLVÊNCIA)" : "🟢 NÃO"}`);
  console.log(`   Fluxo Total Enviado ao Lyzer: R$ ${s.totalCashFlowLyzer.toFixed(0)}`);
}
console.log("==========================================================================================");
