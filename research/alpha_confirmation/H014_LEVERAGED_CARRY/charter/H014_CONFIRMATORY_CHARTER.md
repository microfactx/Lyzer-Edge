# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H014
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout (Leveraged Basis Carry 2.0x)

**Identificador da Hipótese:** `H014`  
**Origem Epistemológica:** Descoberta em `AD007` (Célula Líder `AD007_STATIC_BTC_ETH_2X`)  
**Família Conceitual:** Arbitragem de Taxa de Juros Perpétua & Basis Carry Alavancado Conservador ($\Delta = 0$)  
**Status Atual:** **PRE-REGISTERED / FROZEN / AWAITING EXECUTIVE UNLOCK**  
**População de Descoberta:** `2023-01-01` a `2024-12-31` (**SELADA & HOMOLOGADA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-08-31T23:59:59.999Z`)  
**Cesta de Ativos Confirmatória:** `BTCUSDT` (50%) + `ETHUSDT` (50%) com alavancagem $L = 2,0\text{x}$  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-06T22:45:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

A hipótese `H014` expande a arbitragem delta-neutra comprovada em `H013`/`AD006`, incorporando eficiência de capital institucional:

1. **Neutralidade Delta Rigorosa ($\Delta = 0$):**
   Ao manter posições casadas Spot ($+2,0\text{x}$) e Perpétuo ($-2,0\text{x}$) em proporções idênticas ($50\%$ BTC / $50\%$ ETH), a exposição direcional ao mercado permanece nula:
   $$\Delta_{\text{net}} = \Delta_{\text{spot}} + \Delta_{\text{perp}} = +2,0 - 2,0 = 0$$

2. **Multiplicação de Fluxo de Financiamento:**
   Ao dobrar o nocional alocado ($L = 2,0\text{x}$), a estratégia dobra a captação bruta de fluxos de *funding rate* pagos pelo mercado futuro.

3. **Custo Explícito de Financiamento de Margem (USD Borrow Rate):**
   A fração alavancada $(L - 1,0 = 1,0\text{x})$ incorre em custo de financiamento institucional contínuo modelado a $4,0\%\text{ a.a.}$, deduzido pro-rata temporis a cada período de 8 horas:
   $$\text{Yield}_{\text{net}}(t) = L \times \text{FundingRate}(t) - (L - 1,0) \times \frac{r_{\text{borrow}}}{365 \times 3}$$

4. **Amortização Temporal de Fricção:**
   A fricção de execução é escalada pela alavancagem ($24\text{ bps} \times 2,0 = 48\text{ bps}$ roundtrip completo), sendo absorvida integralmente ao longo dos 608 dias de holding (~$0,08\text{ bps/dia}$).

---

## 🔒 2. Especificação Paramétrica Congelada ($M = 1$)

A hipótese `H014` é submetida sob governança estrita de teste confirmatório unitário ($M = 1$, $c(1) = 1,0$):

- **Universo**: `BTCUSDT` ($50\%$) e `ETHUSDT` ($50\%$).
- **Alavancagem ($L$)**: $2,0\text{x}$.
- **Custo de Empréstimo ($r_{\text{borrow}}$)**: $4,0\%\text{ a.a.}$ contínuo sobre $(L - 1,0)$.
- **Fricção de Entrada/Saída**: $24\text{ bps} \times L = 48\text{ bps}$ roundtrip completo.
- **Frequência de Fluxo**: 8 horas (00:00, 08:00, 16:00 UTC).
- **Janela Confirmatória Efetiva**:
  - Início: `2025-01-01T00:00:00.000Z` (`1735689600000`)
  - Fim: `2026-08-31T23:59:59.999Z` (`1788220799999`)
  - Total de Períodos: 1.824 períodos de 8 horas (608 dias civis).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para homologação como **Alpha Institucional Produzível para Capital Real**, `H014` deve aprovar simultaneamente todos os 5 gates constitucionais:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Retorno Anualizado Líquido           │ AnnReturn_net >= +10.0%│ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Índice de Sharpe Anualizado          │ Sharpe >= 5.00         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Limite Máximo de Drawdown            │ MaxDD <= 3.00%         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Robustez Bissetorial Cross-Leg       │ BTC e ETH > 0.0%       │ REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

### Protocolo de Inferência Estatística:
- **14-Day Calendar Block Bootstrap**: $B = 10.000$ réplicas com reposição, blocos de 14 dias civis (42 períodos de 8h).
- **Centragem sob Hipótese Nula ($H_0$)**: Hall (1992): $Y_i = X_i - \bar{X}_{\text{obs}}$.
- **Ajuste de Multiplicidade**: Como $M = 1$, $q_{\text{BY}} = p_{\text{block}}$.

---

## 🔒 4. Salvaguarda Criptográfica & Lacre de Pré-Registro

1. **Lacre de Pré-Registro**: Registrado em `H014_PREREGISTRATION_LOCK.json`.
2. **Execução Irreversível**: Validação em Holdout executada exatamente uma única vez (*one-shot*).
3. **Imutabilidade**: Qualquer alteração após visualização dos dados acarreta cancelamento automático por auditoria forense.
