# 🏛️ LYZER LABS — CARTA CONSTITUCIONAL CONFIRMATÓRIA: HIPÓTESE H019
## Protocolo Pré-Registrado & Congelamento Criptográfico para Validação em Holdout (Diversified Multi-Currency Carry Basket)

**Identificador da Hipótese:** `H019`  
**Origem Epistemológica:** Descoberta em `AD015` (Célula Campeã `AD015_EW_UNIFIED_EMA200_VOL135`)  
**Família Conceitual:** Renda Passiva Algorítmica Macro / Forex Multi-Currency Carry com Disjuntor Dinâmico de Regime e Refúgio em T-Bills Soberanas  
**Status Atual:** **PRE-REGISTERED / FROZEN / READY FOR EXECUTION**  
**População de Descoberta:** `2023-01-01T00:00:00.000Z` a `2024-12-31T23:59:59.999Z` (**SELADA & HOMOLOGADA**)  
**População Confirmatória Autorizada:** **Holdout Temporal Virgem** (`2025-01-01T00:00:00.000Z` a `2026-09-07T23:59:59.999Z`)  
**Universo de Pares Autorizado ($M = 1$ Cesta Consolidada):** `USDJPY`, `GBPJPY`, `AUDJPY`, `CADJPY`  
**Invariante de Produção (Motor V8):** SHA-256 `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1` (**INTOCÁVEL**)  
**Data UTC de Formalização:** `2026-09-08T22:20:00.000Z`  

---

## 🔬 1. O Mecanismo Causal & Racional Econômico

A hipótese `H019` formaliza a transição do motor de carry cambial macro da fase exploratória de descoberta (`AD015`) para o teste confirmatório definitivo em holdout virgem:

1. **Exploração do Diferencial Macro de Juros (Interest Rate Differential Carry):**
   A política monetária ultra-expansionista do Banco do Japão (BoJ) mantém as taxas referenciais do Iene próximas a $0,10\%-0,25\%$, enquanto os bancos centrais do G10 (Fed $5,33\%$, BoE $5,00\%$, BoC $4,75\%$, RBA $4,35\%$) sustentam spreads cambiais positivos estruturais ($+4,25\%\text{ a }+5,20\%\text{ a.a.}$).
2. **Diversificação em Cesta Multi-Moeda (Basket Risk Dilution):**
   Em vez de concentrar o risco cambial em um único par (como `USDJPY` em AD014), a cesta divide a exposição em 4 economias líquidas distintas (EUA, Reino Unido, Austrália e Canadá). Esta diversificação reduziu o Max Drawdown de $4,74\%$ para $2,96\%$ no discovery, diluindo choques idiossincráticos de bancos centrais individuais.
3. **Disjuntor Unificado de Regime (Unified Basket Circuit Breaker):**
   A falha histórica das estratégias de carry cambial clássicas reside no "Yen Unwind" (desmonte violento e correlacionado de posições vendidas em JPY). O disjuntor monitora o índice sintético normalizado da cesta:
   - Se o índice romper abaixo da média móvel exponencial de 200 horas ($\text{Index} < \text{EMA}_{200}$), OU
   - Se a volatilidade relativa da cesta exceder o multiplicador crítico ($ATR_{14} / \text{SMA}(ATR, 50) > 1,35$),
   a cesta inteira é imediatamente liquidada para caixa.
4. **Refúgio Ativo em US Treasury Bills (5.00% p.a.):**
   Durante os períodos defensivos em que a cesta é desmontada, $100\%$ do capital é investido automaticamente na taxa soberana americana de curto prazo ($5,00\%\text{ a.a.}$), garantindo acúmulo ininterrupto de rendimento e eliminando custo de oportunidade.
5. **Histerese de Permanência Anti-Whipsaw (24h Dwell Time):**
   Para evitar que ruídos intradiários causem giros frequentes e corrosão por spreads de execução, a transição entre o estado ativo e o estado defensivo possui uma trava temporal mínima de 24 horas consecutivas.

---

## 🔒 2. Especificação Paramétrica Estritamente Congelada

