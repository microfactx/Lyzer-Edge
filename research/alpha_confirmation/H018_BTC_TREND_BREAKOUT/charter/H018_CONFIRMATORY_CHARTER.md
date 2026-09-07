# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H018
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout

**Identificador da Hipótese:** `H018`  
**Origem Epistemológica:** Descoberta em `AD012` (Célula Isolada `AD012_BTCUSDT_L50_RR30`)  
**Família Conceitual:** Time-Series Momentum & Expansão de Volatilidade Intradiária  
**Status Atual:** **PRE-REGISTERED / FROZEN / READY FOR EXECUTION**  
**População de Descoberta:** `2023-11-21T00:00:00.000Z` a `2024-12-31T23:59:59.999Z` (**SELADA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-09-07T00:00:00.000Z`)  
**Ativo Único Submetido ($M = 1$):** `BTCUSDT` (Contrato Futuro Perpétuo com Liquidação em USDT)  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-07T04:26:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

No programa de descoberta `AD011`, falsificou-se a tese de reversão à média em extremos de 4H: rompimentos de máximas e mínimas macro tendem a continuar e expandir. O programa `AD012` testou a continuação direcional (Donchian Breakout) e isolou uma borda econômica robusta em Bitcoin:
1. **Inércia Institucional e Time-Series Momentum**:
   O Bitcoin é um ativo impulsionado por fluxos macroeconômicos e desalavancagem unidirecional. Quando o preço rompe o canal de 50 barras de 4H (8,33 dias) acompanhado por expansão de volatilidade ($ATR_{14} \ge 1,15 \times \text{BaselineATR}_{50}$), há confirmação de participação institucional agressiva.
2. **Assimetria de Risco 1:3.0**:
   A relação assimétrica de $1:3.0$ permite que a estratégia seja altamente lucrativa mesmo com taxas de acerto moderadas ($40\%\text{ a }45\%$), vencendo o atrito de corretagem e slippage de 24 bps roundtrip.
3. **Isolamento de Hipótese Unitária ($M = 1$)**:
   Ao isolar o Bitcoin da contaminação de Forex (que colapsou em AD012 por regime de paridade central), a hipótese é testada sob multiplicidade unitária $c(1) = 1.0$, onde $q_{\text{BY}} = p_{\text{block}}$.

---

## 🔒 2. Especificação Paramétrica Estritamente Congelada

- **Ativo**: `BTCUSDT`
- **Timeframe Macro**: 4H (Agregação determinística de 4 velas horárias alinhadas ao calendário UTC).
- **Lookback de Canal Donchian ($L$)**: 50 barras de 4H calculadas estritamente sobre $[t-50, t-1]$.
  - $\text{UpperBand}_t = \max_{k=1}^{50} \text{High}_{4H, t-k}$
  - $\text{LowerBand}_t = \min_{k=1}^{50} \text{Low}_{4H, t-k}$
- **Filtro de Expansão de Volatilidade**:
  - $ATR_{1H}(14) \ge 1,15 \times \text{SMA}(ATR_{1H}, 50)$
- **Gatilho de Entrada**:
  - **LONG**: Vela de 1H fecha acima de $\text{UpperBand}$ e é altista ($\text{Close} > \text{Open}$).
  - **SHORT**: Vela de 1H fecha abaixo de $\text{LowerBand}$ e é baixista ($\text{Close} < \text{Open}$).
- **Stop Loss Inicial**:
  - Distância de Risco: $2,0 \times ATR_{1H}(14)$.
  - Long: $SL = P_{\text{entry}} - 2,0 \times ATR$.
  - Short: $SL = P_{\text{entry}} + 2,0 \times ATR$.
- **Take Profit**:
  - Asimétrico $R:R = 1:3,0$ ($TP = P_{\text{entry}} \pm 3,0 \times \text{Risk}$).
- **Horizonte Máximo de Manutenção ($H$)**: 48 horas (Time-Stop).
- **Controle de Fricção Rigoroso**:
  - Corretagem: $5\text{ bps}$ por perna.
  - Derrapagem (Slippage): $7\text{ bps}$ por perna.
  - Atrito Total Roundtrip: **$24\text{ bps}$**.
- **Gestão de Posição**: Posição única por vez (sem sobreposição de trades no mesmo ativo).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para que `H018` seja aprovada como **Alfa Direcional de Produção (Stage 3 Production Alpha)**, ela deverá atender simultaneamente a **TODOS OS 5 GATES** na população de Holdout 2025–2026:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Potência Amostral Mínima             │ N_confirmatory >= 60   │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Expectativa Econômica Líquida        │ E[R]_net >= +0.200R    │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Fator de Lucro Mínimo                │ Profit Factor >= 1.40  │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Retorno Total & Drawdown Máximo      │ TotalNetR > 0 & MaxDD<=12.0R REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

---

## 🔒 4. Salvaguarda Criptográfica & Protocolo de Desbloqueio

1. **Firewall de Holdout**: Os dados de 2025–2026 serão acessados exclusivamente pelo script runner confirmatório lacrado.
2. **Execução Única (One-Shot)**: A simulação não admite recalibração, ajuste de hiperparâmetros ou reteste após a observação dos dados.
3. **Irreversibilidade**: O resultado será imediatamente registrado no Master Hypothesis Ledger, mantendo a integridade epistêmica da Lyzer Labs.
