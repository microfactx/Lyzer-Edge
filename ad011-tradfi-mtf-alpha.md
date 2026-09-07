# 🏛️ AD011 — TradFi Cross-Asset Multi-Timeframe Liquidity Sweep & CISD Engine

**Programa de Pesquisa:** AD011  
**Trilha:** Laboratory Experimental (Trilha 2 - Descoberta Científica Isolada)  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Data de Abertura:** 2026-09-07  
**Status:** 🟡 EM FASE DE PLANEJAMENTO (PLANNING ONLY - ZERO CODE)

---

## 1. Context Check & Epistemic Rationale (Phase -1)

### 1.1 O Problema dos Alfas Anteriores
* **AD001–AD003 & H009**: Alfas direcionais em cripto de timeframes curtos (15m, 30m, 1h) foram severamente degradados pelo **Piso de Fricção (Friction Floor de ~24 bps)** e por ruído de microestrutura não regulada.
* **H012 (Funding Squeeze)**: O squeeze funcionou no Discovery (+0.265R), mas sofreu sangramento no Holdout 2025–2026 devido à correlação direcional negativa de altcoins em mercado de baixa.
* **H017 (Sucesso Delta-Neutro)**: Homologado com +6.42% a.a. e Sharpe 14.89, mas restrito ao carry passivo com staking.

### 1.2 A Oportunidade TradFi (S&P 500, Nasdaq, Forex & Ouro)
* **Profundidade Institucional**: Spreads na ordem de 0.5 a 2 bps em S&P500 (`SPY`), Nasdaq (`QQQ`) e Forex (`EURUSD`), eliminando o atrito como principal causa de morte das estratégias.
* **Sincronização Multi-Timeframe (MTF)**:
  - **Macro (4H / Daily)**: Identificação de zonas de liquidez externa (Swing Highs / Lows de 48h) e regime de mercado.
  - **Micro (1H)**: Gatilho mecânico de Rejeição e Deslocamento Causal (*Change in State of Delivery - CISD*), com expansão de volume ($Z_{\text{vol}} > 1.0$) e fechamento direcional.
* **Universalidade Cruzada (Cross-Asset)**: Se o mecanismo for matematicamente causal, ele deve se replicar em índices de ações, moedas G10 e commodities, usando o BTC como controle de classe de ativo cruzada.

---

## 2. Hipótese Científica Formal & Mecanismo Causal (Phase 0)

### 2.1 Enunciado da Hipótese Nula ($H_0$)
> *"A varredura de liquidez de 4H (rompimento com rejeição de swing high/low) seguida de deslocamento de 1H (CISD) não possui poder preditivo superior a um passeio aleatório ($E[R] \le 0.00R$) após custos reais de execução em ativos TradFi e Forex."*

### 2.2 Hipótese Alternativa ($H_1$)
> *"Varreduras de extremos de liquidez de 4H absorvidas por formadores de mercado induzem desbalanceamento de inventário que resulta em expansão direcional média em 1H com expectativa matemática líquida $E[R] \ge +0.20R$, Profit Factor $\ge 1.40$ e significância sob Benjamini-Yekutieli ($q_{\text{BY}} < 0.0500$)."*

---

## 3. Universo Amostral & Especificação de Dados

### 3.1 Painel Multiativo TradFi + Controle Cripto
1. **Índices de Ações EUA**:
   - `SPY` (SPDR S&P 500 ETF)
   - `QQQ` (Invesco QQQ / Nasdaq 100)
2. **Forex G10**:
   - `EURUSD=X` (Euro / Dólar Americano)
   - `GBPUSD=X` (Libra Esterlina / Dólar Americano)
3. **Macro Commodity**:
   - `GLD` (SPDR Gold Trust / Proxy de Ouro XAUUSD)
4. **Benchmark de Controle Cripto**:
   - `BTCUSDT` (32.016 barras já homologadas no repositório)

