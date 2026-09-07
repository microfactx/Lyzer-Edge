# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H013
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout (Cash-and-Carry Delta-Neutral)

**Identificador da Hipótese:** `H013`  
**Origem Epistemológica:** Descoberta em `AD006` (Célula Líder `AD006_STATIC_BTC_ETH`)  
**Família Conceitual:** Arbitragem Estrutural Cash-and-Carry & Extração de Funding Rate Delta-Neutral ($\Delta = 0$)  
**Status Atual:** **PRE-REGISTERED / FROZEN / AWAITING EXECUTIVE UNLOCK**  
**População de Descoberta:** `2023-01-01` a `2024-12-31` (**SELADA & CONCLUÍDA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-08-31T23:59:59.999Z`)  
**Cesta de Ativos Confirmatória:** `BTCUSDT` (50%) + `ETHUSDT` (50%)  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-06T19:20:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

A hipótese `H013` formaliza a estratégia de **Basis Cash-and-Carry Delta-Neutral** em criptoativos institucionais de alta liquidez:

1. **Anulação Total do Risco Direcional ($\Delta = 0$):**
   Ao manter simultaneamente uma posição comprada no mercado Spot ($+1,0\text{x}$) e uma posição vendida idêntica em contrato perpétuo ($-1,0\text{x}$), a exposição direcional líquida ao preço é zero:
   $$\Delta_{\text{net}} = \Delta_{\text{spot}} + \Delta_{\text{perp}} = +1 - 1 = 0$$
   A carteira é matematicamente imune a altas explosivas ou quedas severas de mercado.

2. **Monetização Estrutural do Prêmio de Risco da Alavancagem:**
   Nos mercados perpétuos, a grande massa de participantes opera comprada com alavancagem especulativa. O mecanismo de equilíbrio da Binance impõe o pagamento periódico de *Funding Rates* dos compradores para os vendedores. Como vendedor do perpétuo, a estratégia colhe esse fluxo de rendimento a cada 8 horas sem incorrer em risco de cauda de preço.

3. **Amortização Temporal Máxima da Fricção de Execução:**
   Ao contrário de estratégias direcionais intradiárias que sofrem com custos recursivos de turnover a cada trade, a estrutura de carry estática incorre em custos de execução ($24\text{ bps}$ all-in) apenas no início e no encerramento da posição. Ao longo de 20 meses de carregamento (~1.824 períodos de 8h), o atrito é diluído para menos de $0,04\text{ bps/dia}$, garantindo que mais de $99\%$ do yield gerado seja convertido em lucro líquido.

---

## 🔒 2. Especificação Paramétrica Congelada ($M = 1$)

A hipótese `H013` é submetida como **hipótese unitária estritamente não-adaptativa** ($M = 1$, penalidade de multiplicidade $c(1) = 1,0$). Não é permitida qualquer otimização de pesos, troca de ativos ou ajuste de limiares.

### Parâmetros Estritamente Congelados:
- **Universo de Ativos**: `BTCUSDT` e `ETHUSDT` (mercado futuro USD-M perpétuo e Spot correspondente).
- **Alocação de Capital**: $50\%$ em `BTCUSDT` e $50\%$ em `ETHUSDT` (fixo durante todo o período).
- **Estrutura de Posição**:
  - Porção BTC: $+50\%$ Spot BTC / $-50\%$ Perp BTC.
  - Porção ETH: $+50\%$ Spot ETH / $-50\%$ Perp ETH.
  - $\Delta_{\text{total}} = 0,0000$.
- **Frequência de Fluxo**: Amostragem e acúmulo contínuo a cada 8 horas (horários padrão Binance: 00:00, 08:00, 16:00 UTC).
- **Controle de Fricção**:
  - Custo de entrada/saída: $12\text{ bps}$ por perna Spot $+ 12\text{ bps}$ por perna Perp = **$24\text{ bps}$ roundtrip completo**.
  - O turnover cost total é subtraído estritamente do patrimônio líquido.
- **Janela Confirmatória Efetiva**:
  - Início: `2025-01-01T00:00:00.000Z` (`1735689600000`)
  - Fim: `2026-08-31T23:59:59.999Z` (`1788220799999`)
  - Extensão: 608 dias / 1.824 períodos de 8h (~1,67 anos).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para que `H013` seja homologada como **Alpha Institucional Produzível**, ela deverá cumprir simultaneamente todos os 5 gates a seguir na População Virgem de Holdout:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Retorno Anualizado Líquido           │ AnnReturn_net >= +6.0% │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Índice de Sharpe Anualizado          │ Sharpe >= 5.00         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Limite Máximo de Drawdown            │ MaxDD <= 2.00%         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Robustez Bissetorial Cross-Leg       │ BTC e ETH > 0.0%       │ REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

### Protocolo de Inferência Estatística:
- **14-Day Calendar Block Bootstrap**: $B = 10.000$ réplicas com reposição, com blocos temporais estritos de 14 dias (42 períodos de 8h).
- **Centragem sob Hipótese Nula ($H_0$)**: Metodologia Hall (1992): $Y_i = X_i - \bar{X}_{\text{obs}}$.
- **Ajuste de Multiplicidade**: Como $M = 1$, $q_{\text{BY}} = p_{\text{block}}$.

---

## 🔒 4. Salvaguarda Criptográfica & Protocolo de Desbloqueio

1. **Firewall de Holdout**: A integridade do dataset de Holdout 2025–2026 é inviolável. O script de execução confirmatória só é executado após a geração do hash do charter, frozen spec e do runner.
2. **Lacre de Pré-Registro**: Registrado em `H013_PREREGISTRATION_LOCK.json`.
3. **Execução Irreversível**: A validação em Holdout é executada exatamente uma única vez (*one-shot*). O veredito é lavrado no Master Hypothesis Ledger.
