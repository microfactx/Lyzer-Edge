# 🏛️ AD015 DISCOVERY REPORT — DIVERSIFIED MULTI-CURRENCY BASKET CARRY ENGINE

**Programa:** AD015  
**Data da Execução:** 2026-09-07T08:04:44.155Z  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Status:** 🔴 ALL CELLS FALSIFIED / FAILED  

## 1. Sumário Executivo

O programa **AD015** avaliou a criação de um motor institucional de **Renda Passiva Algorítmica Multi-Moeda** baseado em uma cesta de 4 pares com alto diferencial de taxa de juros contra o Iene Japonês (`USDJPY`, `GBPJPY`, `AUDJPY`, `CADJPY`), com swap médio de $+4,75\%\text{ a.a.}$, disjuntor dinâmico de regime e refúgio em T-Bills a $5,00\%\text{ a.a.}$.

## 2. Matriz Forense de Resultados (16 Células no Discovery 2023–2024)

| ID | Ponderação | Disjuntor | EMA | Vol Lim | Ret. Anual | Ret. Total | Sharpe | MaxDD | % Tempo Ativo | p_block | q_BY | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AD015_EW_UNIFIED_EMA100_VOL120** | EQUAL_WEIGHT | UNIFIED_BASKET | 100 | 1.2 | **+9.67%** | +7.36% | **1.3** | **4.91%** | 52.8% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_EW_UNIFIED_EMA100_VOL135** | EQUAL_WEIGHT | UNIFIED_BASKET | 100 | 1.35 | **+9.05%** | +6.9% | **1.16** | **4.91%** | 55.2% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_EW_UNIFIED_EMA200_VOL120** | EQUAL_WEIGHT | UNIFIED_BASKET | 200 | 1.2 | **+8.34%** | +6.26% | **1.2** | **2.96%** | 53.4% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_EW_UNIFIED_EMA200_VOL135** | EQUAL_WEIGHT | UNIFIED_BASKET | 200 | 1.35 | **+9.07%** | +6.8% | **1.21** | **2.96%** | 57.8% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_EW_INDEP_EMA100_VOL120** | EQUAL_WEIGHT | INDEPENDENT_PAIRS | 100 | 1.2 | **+-8.72%** | +-6.78% | **-1.38** | **7.32%** | 71.5% | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD015_EW_INDEP_EMA100_VOL135** | EQUAL_WEIGHT | INDEPENDENT_PAIRS | 100 | 1.35 | **+-6.63%** | +-5.14% | **-0.93** | **5.93%** | 74.1% | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD015_EW_INDEP_EMA200_VOL120** | EQUAL_WEIGHT | INDEPENDENT_PAIRS | 200 | 1.2 | **+-0.15%** | +-0.11% | **0.01** | **4.81%** | 70.3% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_EW_INDEP_EMA200_VOL135** | EQUAL_WEIGHT | INDEPENDENT_PAIRS | 200 | 1.35 | **+2.33%** | +1.76% | **0.37** | **4.71%** | 73.6% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_RP_UNIFIED_EMA100_VOL120** | RISK_PARITY | UNIFIED_BASKET | 100 | 1.2 | **+8.8%** | +6.7% | **1.19** | **4.98%** | 52.8% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_RP_UNIFIED_EMA100_VOL135** | RISK_PARITY | UNIFIED_BASKET | 100 | 1.35 | **+8.06%** | +6.14% | **1.04** | **4.98%** | 55.2% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_RP_UNIFIED_EMA200_VOL120** | RISK_PARITY | UNIFIED_BASKET | 200 | 1.2 | **+7.37%** | +5.54% | **1.08** | **3.03%** | 53.4% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_RP_UNIFIED_EMA200_VOL135** | RISK_PARITY | UNIFIED_BASKET | 200 | 1.35 | **+8.12%** | +6.1% | **1.1** | **3.03%** | 57.8% | 0.0001 | 0.0005 | 🔴 REJECT |
| **AD015_RP_INDEP_EMA100_VOL120** | RISK_PARITY | INDEPENDENT_PAIRS | 100 | 1.2 | **+-9.58%** | +-7.45% | **-1.53** | **8.13%** | 71.5% | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD015_RP_INDEP_EMA100_VOL135** | RISK_PARITY | INDEPENDENT_PAIRS | 100 | 1.35 | **+-7.28%** | +-5.65% | **-1.03** | **6.59%** | 74.1% | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD015_RP_INDEP_EMA200_VOL120** | RISK_PARITY | INDEPENDENT_PAIRS | 200 | 1.2 | **+-0.94%** | +-0.71% | **-0.12** | **4.91%** | 70.3% | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD015_RP_INDEP_EMA200_VOL135** | RISK_PARITY | INDEPENDENT_PAIRS | 200 | 1.35 | **+1.82%** | +1.37% | **0.3** | **4.8%** | 73.6% | 0.0001 | 0.0005 | 🔴 REJECT |

## 3. Avaliação dos 5 Gates Constitucionais de Renda Passiva

1. **Gate 1 (Rendimento Anual Líquido)**: Retorno Anual $\ge +7.50\%\text{ a.a.}$ em dólares.  
2. **Gate 2 (Total Return Positivo)**: Lucro Total Líquido $> 0.00\%$.  
3. **Gate 3 (Índice de Sharpe)**: Sharpe Ratio $\ge 2.00$.  
4. **Gate 4 (Preservação Estrita de Capital)**: Drawdown Máximo $\le 3.50\%$.  
5. **Gate 5 (Significância de Bootstrap & Multiplicidade)**: $p_{\text{block}} < 0.0500$ e $q_{\text{BY}} < 0.0500$ sob Benjamini-Yekutieli ($m=16$).  

### 🔴 Veredito: Nenhuma célula atingiu simultaneamente os 5 gates constitucionais.
