# 🏛️ AD014 DISCOVERY REPORT — ALGORITHMIC PASSIVE INCOME & REGIME-PROTECTED MACRO CARRY

**Programa:** AD014  
**Data da Execução:** 2026-09-07T07:58:19.364Z  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Status:** 🔴 ALL CELLS FALSIFIED / FAILED  

## 1. Sumário Executivo

O programa **AD014** investigou formalmente motores de **Renda Passiva Algorítmica** baseados em Carry Trade Macro com Disjuntor Dinâmico de Regime e Rendimento Seguro em T-Bills Soberanas ($5,00\%\text{ a.a.}$). Foram avaliadas 16 células cobrindo moedas G10 e Cripto Delta-Neutro:
* **USDJPY**: Long Carry capturando diferencial Fed ($5,33\%$) vs BoJ ($0,10\%$) $= +5,20\%\text{ a.a.}$
* **EURUSD**: Short Carry capturando diferencial Fed ($5,33\%$) vs ECB ($3,65\%$) $= +1,68\%\text{ a.a.}$
* **GBPUSD**: Short Carry capturando diferencial Fed ($5,33\%$) vs BoE ($5,00\%$) $= +0,33\%\text{ a.a.}$
* **BTCUSDT**: Delta-Neutral Basis Carry com Staking Líquido e Funding Perpétuo ($+8,50\%\text{ a.a.}$) benchmark.

## 2. Matriz Forense de Resultados (16 Células no Discovery 2023–2024)

| ID | Ativo | EMA | Vol Lim | Ret. Anual | Ret. Total | Sharpe | MaxDD | % Tempo Ativo | Giros | p_block | q_BY | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AD014_USDJPY_EMA100_VOL120** | USDJPY | 100 | 1.2 | **+-0.4%** | +-0.31% | **-0.02** | **6.09%** | 48.7% | 167 | 0.0001 | 0.0011 | 🔴 REJECT |
| **AD014_USDJPY_EMA100_VOL135** | USDJPY | 100 | 1.35 | **+0.32%** | +0.25% | **0.08** | **6.4%** | 52.7% | 149 | 0.0001 | 0.0011 | 🔴 REJECT |
| **AD014_USDJPY_EMA200_VOL120** | USDJPY | 200 | 1.2 | **+10.81%** | +8.09% | **1.49** | **5.49%** | 47.7% | 111 | 0.0001 | 0.0011 | 🔴 REJECT |
| **AD014_USDJPY_EMA200_VOL135** | USDJPY | 200 | 1.35 | **+10.86%** | +8.13% | **1.37** | **4.74%** | 53% | 92 | 0.0001 | 0.0011 | 🔴 REJECT |
| **AD014_EURUSD_EMA100_VOL120** | EURUSD | 100 | 1.2 | **+-5.02%** | +-3.91% | **-1.08** | **6.2%** | 37.7% | 161 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_EURUSD_EMA100_VOL135** | EURUSD | 100 | 1.35 | **+-3.91%** | +-3.04% | **-0.79** | **7.3%** | 41.7% | 157 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_EURUSD_EMA200_VOL120** | EURUSD | 200 | 1.2 | **+-0.84%** | +-0.64% | **-0.14** | **4.86%** | 40.8% | 127 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_EURUSD_EMA200_VOL135** | EURUSD | 200 | 1.35 | **+0.81%** | +0.62% | **0.18** | **6.75%** | 45.7% | 115 | 0.0001 | 0.0011 | 🔴 REJECT |
| **AD014_GBPUSD_EMA100_VOL120** | GBPUSD | 100 | 1.2 | **+-1.85%** | +-1.43% | **-0.35** | **5.09%** | 39.1% | 153 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_GBPUSD_EMA100_VOL135** | GBPUSD | 100 | 1.35 | **+-3.91%** | +-3.04% | **-0.75** | **7.33%** | 43% | 149 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_GBPUSD_EMA200_VOL120** | GBPUSD | 200 | 1.2 | **+-5.88%** | +-4.52% | **-1.18** | **6.75%** | 38.9% | 137 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_GBPUSD_EMA200_VOL135** | GBPUSD | 200 | 1.35 | **+-5.24%** | +-4.02% | **-1.01** | **8.65%** | 43.9% | 121 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_BTCUSDT_EMA100_VOL120** | BTCUSDT | 100 | 1.2 | **+-29.46%** | +-34.67% | **-11.04** | **34.67%** | 70.2% | 215 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_BTCUSDT_EMA100_VOL135** | BTCUSDT | 100 | 1.35 | **+-20.33%** | +-24.21% | **-8.44** | **24.21%** | 80.3% | 155 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_BTCUSDT_EMA200_VOL120** | BTCUSDT | 200 | 1.2 | **+-29.46%** | +-34.4% | **-11.04** | **34.4%** | 70.3% | 213 | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD014_BTCUSDT_EMA200_VOL135** | BTCUSDT | 200 | 1.35 | **+-20.24%** | +-23.91% | **-8.42** | **23.91%** | 80.4% | 153 | 1.0000 | 1.0000 | 🔴 REJECT |

## 3. Avaliação dos 5 Gates Constitucionais de Renda Passiva

1. **Gate 1 (Rendimento Anual Líquido)**: Retorno Anual $\ge +6.00\%\text{ a.a.}$ em dólares.  
2. **Gate 2 (Retorno Total Líquido)**: Lucro Total Líquido $> 0.00\%$.  
3. **Gate 3 (Índice de Sharpe)**: Sharpe Ratio $\ge 3.00$.  
4. **Gate 4 (Preservação de Capital / Max Drawdown)**: Drawdown Máximo $\le 4.00\%$.  
5. **Gate 5 (Significância de Bootstrap & Multiplicidade)**: $p_{\text{block}} < 0.0500$ e $q_{\text{BY}} < 0.0500$ sob Benjamini-Yekutieli ($m=16$).  

### 🔴 Veredito: Nenhuma célula atingiu simultaneamente os 5 gates constitucionais.
