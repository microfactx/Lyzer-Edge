---
type: architecture_decision_record
title: ADR - Capital Stack, Anti-Fragile Flywheel & Opportunity Cost Engine (OCE)
created: 2026-09-09
status: approved
author: Jonatan Ciamarro & CTO Office
---

# LYZER LABS — CAPITAL STACK, FLYWHEEL & OPPORTUNITY COST ENGINE (OCE)

**Release:** 2.0.0-alpha  
**Autoria:** Jonatan Ciamarro (Fundador) & CTO Executive Office  
**Status:** Aprovado / Constitucional  
**Contexto Macroeconômico:** Brasil (Selic ~14.0% a.a. / CDI ~13.9% a.a.)  

---

## 1. Princípio Fundamental de Alocação Soberana

O Lyzer Edge não opera para "fazer algo com o dinheiro". O Lyzer Edge opera sob o axioma:
> *"O objetivo do sistema não é gerar trades, mas produzir retorno líquido ajustado ao risco estritamente superior ao custo de oportunidade passivo da economia brasileira (CDI/Tesouro), após impostos, slippage, fricções de execução e risco de contraparte."*

O Lyzer Edge abandona qualquer presunção ingênua de "Delta-Neutro = Risco-Zero". Toda estratégia quantitativa de carry/basis ou microestrutura carrega riscos explícitos:
1. Basis Risk (descolamento do preço spot vs. derivativo).
2. Funding Inversion Risk (funding rate negativo persistente).
3. Liquidity & Depletion Risk (falta de profundidade no livro L2/L3).
4. Exchange & Counterparty Risk (bloqueio, insolvência ou hack da corretora).
5. Liquidation / Margin Dislocation Risk.
6. Execution & Slippage Friction.
7. FX Risk (USD/BRL para estratégias offshore).

---

## 2. A Arquitetura das 3 Caixas (Capital Stack)

O patrimônio total $P_t$ é particionado em três caixas com mandatos funcionais estanques:

```
                          CAPITAL PATRIMONIAL TOTAL (P)
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
       CAPITAL CORE (90%–100%)                                CAPITAL ALPHA (0%–10%)
             │                                                     │
   ┌─────────┴─────────┐                                           │
   ▼                   ▼                                           ▼
🟢 CAIXA 1: COFRE    🔵 CAIXA 2: YIELD ENGINE              🔴 CAIXA 3: LYZER ALPHA
(40% do Core)        (60% do Core)                         (Financiado pelo Yield)
• Tesouro Selic      • CDB 105%–120% CDI                   • Funding / Basis Carry
• CDB Liq. Diária    • LCI / LCA 90%–95% CDI (isento)      • Microestrutura / OFI
• Proteção Soberana  • Vencimentos 1 a 2 anos              • StatArb (Cointegração)
• Liquidez Imediata  • Maximização do Yield                • Risk Budget Estrito
• Zero Risco Lyzer   • Limite FGC (R$ 250k/banco)          • Zero Risco ao Principal
```

### Mandatos Operacionais:
1. **Caixa 1: Cofre (40% do Core):**
   - Instrumentos: Tesouro Selic e CDB de liquidez diária $\ge 100\%$ CDI de bancos de primeira linha.
   - Função: Reserva incondicional, liquidez D+0/D+1, proteção do principal. Proibida marcação a mercado desfavorável (exclusão de Prefixados longos).
2. **Caixa 2: Yield Engine (60% do Core):**
   - Instrumentos: CDBs de 105% a 120% CDI (distribuídos respeitando o limite do FGC de R$ 250 mil por conglomerado) e LCIs/LCAs isentas de IR.
   - Função: Maximizar o rendimento líquido sem sacrificar a previsibilidade. Prazos escalonados (6, 12, 24 meses) para permitir reciclagem contínua de liquidez.
3. **Caixa 3: Lyzer Alpha (0% a 100% do Risk Budget):**
   - Financiado exclusivamente pelo fluxo de rendimento líquido gerado pelas Caixas 1 e 2.
   - O principal das Caixas 1 e 2 é inviolável.

---

## 3. A Dinâmica do Flywheel Anti-Frágil

Seja $Y_{\text{net}}$ o rendimento líquido total anual gerado pelas Caixas 1 e 2:

$$Y_{\text{net}} = P_{\text{cofre}} \cdot R_{\text{cofre\_net}} + P_{\text{yield}} \cdot R_{\text{yield\_net}}$$

### A Regra Constitucional da Partilha do Fluxo:
- **70% do Fluxo ($0.70 \cdot Y_{\text{net}}$):** Reinvestimento obrigatório no Core (Cofre + Yield Engine). Garante crescimento perpétuo do principal acima da inflação.
- **30% do Fluxo ($0.30 \cdot Y_{\text{net}}$):** Concedido como **Risk Budget Anual ($\text{RB}_t$)** para o Lyzer Alpha.

