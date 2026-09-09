# 🏛️ CAPITAL ENGINE — BATCH 001 PRE-REGISTRATION & FALSIFICATION MANDATE

**Batch Identifier:** `CE-B001`  
**Study Title:** `CAPITAL ENGINE REAL ESTATE LEVERAGE VS. PASSIVE BRL BENCHMARK`  
**Registration Date:** 2026-09-09  
**Epistemic Authority:** Jonatan Ciamarro (Fundador) & Senior CTO Executive Office  
**Status:** 🔒 **FROZEN & IMMUTABLE (PRE-EXECUTION REGISTRATION)**  

---

## 🔬 1. ECONOMIC THESIS & RESEARCH QUESTION

### 1.1 O Fenômeno Econômico Proposto
Propõe-se que uma estrutura de alavancagem patrimonial via consórcio imobiliário (com ou sem lance embutido), combinada com preservação de caixa em renda fixa, aquisição de ativo imobiliário gerador de aluguel e amortização programada, possa produzir:
1. Retorno Líquido Patrimonial ($\text{NAV}_t$) superior ao carrego passivo de um benchmark de Renda Fixa líquida brasileira (CDI / Tesouro Selic).
2. Fluxo de caixa livre operacional consistente para alimentar o `LYZER ALPHA ENGINE` sem canibalização do principal.

### 1.2 Regra Constitucional Inegociável
> **"Nenhuma operação de consórcio é considerada uma arbitragem até que o retorno líquido, ajustado por todos os custos, fricções de entrada/saída, vacância, tributação, inadimplência e risco de iliquidez, supere um benchmark de renda fixa com liquidez equivalente."**

### 1.3 Pergunta Científica Central
> **"Existe alguma configuração paramétrica de consórcio imobiliário (novo ou em andamento, com lance próprio ou embutido) e exploração imobiliária que entregue $\text{NAV}_{180}$ e fluxo de caixa livre estatística e economicamente superiores ao carrego passivo de R$ 100.000 em Renda Fixa pós-fixada (CDI 100%–120%), após dedução de todas as fricções e sob estresse adverso?"**

---

## ⚖️ 2. HIPÓTESES FORMALIZADAS (NULL VS. ALTERNATIVE)

$$\begin{aligned}
H_0 &: \text{NAV}_t(\text{Estratégia}) \le \text{NAV}_t(\text{Benchmark}) \quad \forall t \in [1, T], \quad \text{ou } \text{DSCR}_t < 1.0 \text{ (Risco de Inadimplência)} \\
H_1 &: \text{NAV}_T(\text{Estratégia}) > \text{NAV}_T(\text{Benchmark}) \times (1 + \text{Hurdle Premium}) \quad \text{com } \text{DSCR}_t \ge 1.20 \quad \forall t
\end{aligned}$$

Onde:
- $\text{Benchmark}$: R$ 100.000 alocados em Renda Fixa pós-fixada com liquidez e reinvestimento integral dos juros líquidos.
- $\text{Hurdle Premium}$: Spread mínimo de 2.0% a.a. líquido exigido para compensar a iliquidez imobiliária e o risco de execução.

---

## 📐 3. MODELAGEM MÊS A MÊS DO NAV E FLUXO DE CAIXA ($t = 1 \dots 180$)

Para cada mês $t \in [1, 180]$:

### 3.1 Balanço do Imóvel e Fricções
- **Valor de Mercado do Imóvel:** $V_{\text{imóvel}, t} = V_{\text{imóvel}, t-1} \times (1 + g_{\text{imóvel}})$, onde $g_{\text{imóvel}}$ é a taxa de valorização mensal (baseline = IPCA).
- **Custos de Aquisição ($t=0$):** $4.0\%$ do valor do imóvel (ITBI 2.5% + Registro/Escritura 1.5%).
- **Custos de Saída (Liquidação a Valor Justo):** $6.0\%$ de corretagem imobiliária.
- **Tributação sobre Ganho de Capital:** $15.0\%$ sobre $(V_{\text{venda}} - V_{\text{aquisição}} - \text{Reformas})$.

### 3.2 Dinâmica Operacional do Aluguel
- **Aluguel Bruto Contratual:** $R_{\text{bruto}, t} = V_{\text{imóvel}, t} \times y_{\text{locação}}$.
- **Vacância Efetiva:** $v_t \in [0.00, 0.15]$. Em meses de vacância, o proprietário assume condomínio e IPTU.
- **Taxa de Administração Imobiliária:** $10.0\%$ sobre o aluguel recebido.
- **Provisão de Manutenção:** $1.0$ mês de aluguel a cada 18 meses.
- **Tributação do Aluguel:** 
  - Trilha PF: Tabela progressiva do Carnê-Leão (alíquota efetiva líquida de deduções: ~15% a 22.5%).
  - Trilha PJ: Lucro Presumido (11.33% total).

### 3.3 Dinâmica do Consórcio
- **Saldo Devedor:** $\text{SD}_t = \text{SD}_{t-1} \times (1 + \text{INCC}_{\text{mensal}}) - \text{Amortização}_t$.
- **Parcela Mensal:** $P_{\text{consórcio}, t}$, corrigida anualmente pelo INCC.

### 3.4 Equação do Verdadeiro NAV Mensal
$$\text{NAV}_t = \left[ V_{\text{imóvel}, t} \times (1 - 0.06) - \text{IR}_{\text{ganho\_capital}, t} \right] + \text{Caixa Core}_t - \text{SD}_t$$

Onde:
$$\text{Caixa Core}_t = \text{Caixa Core}_{t-1} \times (1 + r_{\text{CDI, líq}}) + \Delta \text{Fluxo de Caixa}_t$$
$$\Delta \text{Fluxo de Caixa}_t = R_{\text{líquido}, t} - P_{\text{consórcio}, t}$$

Se $\text{Caixa Core}_t < 0 \implies \mathbf{DEFAULT\_EVENT}$ (o investidor não tem liquidez para cobrir a parcela).

---

## 🔬 4. MATRIZ PARAMÉTRICA DE ESTRESSE PRÉ-REGISTRADA

Serão testadas 24 células combinatórias:
1. **Benchmark Core:**
   - B1: CDB 100% CDI
   - B2: CDB 115% CDI
   - B3: LCI 92% CDI
2. **Estrutura de Consórcio:**
   - C1: 100% Lance Próprio (R$ 100k consumidos, carta R$ 300k líquida).
   - C2: Lance Embutido 20% (R$ 60k) + Lance Próprio R$ 30k (carta líquida R$ 240k, R$ 70k retidos no Core).
   - C3: Cota em Andamento (Deságio 15% na aquisição, Lance Embutido 20% + R$ 20k próprio, R$ 70k retidos).
3. **Yield de Locação Imobiliária:**
   - Y1: 0.40% ao mês líquido (Mercado conservador / residencial padrão).
   - Y2: 0.55% ao mês líquido (Mercado eficiente / estúdio / comercial compacto).
4. **Cenários de Vacância e Estresse:**
   - V0: Vacância 0% (Inquilino perfeito perpétuo - baseline teórico).
   - V1: Vacância 8% (Padrão de mercado B3/FIIs - 1 mês vazio a cada 12 meses).
   - V2: Vacância 15% (Estresse severo).
   - S1: Estresse de INCC descolado do IPCA (INCC 7.0% a.a. vs IPCA 4.0% a.a.).
