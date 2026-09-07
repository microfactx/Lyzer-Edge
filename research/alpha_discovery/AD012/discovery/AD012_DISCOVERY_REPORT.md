# 🏛️ AD012 DISCOVERY REPORT — CROSS-ASSET TREND BREAKOUT & VOLATILITY EXPANSION

**Programa:** AD012  
**Data da Execução:** 2026-09-07T07:20:54.977Z  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Status:** 🔴 ALL CELLS FALSIFIED / UNDERPOWERED  

## 1. Sumário Executivo

O programa **AD012** investigou formalmente se o rompimento de canais macro de 4H (Donchian Breakout) acompanhado por expansão intradiária de volatilidade ($ATR_{14} \ge 1.15 \times MA(ATR)_{50}$) captura alfa de continuação direcional (Trend Following / Momentum) em 6 ativos: `SPY`, `QQQ`, `EURUSD`, `GBPUSD`, `GLD` e `BTCUSDT`.

Foram simuladas **24 células combinatórias** no período de Discovery (2023-11-21 a 2024-12-31), aplicando fricções realistas de corretagem, spread e slippage, com **Block Bootstrap de 14 dias (B=10.000)** e penalidade de **Benjamini-Yekutieli (BY, 2001)**.

## 2. Matriz Forense de Resultados (Todas as 24 Células)

| ID | Ativo | L (4H) | R:R | N | Win% | E[R] (Net) | PF | 95% CI | p_block | q_BY | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AD012_SPY_L20_RR20** | SPY | 20 | 2 | 25 | 32% | **-0.090R** | 0.87 | [-0.57, 0.44] | 0.6427 | 1.0000 | 🔴 REJECT |
| **AD012_SPY_L20_RR30** | SPY | 20 | 3 | 24 | 25% | **-0.235R** | 0.68 | [-0.71, 0.32] | 0.8113 | 1.0000 | 🔴 REJECT |
| **AD012_SPY_L50_RR20** | SPY | 50 | 2 | 16 | 43.8% | **+0.256R** | 1.44 | [-0.46, 1.17] | 0.3028 | 1.0000 | 🔴 REJECT |
| **AD012_SPY_L50_RR30** | SPY | 50 | 3 | 15 | 26.7% | **-0.393R** | 0.42 | [-0.84, 0.25] | 0.9508 | 1.0000 | 🔴 REJECT |
| **AD012_QQQ_L20_RR20** | QQQ | 20 | 2 | 27 | 37% | **-0.019R** | 0.97 | [-0.50, 0.56] | 0.5189 | 1.0000 | 🔴 REJECT |
| **AD012_QQQ_L20_RR30** | QQQ | 20 | 3 | 24 | 25% | **-0.317R** | 0.57 | [-0.78, 0.33] | 0.8910 | 1.0000 | 🔴 REJECT |
| **AD012_QQQ_L50_RR20** | QQQ | 50 | 2 | 14 | 42.9% | **+0.200R** | 1.34 | [-0.46, 0.91] | 0.2885 | 1.0000 | 🔴 REJECT |
| **AD012_QQQ_L50_RR30** | QQQ | 50 | 3 | 12 | 33.3% | **+0.027R** | 1.04 | [-0.76, 1.03] | 0.4529 | 1.0000 | 🔴 REJECT |
| **AD012_EURUSD_L20_RR20** | EURUSD | 20 | 2 | 84 | 28.6% | **-0.353R** | 0.57 | [-0.64, -0.04] | 0.9924 | 1.0000 | 🔴 REJECT |
| **AD012_EURUSD_L20_RR30** | EURUSD | 20 | 3 | 80 | 23.8% | **-0.421R** | 0.52 | [-0.73, -0.07] | 0.9969 | 1.0000 | 🔴 REJECT |
| **AD012_EURUSD_L50_RR20** | EURUSD | 50 | 2 | 56 | 17.9% | **-0.624R** | 0.33 | [-0.90, -0.35] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD012_EURUSD_L50_RR30** | EURUSD | 50 | 3 | 53 | 15.1% | **-0.641R** | 0.33 | [-0.93, -0.36] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD012_GBPUSD_L20_RR20** | GBPUSD | 20 | 2 | 83 | 28.9% | **-0.401R** | 0.54 | [-0.66, -0.13] | 0.9991 | 1.0000 | 🔴 REJECT |
| **AD012_GBPUSD_L20_RR30** | GBPUSD | 20 | 3 | 75 | 22.7% | **-0.535R** | 0.42 | [-0.79, -0.26] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD012_GBPUSD_L50_RR20** | GBPUSD | 50 | 2 | 57 | 26.3% | **-0.453R** | 0.49 | [-0.78, -0.11] | 0.9976 | 1.0000 | 🔴 REJECT |
| **AD012_GBPUSD_L50_RR30** | GBPUSD | 50 | 3 | 51 | 21.6% | **-0.590R** | 0.38 | [-0.86, -0.28] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD012_GLD_L20_RR20** | GLD | 20 | 2 | 28 | 32.1% | **-0.095R** | 0.87 | [-0.79, 0.48] | 0.5752 | 1.0000 | 🔴 REJECT |
| **AD012_GLD_L20_RR30** | GLD | 20 | 3 | 23 | 26.1% | **-0.219R** | 0.71 | [-0.85, 0.54] | 0.7025 | 1.0000 | 🔴 REJECT |
| **AD012_GLD_L50_RR20** | GLD | 50 | 2 | 18 | 44.4% | **+0.273R** | 1.46 | [-0.72, 0.89] | 0.2139 | 1.0000 | 🔴 REJECT |
| **AD012_GLD_L50_RR30** | GLD | 50 | 3 | 13 | 46.2% | **+0.389R** | 1.68 | [-0.60, 1.50] | 0.2350 | 1.0000 | 🔴 REJECT |
| **AD012_BTCUSDT_L20_RR20** | BTCUSDT | 20 | 2 | 152 | 42.8% | **+0.098R** | 1.16 | [-0.15, 0.33] | 0.2049 | 1.0000 | 🔴 REJECT |
| **AD012_BTCUSDT_L20_RR30** | BTCUSDT | 20 | 3 | 132 | 39.4% | **+0.204R** | 1.32 | [-0.10, 0.50] | 0.0850 | 1.0000 | 🔴 REJECT |
| **AD012_BTCUSDT_L50_RR20** | BTCUSDT | 50 | 2 | 91 | 47.3% | **+0.265R** | 1.52 | [-0.02, 0.53] | 0.0230 | 1.0000 | 🔴 REJECT |
| **AD012_BTCUSDT_L50_RR30** | BTCUSDT | 50 | 3 | 78 | 42.3% | **+0.385R** | 1.67 | [0.02, 0.71] | 0.0100 | 0.9062 | 🔴 REJECT |

## 3. Diagnóstico e Avaliação dos 5 Gates Constitucionais

1. **Gate 1 (Densidade Amostral)**: $N \ge 60$ trades não-sobrepostos.
2. **Gate 2 (Expectativa Líquida)**: $E[R] \ge +0.200R$ pós-custos.
3. **Gate 3 (Fator de Lucro)**: $\text{PF} \ge 1.40$.
4. **Gate 4 (Significância de Bootstrap)**: $p_{\text{block}} < 0.0500$.
5. **Gate 5 (Controle Benjamini-Yekutieli)**: $q_{\text{BY}} < 0.0500$.

### 🔴 Veredito: Falsificação / Poder Estatístico Insuficiente
Nenhuma das 24 variações atingiu cumulativamente os 5 gates constitucionais.
