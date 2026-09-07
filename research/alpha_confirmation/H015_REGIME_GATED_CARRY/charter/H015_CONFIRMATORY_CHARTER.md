# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H015
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout (Adaptive Regime-Gated Basis Carry 2.0x)

**Identificador da Hipótese:** `H015`  
**Origem Epistemológica:** Descoberta em `AD008` (Célula Líder `AD008_GATED_BTC_ETH_2X_M6`)  
**Família Conceitual:** Arbitragem de Taxa de Juros Perpétua & Basis Carry com Filtro Adaptativo de Regime ($\Delta = 0$)  
**Status Atual:** **PRE-REGISTERED / FROZEN / AWAITING EXECUTIVE UNLOCK**  
**População de Descoberta:** `2023-01-01` a `2024-12-31` (**SELADA & HOMOLOGADA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-08-31T23:59:59.999Z`)  
**Cesta de Ativos Confirmatória:** `BTCUSDT` (50%) + `ETHUSDT` (50%) com alavancagem $L = 2,0\text{x}$ e gating adaptativo $[4,0\%, 6,0\%]$  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-06T23:00:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

A hipótese `H015` introduz um controle dinâmico de regime sobre a estrutura de Basis Carry alavancado ($2,0\text{x}$):

1. **Neutralidade Delta Rigorosa ($\Delta = 0$):**
   Durante os períodos em que a posição está ativa, mantém-se proporção estrita de compra no Spot e venda no Perpétuo, anulando $100\%$ do risco de oscilação direcional de preço.

2. **Ativação Condicionada por Demanda Especulativa:**
   A posição só é montada quando a média móvel de funding de 7 dias ($\bar{F}_{7\text{d}}$) atinge ou supera $6,0\%\text{ a.a.}$, garantindo que o capital só seja alavancado quando o rendimento bruto compensa os custos operacionais.

3. **Cessação Imediata de Custos de Empréstimo em Regimes Adversos:**
   Quando $\bar{F}_{7\text{d}}$ cai abaixo de $4,0\%\text{ a.a.}$, a estrutura é desmontada para caixa. O capital inativo **não paga juros de margem (zero borrowing cost)** e não sofre com taxas de funding negativas, protegendo a rentabilidade acumulada.

4. **Amortização de Fricção e Histerese:**
   A banda $[4,0\%, 6,0\%]$ evita entradas e saídas precipitadas (*whipsaw*). A fricção de execução ($24\text{ bps} \times 2 = 48\text{ bps}$ roundtrip) é deduzida a cada ciclo completo de transição.

---

## 🔒 2. Especificação Paramétrica Congelada ($M = 1$)

A hipótese `H015` é submetida sob governança estrita de teste confirmatório unitário ($M = 1$, $c(1) = 1,0$):

- **Universo**: `BTCUSDT` ($50\%$) e `ETHUSDT` ($50\%$).
- **Alavancagem ($L$)**: $2,0\text{x}$.
- **Filtro de Regime (Histerese)**:
  - Limiar de Entrada ($H_{\text{entry}}$): $\ge 6,0\%\text{ a.a.}$
  - Limiar de Saída ($H_{\text{exit}}$): $< 4,0\%\text{ a.a.}$
  - Janela de Média Móvel: $7$ dias ($21$ períodos de 8h).
- **Custo de Financiamento de Margem**: $4,0\%\text{ a.a.}$ contínuo sobre $(L - 1,0 = 1,0\text{x})$ estritamente nos períodos em que a posição está ativa.
- **Rendimento de Caixa Inativo**: $0,0\%\text{ a.a.}$ (baseline conservador sem juros).
- **Fricção de Transição**: $24\text{ bps} \times L = 48\text{ bps}$ por ciclo completo de entrada e saída.
- **Janela Confirmatória Efetiva**:
  - Início: `2025-01-01T00:00:00.000Z` (`1735689600000`)
  - Fim: `2026-08-31T23:59:59.999Z` (`1788220799999`)
  - Total de Períodos: 1.824 períodos de 8 horas (608 dias civis).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para homologação como **Alpha Institucional Produzível**, `H015` deve cumprir simultaneamente todos os 5 gates a seguir:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Retorno Anualizado Líquido           │ AnnReturn_net >= +6.0% │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Índice de Sharpe Anualizado          │ Sharpe >= 5.00         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Limite Máximo de Drawdown            │ MaxDD <= 3.00%         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Lucro Líquido Real Positivo          │ TotalNetReturn > 0.0%  │ REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

### Protocolo de Inferência Estatística:
- **14-Day Calendar Block Bootstrap**: $B = 10.000$ réplicas com reposição, blocos de 14 dias civis (42 períodos de 8h).
- **Centragem sob Hipótese Nula ($H_0$)**: Hall (1992): $Y_i = X_i - \bar{X}_{\text{obs}}$.
- **Ajuste de Multiplicidade**: Como $M = 1$, $q_{\text{BY}} = p_{\text{block}}$.

---

## 🔒 4. Salvaguarda Criptográfica & Lacre de Pré-Registro

1. **Lacre de Pré-Registro**: Registrado em `H015_PREREGISTRATION_LOCK.json`.
2. **Execução Irreversível**: Validação em Holdout executada exatamente uma única vez (*one-shot*).
3. **Imutabilidade**: Princípio inegociável *"O Tribunal Nunca Aprende"*.
