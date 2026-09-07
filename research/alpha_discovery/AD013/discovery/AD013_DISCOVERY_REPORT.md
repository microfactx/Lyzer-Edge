# 🏛️ AD013 DISCOVERY REPORT — HIGH-FREQUENCY TRADFI REGIME-ADAPTIVE ALPHA

**Programa:** AD013  
**Data da Execução:** 2026-09-07T07:41:40.977Z  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Status:** 🔴 ALL CELLS FALSIFIED / UNDERPOWERED  

## 1. Sumário Executivo

O programa **AD013** investigou formalmente um motor intradiário (1H) adaptativo condicionado por regimes de mercado (Trend Pullback em $\text{ADX} \ge 22$ vs Reversão Extrema de Bandas de Bollinger em $\text{ADX} < 20$) em 7 ativos representativos de TradFi e Cripto:
* **Índices de Ações EUA**: `SPY` (S&P 500), `QQQ` (Nasdaq 100)
* **Commodities**: `GLD` (Ouro)
* **Forex G10**: `EURUSD`, `GBPUSD`, `USDJPY`
* **Controle Cripto**: `BTCUSDT`

Foi imposta uma **restrição mandatória de frequência de pelo menos 2 trades/semana** ($N \ge 116$ trades nas 58 semanas do Discovery).

## 2. Matriz Forense de Resultados (Todas as 28 Células)