### Teorema da Imunidade à Ruína:
Mesmo que a mesa do Lyzer Alpha sofra um colapso estatístico completo e perca **100% do seu Risk Budget**:

$$\Delta P_{\text{total}} = Y_{\text{net}} - \text{RB}_t = Y_{\text{net}} - 0.30 \cdot Y_{\text{net}} = +0.70 \cdot Y_{\text{net}} > 0$$

O patrimônio total **sempre fecha o ciclo em território positivo**. A probabilidade de ruína matemática do capital base é idêntica a zero: $P(\text{ruína}) = 0.0000$.

### Mecânica de Realimentação (Alpha Positivo):
Se o Lyzer Alpha gerar retorno líquido positivo $\alpha_t$:
- $50\% \cdot \alpha_t$ é vertido imediatamente para o Core (expandindo o patrimônio seguro).
- $50\% \cdot \alpha_t$ expande o Risk Budget do ciclo seguinte ($\text{RB}_{t+1}$).
O flywheel acelera o crescimento sem jamais aumentar o risco relativo sobre o principal.

---

## 4. Arquitetura de Software: O `OpportunityCostEngine` (OCE)

O `OpportunityCostEngine` atua como **Portão Zero (Layer 0)** antes do `TruthKernel` e da `ConstitutionalCourt`.

### Interface do OCE (TypeScript/JavaScript Contract):

```javascript
export class OpportunityCostEngine {
  constructor(config = {}) {
    this.cdiAnnualRate = config.cdiAnnualRate || 0.1390; // 13.90% a.a.
    this.effectiveTaxRate = config.effectiveTaxRate || 0.15; // 15% IR
    this.hurdleRiskSpread = config.hurdleRiskSpread || 0.03; // Spread mínimo de 3% a.a.
  }

  // Calcula o retorno líquido diário de referência do benchmark seguro
  getSafeYieldDaily() {
    const netAnnualRate = this.cdiAnnualRate * (1 - this.effectiveTaxRate);
    return Math.pow(1 + netAnnualRate, 1 / 252) - 1;
  }

  // Avalia se uma ordem proposta justifica a alocação de capital
  evaluateProposal(proposal) {
    const {
      expectedGrossYield,    // Retorno anualizado bruto projetado (ex: funding + basis)
      estimatedFrictions,    // Slippage + taxas maker/taker amortizadas
      counterpartyRiskScore, // Penalidade por risco de exchange (0.0 a 1.0)
      fxRiskDrag,            // Custo de hedge ou volatilidade cambial USD/BRL
      expectedHoldingDays    // Horizonte planejado do trade
    } = proposal;

    const netExpectedAnnual = expectedGrossYield - estimatedFrictions - fxRiskDrag - (counterpartyRiskScore * 0.02);
    const benchmarkAnnualHurdle = (this.cdiAnnualRate * (1 - this.effectiveTaxRate)) + this.hurdleRiskSpread;

    const excessReturn = netExpectedAnnual - benchmarkAnnualHurdle;

    if (excessReturn <= 0) {
      return {
        approved: false,
        reason: "VETO_OPPORTUNITY_COST",
        netExpectedAnnual,
        benchmarkAnnualHurdle,
        excessReturn
      };
    }

    return {
      approved: true,
      reason: "EXCESS_RETURN_CONFIRMED",
      netExpectedAnnual,
      benchmarkAnnualHurdle,
      excessReturn
    };
  }
}
```

---

## 5. Matriz de Decisão do Sistema

| Estado do Mercado | Retorno Projetado Lyzer (Líq) | Benchmark Brasil (Líq) | Decisão do OCE | Ação do Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **Funding Neutro/Baixo** | 6.50% a.a. | 11.80% a.a. | 🔴 **VETO_OPPORTUNITY_COST** | Zero ordens. 100% do capital permanece no Core rendendo CDI. |
| **Dislocação Leve** | 12.00% a.a. | 11.80% a.a. | 🔴 **VETO_OPPORTUNITY_COST** | Excesso de retorno (+0.2%) não cobre prêmio de risco tecnológico. Veto. |
| **Euphoria Funding Spread**| 24.00% a.a. | 11.80% a.a. | 🟢 **PASS_TO_TRUTHKERNEL** | Excesso líquido de +12.2% a.a. Aloca fração do Risk Budget. |
| **Pânico / Microestrutura L3**| Evento Convexo Assumétrico | 11.80% a.a. | 🟢 **PASS_TO_TRUTHKERNEL** | Assimetria comprovada com perda máxima limitada ao budget. |

---

## 6. Governança e Auditoria

1. Toda proposta de trade rejeitada pelo OCE deve ser registrada no `OpportunityCostLedger` para auditoria de oportunidade poupada.
2. A taxa de Selic/CDI é um parâmetro auditável via oráculo ou configuração central de governança.
3. Nenhuma alteração no motor de produção pode bypassar o OCE sem sanção formal da Corte Constitucional.