### 3.2 Janelas Temporais Estritas
* **Período de Descoberta (Discovery)**: 2022-01-01 a 2024-12-31 (3 anos de histórico, ~26.000 barras horárias).
* **Período de Holdout Virgem (Holdout 2025–2026)**: 2025-01-01 até a data corrente (lacrado, intocado até a formalização de uma Carta Confirmatória H018, se houver promoção).

---

## 4. Arquitetura da Estratégia MTF (Grade Experimental AD011)

### 4.1 Regras de Entrada
1. **Identificação de Liquidez Macro (4H)**:
   - Cálculo de Swing High ($SH_{4H}$) e Swing Low ($SL_{4H}$) com janela móvel de $L \in \{24, 48\}$ barras de 4H.
   - Detecção de **Sweep**: Barra de 4H perfura $SH_{4H}$ ou $SL_{4H}$, mas seu preço de fechamento retorna para dentro da faixa anterior (pavio de rejeição $\ge 40\%$ da amplitude da barra).
2. **Confirmação Micro (1H - CISD)**:
   - Dentro de até 3 barras após o sweep de 4H, surge uma barra de 1H na direção oposta ao sweep.
   - Corpo do candle $> 1.2 \times \text{ATR}_{1H}(14)$.
   - Volume ou Range Z-score $> 1.0$.
3. **Parâmetros de Execução & Saída**:
   - **Stop Loss**: No ponto extremo do pavio do sweep de 4H $+ \text{spread buffer}$.
   - **Take Profit**: Relação assimétrica de Risco:Retorno ($R:R \in \{1:2.5, 1:3.5\}$).
   - **Time-Stop (Horizonte Máximo $H$)**: Fechamento forçado após 24h ou 48h para evitar posições estagnadas e exposição de fim de semana.
   - **Filtro de Fim de Semana**: Zero novas entradas às sextas-feiras após as 14:00 EST em Forex e Índices.

### 4.2 Matriz de Variações da Grade (Grid Combinatória)
* 6 Ativos (`SPY`, `QQQ`, `EURUSD`, `GBPUSD`, `GLD`, `BTCUSDT`)
* 2 Lookbacks de Swing Macro ($L = 24$, $L = 48$)
* 2 Relações R:R ($1:2.5$, $1:3.5$)
* Total de Células: $6 \times 2 \times 2 = 24$ variações de hipótese.
* Penalidade de Múltiplos Testes: Benjamini-Yekutieli ($m = 24$).

---

## 5. Falsification & Gate Protocol (Alpha Factory v1.0)

Para que qualquer variação seja elegível para promoção a uma hipótese confirmatória (ex: H018), ela deve atender simultaneamente a:
1. **Gate 1 (Densidade Amostral)**: $N \ge 60$ trades independentes/não-sobrepostos no Discovery.
2. **Gate 2 (Expectativa Matemática Líquida)**: $E[R] \ge +0.200R$ pós-fricção real.
3. **Gate 3 (Fator de Lucro)**: $\text{PF} \ge 1.40$.
4. **Gate 4 (Significância de Bootstrap)**: $p_{\text{block}} < 0.0500$ via Block Bootstrap de 14 dias (1.000 iterações).
5. **Gate 5 (Controle de Falsa Descoberta)**: $q_{\text{BY}} < 0.0500$ sob correção Benjamini-Yekutieli.

---

## 6. Divisão de Tarefas & Alocação de Agentes (Agent Assignments)