| ID | Ativo | Modo | R:R | Z | N | Freq/wk | Win% | E[R] (Net) | PF | 95% CI | p_block | q_BY | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AD013_SPY_REGIME_S1_RR15** | SPY | STRICT | 1.5 | 2 | 49 | 0.84 | 44.9% | **-0.012R** | 0.98 | [-0.31, 0.30] | 0.5316 | 1.0000 | 🔴 REJECT |
| **AD013_SPY_REGIME_S1_RR20** | SPY | STRICT | 2 | 2 | 47 | 0.81 | 38.3% | **-0.054R** | 0.92 | [-0.40, 0.31] | 0.6217 | 1.0000 | 🔴 REJECT |
| **AD013_SPY_REGIME_S2_RR15** | SPY | DEEP | 1.5 | 2.5 | 36 | 0.62 | 52.8% | **+0.185R** | 1.37 | [-0.13, 0.52] | 0.1285 | 1.0000 | 🔴 REJECT |
| **AD013_SPY_REGIME_S2_RR20** | SPY | DEEP | 2 | 2.5 | 36 | 0.62 | 41.7% | **+0.046R** | 1.07 | [-0.30, 0.39] | 0.4017 | 1.0000 | 🔴 REJECT |
| **AD013_QQQ_REGIME_S1_RR15** | QQQ | STRICT | 1.5 | 2 | 60 | 1.03 | 35% | **-0.212R** | 0.69 | [-0.52, 0.13] | 0.9016 | 1.0000 | 🔴 REJECT |
| **AD013_QQQ_REGIME_S1_RR20** | QQQ | STRICT | 2 | 2 | 59 | 1.02 | 33.9% | **-0.162R** | 0.76 | [-0.49, 0.19] | 0.8216 | 1.0000 | 🔴 REJECT |
| **AD013_QQQ_REGIME_S2_RR15** | QQQ | DEEP | 1.5 | 2.5 | 51 | 0.88 | 45.1% | **+0.031R** | 1.06 | [-0.32, 0.40] | 0.4214 | 1.0000 | 🔴 REJECT |
| **AD013_QQQ_REGIME_S2_RR20** | QQQ | DEEP | 2 | 2.5 | 50 | 0.86 | 42% | **+0.074R** | 1.12 | [-0.31, 0.48] | 0.3427 | 1.0000 | 🔴 REJECT |
| **AD013_GLD_REGIME_S1_RR15** | GLD | STRICT | 1.5 | 2 | 45 | 0.78 | 40% | **-0.078R** | 0.88 | [-0.44, 0.28] | 0.6606 | 1.0000 | 🔴 REJECT |
| **AD013_GLD_REGIME_S1_RR20** | GLD | STRICT | 2 | 2 | 42 | 0.72 | 38.1% | **+0.035R** | 1.05 | [-0.40, 0.50] | 0.4394 | 1.0000 | 🔴 REJECT |
| **AD013_GLD_REGIME_S2_RR15** | GLD | DEEP | 1.5 | 2.5 | 26 | 0.45 | 34.6% | **-0.205R** | 0.71 | [-0.61, 0.22] | 0.8332 | 1.0000 | 🔴 REJECT |
| **AD013_GLD_REGIME_S2_RR20** | GLD | DEEP | 2 | 2.5 | 25 | 0.43 | 36% | **+0.010R** | 1.01 | [-0.51, 0.55] | 0.4771 | 1.0000 | 🔴 REJECT |
| **AD013_EURUSD_REGIME_S1_RR15** | EURUSD | STRICT | 1.5 | 2 | 181 | 3.12 | 43.1% | **-0.376R** | 0.53 | [-0.58, -0.17] | 0.9999 | 1.0000 | 🔴 REJECT |
| **AD013_EURUSD_REGIME_S1_RR20** | EURUSD | STRICT | 2 | 2 | 172 | 2.97 | 37.8% | **-0.343R** | 0.61 | [-0.57, -0.11] | 0.9990 | 1.0000 | 🔴 REJECT |
| **AD013_EURUSD_REGIME_S2_RR15** | EURUSD | DEEP | 1.5 | 2.5 | 136 | 2.34 | 42.6% | **-0.388R** | 0.52 | [-0.65, -0.11] | 0.9986 | 1.0000 | 🔴 REJECT |
| **AD013_EURUSD_REGIME_S2_RR20** | EURUSD | DEEP | 2 | 2.5 | 131 | 2.26 | 35.9% | **-0.419R** | 0.54 | [-0.69, -0.12] | 0.9993 | 1.0000 | 🔴 REJECT |
| **AD013_GBPUSD_REGIME_S1_RR15** | GBPUSD | STRICT | 1.5 | 2 | 207 | 3.57 | 39.6% | **-0.471R** | 0.46 | [-0.61, -0.33] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD013_GBPUSD_REGIME_S1_RR20** | GBPUSD | STRICT | 2 | 2 | 193 | 3.33 | 35.8% | **-0.414R** | 0.55 | [-0.60, -0.23] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD013_GBPUSD_REGIME_S2_RR15** | GBPUSD | DEEP | 1.5 | 2.5 | 133 | 2.29 | 36.8% | **-0.501R** | 0.44 | [-0.68, -0.32] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD013_GBPUSD_REGIME_S2_RR20** | GBPUSD | DEEP | 2 | 2.5 | 126 | 2.17 | 34.9% | **-0.392R** | 0.57 | [-0.64, -0.16] | 0.9995 | 1.0000 | 🔴 REJECT |
| **AD013_USDJPY_REGIME_S1_RR15** | USDJPY | STRICT | 1.5 | 2 | 189 | 3.26 | 36.5% | **-0.378R** | 0.51 | [-0.57, -0.20] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD013_USDJPY_REGIME_S1_RR20** | USDJPY | STRICT | 2 | 2 | 181 | 3.12 | 33.7% | **-0.299R** | 0.63 | [-0.52, -0.08] | 0.9965 | 1.0000 | 🔴 REJECT |
| **AD013_USDJPY_REGIME_S2_RR15** | USDJPY | DEEP | 1.5 | 2.5 | 137 | 2.36 | 35% | **-0.425R** | 0.48 | [-0.68, -0.17] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD013_USDJPY_REGIME_S2_RR20** | USDJPY | DEEP | 2 | 2.5 | 133 | 2.29 | 32.3% | **-0.343R** | 0.59 | [-0.63, -0.06] | 0.9901 | 1.0000 | 🔴 REJECT |
| **AD013_BTCUSDT_REGIME_S1_RR15** | BTCUSDT | STRICT | 1.5 | 2 | 347 | 5.98 | 44.1% | **-0.189R** | 0.73 | [-0.34, -0.05] | 0.9936 | 1.0000 | 🔴 REJECT |
| **AD013_BTCUSDT_REGIME_S1_RR20** | BTCUSDT | STRICT | 2 | 2 | 320 | 5.52 | 39.1% | **-0.157R** | 0.79 | [-0.32, 0.00] | 0.9711 | 1.0000 | 🔴 REJECT |
| **AD013_BTCUSDT_REGIME_S2_RR15** | BTCUSDT | DEEP | 1.5 | 2.5 | 283 | 4.88 | 44.5% | **-0.170R** | 0.75 | [-0.33, -0.01] | 0.9837 | 1.0000 | 🔴 REJECT |
| **AD013_BTCUSDT_REGIME_S2_RR20** | BTCUSDT | DEEP | 2 | 2.5 | 262 | 4.52 | 37.8% | **-0.174R** | 0.77 | [-0.35, -0.01] | 0.9770 | 1.0000 | 🔴 REJECT |

## 3. Avaliação dos 5 Gates Constitucionais

1. **Gate 1 (Densidade & Frequência)**: $N \ge 116$ trades ($\ge 2.0\text{ trades/semana}$).  
2. **Gate 2 (Expectativa Líquida)**: $E[R] \ge +0.150R$ pós-custos.  
3. **Gate 3 (Fator de Lucro)**: $\text{PF} \ge 1.30$.  
4. **Gate 4 (Significância de Bootstrap)**: $p_{\text{block}} < 0.0500$ (14-day Calendar Block Bootstrap, $B=10.000$).  
5. **Gate 5 (Controle Benjamini-Yekutieli)**: $q_{\text{BY}} < 0.0500$ ($m=28$).  

### 🔴 Veredito: Falsificação / Rejeição por Ausência de Alfa Líquido
Nenhuma das 28 células atingiu cumulativamente todos os 5 critérios constitucionais após fricções reais.