A hipótese `H019` é submetida como teste confirmatório unitário consolidado ($M = 1$):

- **Pares da Cesta**: `USDJPY`, `GBPJPY`, `AUDJPY`, `CADJPY`.
- **Ponderação da Carteira**: `EQUAL_WEIGHT` ($25\%$ de exposição teórica em cada par quando ativa).
- **Taxas Contratuais de Carry Anualizadas**:
  - `USDJPY`: $+5,20\%\text{ a.a.}$ ($5,936 \times 10^{-7}\text{ por hora}$)
  - `GBPJPY`: $+4,90\%\text{ a.a.}$ ($5,594 \times 10^{-7}\text{ por hora}$)
  - `AUDJPY`: $+4,25\%\text{ a.a.}$ ($4,852 \times 10^{-7}\text{ por hora}$)
  - `CADJPY`: $+4,65\%\text{ a.a.}$ ($5,308 \times 10^{-7}\text{ por hora}$)
- **Taxa de Refúgio Defensivo (US T-Bills)**: $+5,00\%\text{ a.a.}$ contínua quando o disjuntor estiver desarmado.
- **Parâmetros do Disjuntor Unificado**:
  - Lookback da $\text{EMA}$: $200$ velas horárias calculadas sobre o índice sintético da cesta.
  - Período do $\text{ATR}$: $14$ velas horárias (Wilder).
  - Lookback do Baseline de $\text{ATR}$: $50$ períodos de média móvel.
  - Limiar de Relação de Volatilidade: $1,35 \times \text{Baseline}$.
- **Histerese Temporal de Permanência**: $24$ horas (dwell time obrigatório).
- **Fricção de Transição / Turnover**: $3,0\text{ bps}$ por perna em cada transição de regime.
- **Janela Confirmatória Virgem**: `2025-01-01T00:00:00.000Z` até `2026-09-07T23:59:59.999Z` (dados selados em `research/alpha_discovery/AD015/holdout_sealed/`).

---

## 🏛️ 3. Gates Constitucionais de Homologação Confirmatória

Para homologação definitiva como **Alfa de Produção TradFi / Renda Passiva Algorítmica**, `H019` deve cumprir simultaneamente todos os 5 gates constitucionais no Holdout 2025–2026:

```text
┌──────────────────────────────────────────────┬────────────────────────┬──────────────────────┐
│ Gate Constitucional                          │ Métrica Exigida        │ Ação se Falhar       │
├──────────────────────────────────────────────┼────────────────────────┼──────────────────────┤
│ Gate 1: Rendimento Anualizado Líquido        │ AnnYield >= +6.00% a.a.│ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 2: Retorno Total Líquido                │ TotalNetReturn > 0.00% │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 3: Índice de Sharpe Anualizado          │ AnnSharpe >= 1.20      │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 4: Preservação de Capital (Max Drawdown)│ MaxDD <= 4.00%         │ REJEIÇÃO CONFIRMATÓRIA│
│ Gate 5: Significância Estatística Primária   │ p_block < 0.0500       │ REJEIÇÃO CONFIRMATÓRIA│
└──────────────────────────────────────────────┴────────────────────────┴──────────────────────┘
```

*Nota Constitucional:* O teste estatístico primário (Gate 5) utilizará o algoritmo padronizado `runCalendarBlockBootstrap` com $B = 10.000$ iterações sob blocos de $14$ dias civis, centrado à média amostral (Hall-Wilson).

---

## 🔒 4. Salvaguarda Criptográfica & Protocolo de Desbloqueio

1. **Firewall de Holdout**: O acesso aos dados de 2025–2026 ocorrerá exclusivamente através do executor oficial pré-registrado.
2. **Execução Única Irreversível (One-Shot Rule)**: Nenhuma alteração de código, parâmetros ou dados será permitida após o desbloqueio.
3. **Auditabilidade Plena**: Caso qualquer gate falhe, a hipótese será arquivada como `CONFIRMATORY_FAIL` no `HYPOTHESIS_LEDGER.md` com a mesma transparência e rigor dos sucessos.