| Agente Responsável | Missão / Responsabilidade | Entregáveis |
| :--- | :--- | :--- |
| **`@[cto-executive]`** | Supervisão de conformidade com o `MASTER_PROMPT.md`, integridade epistemológica e isolamento de Holdout. | Aprovação formal do plano, congelamento do escopo do AD011. |
| **`@[backend-specialist]`** | Implementação do pipeline de ingestão de dados TradFi (API pública v8 nativa sem dependências pesadas) sem poluir os datasets de produção. | `research/alpha_discovery/AD011/data/fetch_tradfi_datasets.js` e datasets JSON normalizados. |
| **`@[edge-validator-agent]`** | Construção do motor de simulação MTF e execução da grade combinatória de 24 células com o gerador do Alpha Factory. | `research/alpha_discovery/AD011/engine/ad011_mtf_engine.js` |
| **`@[meta-agent]` (Red Team)** | Auditoria forense contra vazamento de dados, lookahead bias na agregação de 4H e slippage de gaps de abertura. | Laudo forense de ausência de vazamento de dados. |
| **`@[test-engineer]`** | Criação da suíte de testes de verificação para o motor MTF e os cálculos estatísticos de Bootstrap e BY. | `tests/verification/verify_ad011_mtf_engine.test.js` |

---

## 7. Fases de Execução do Plano (Task Breakdown)

### Fase 1: Ingestão & Normalização de Dados TradFi
- [ ] Criar diretório isolado de pesquisa: `research/alpha_discovery/AD011/`
- [ ] Implementar script de download de dados históricos de 1H (2022–2024 para Discovery, 2025–2026 preservado para Holdout) para `SPY`, `QQQ`, `EURUSD=X`, `GBPUSD=X`, `GLD` e sincronizar com `BTCUSDT`.
- [ ] Validar integridade dos timestamps, gaps de fim de semana e normalização das colunas OHLCV.

### Fase 2: Construção do Motor de Agregação MTF e Detecção Causal
- [ ] Implementar agregador 1H $\to$ 4H determinístico, garantindo que a barra de 4H só esteja visível para o motor após o fechamento do seu 4º candle de 1H (prevenção absoluta de *lookahead bias*).
- [ ] Implementar detector de Swing High / Swing Low e cálculo de pavios de rejeição de 4H.
- [ ] Implementar identificador de deslocamento CISD em 1H com filtro de corpo de vela e volume relativo.

### Fase 3: Execução da Grade Combinatória (Discovery 2022–2024)
- [ ] Executar o motor nas 24 células combinatórias do Discovery.
- [ ] Extrair métricas forenses: $N$, Win Rate, Expectancy ($E[R]$), Profit Factor ($\text{PF}$), Max Drawdown em $R$, e taxas de atrito acumuladas.

### Fase 4: Aplicação dos Testes de Falsificação Estatística
- [ ] Executar o Block Bootstrap de 14 dias (1.000 iterações por célula).
- [ ] Computar o ranking de $p$-valores e aplicar a penalidade Benjamini–Yekutieli ($q_{\text{BY}}$).
- [ ] Emitir o veredito formal: identificar quais células (se houver) superaram os 5 gates, ou registrar a falsificação da hipótese no `HYPOTHESIS_LEDGER.md`.

### Fase 5: Consolidação dos Livros Mestre & Governança
- [ ] Gerar o `AD011_DISCOVERY_REPORT.md` e salvar o arquivo de resultados `AD011_DISCOVERY_RESULTS.json`.
- [ ] Atualizar `HYPOTHESIS_LEDGER.md`, `HYPOTHESIS_LEDGER.json` e `STATE.md`.

---

## 8. Checklist de Verificação & Governança Institucional (Verification Checklist)

- [ ] **Invariante V8 Intacto**: O motor V8 de produção permanece intocado (`fc19e807...b4db1`).
- [ ] **Firewall Produção/Pesquisa**: Nenhum arquivo em `packages/` ou `lyzer edge/backend/` é modificado durante o experimento.
- [ ] **Holdout Selado**: Os dados de 2025–2026 de TradFi permanecem em diretório `holdout_sealed/` sem qualquer consulta durante a etapa de Discovery.
- [ ] **Zero Lookahead**: O agregador MTF fecha rigorosamente as barras de 4H antes de disponibilizá-las para a barra de 1H subsequente.
- [ ] **Modelagem Realista de Fricção**: Custo de corretagem, spread e slippage de gap devidamente deduzidos de cada trade.
