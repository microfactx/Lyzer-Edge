# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H017
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout (Productive Collateral Basis Carry 2.0x)

**Identificador da Hipótese:** `H017`  
**Origem Epistemológica:** Descoberta em `AD010` (Célula Líder `AD010_PRODUCTIVE_TOP2_2X_M30`)  
**Família Conceitual:** Arbitragem de Taxa Perpétua com Colateral Produtivo e Rendimento de Staking Líquido ($\Delta = 0$)  
**Status Atual:** **PRE-REGISTERED / FROZEN / AWAITING EXECUTIVE UNLOCK**  
**População de Descoberta:** `2023-01-01` a `2024-12-31` (**SELADA & HOMOLOGADA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-08-31T23:59:59.999Z`)  
**Universo de Ativos Autorizado:** `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `AVAXUSDT`, `LINKUSDT`, `DOGEUSDT` (6 ativos core)  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-06T23:58:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

A hipótese `H017` resolve a falha estrutural de rendimento identificada nas hipóteses `H013`, `H014`, `H015` e `H016`:

1. **Ativação do Colateral Produtivo (Proof-of-Stake Liquid Staking Yield):**
   Nas implementações anteriores, a perna comprada em spot era mantida inerte ($Y_{\text{spot}} = 0\%$). Na macroestrutura de 2025–2026, com o financiamento perpétuo comprimindo para o intervalo de $3,5\% - 4,5\%$, o custo de margem de USD ($4,0\%\text{ a.a.}$) anulava grande parte do spread. Ao alocar o colateral spot em ativos com staking líquido institucional (ex.: stETH $3,5\%$, JitoSOL/mSOL $6,0\%$, sAVAX $5,0\%$), cria-se um **piso estrutural de rendimento livre de risco de preço** ($\Delta = 0$).
2. **Neutralidade Delta Rigorosa ($\Delta = 0$):**
   Cada posição de ativo comprada a spot é estritamente coberta por uma posição vendida de valor financeiro idêntico no contrato perpétuo correspondente. As variações direcionais do ativo são neutralizadas a $100\%$, restando apenas o carrego do prêmio de financiamento somado ao rendimento nativo do staking.
3. **Rendimento de Caixa Institucional (USD T-Bill / SOFR Benchmark):**
   O colateral de margem em dólares ou caixa não alocado é remunerado à taxa de $4,0\%\text{ a.a.}$, eliminando perdas de oportunidade quando a carteira desalavanca ou mantém reservas em moeda fiduciária.
4. **Buffer de Inércia Anti-Whipsaw ($\Delta_{\text{buffer}} = 2,0\%\text{ a.a.}$):**
   A rotação entre ativos ocorre no intervalo mensal discreto (30 dias) e somente se um desafiante superar o incumbente por uma margem líquida superior a $200\text{ bps}$, blindando a carteira contra churn e comissões excessivas.
5. **Alavancagem Disciplinada a 2.0x:**
   A alavancagem de 2.0x multiplica o spread líquido obtido entre (Funding + Staking) e o custo de captação de USD ($4,0\%\text{ a.a.}$ sobre a perna de margem de 1.0x).

---

## 🔒 2. Especificação Paramétrica Congelada ($M = 1$)

A hipótese `H017` é submetida sob governança estrita de teste confirmatório unitário ($M = 1$, $c(1) = 1,0$):

- **Universo Elegível**: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `AVAXUSDT`, `LINKUSDT`, `DOGEUSDT`.
- **Top K Alocados**: $K = 2$ ativos ($50\%$ cada).
- **Janela de Média Móvel (Lookback)**: $30$ dias ($90$ períodos de 8h).
- **Intervalo de Rebalanceamento**: Discreto mensal a cada $30$ dias ($90$ períodos de 8h).
- **Buffer de Inércia de Rotação**: $\Delta_{\text{buffer}} = 2,0\%\text{ a.a.}$
- **Hurdle Mínimo de Entrada**: $3,0\%\text{ a.a.}$ de rendimento bruto total (Funding + Staking).
- **Alavancagem Efetiva**: $2,0\text{x}$.
- **Rendimento de Staking Spot (LST)**: ETH: $3,5\%\text{ a.a.}$, SOL: $6,0\%\text{ a.a.}$, AVAX: $5,0\%\text{ a.a.}$, BTC: $0,0\%$, LINK: $0,0\%$, DOGE: $0,0\%$.
- **Rendimento de Caixa USD**: $4,0\%\text{ a.a.}$ contínuo sobre capital não alocado.
- **Custo de Financiamento de Margem**: $4,0\%\text{ a.a.}$ contínuo sobre $(L - 1,0)$ estritamente nos períodos ativos e alavancados ($L > 1,0$).
- **Fricção de Transição**: $24\text{ bps}$ por ciclo completo de entrada/saída escalado por alavancagem ($12\text{ bps}$ na entrada e $12\text{ bps}$ na saída por perna).
- **Janela Confirmatória Efetiva**:
  - Warmup Lookback Causal: `2024-12-01T00:00:00.000Z` a `2024-12-31T23:59:59.999Z` (93 períodos de 8h).
  - Avaliação Virgem: `2025-01-01T00:00:00.000Z` a `2026-08-31T23:59:59.999Z` (1.824 períodos de 8h = 608 dias civis).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para homologação como **Alpha Institucional Produzível**, `H017` deve cumprir simultaneamente todos os 5 gates a seguir:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Rendimento Anualizado Líquido        │ AnnYield >= +6.00% a.a.│ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Retorno Total Líquido                │ NetReturn > 0.00%      │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Índice de Sharpe Anualizado          │ AnnSharpe >= 5.00      │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Drawdown Máximo Residual             │ MaxDD <= 3.00%         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

Se qualquer um dos gates for violado, a hipótese será arquivada como `CONFIRMATORY_FAIL` em estrita consonância com *"O Tribunal Nunca Aprende"*, sendo expressamente proibida qualquer alteração de parâmetros.
