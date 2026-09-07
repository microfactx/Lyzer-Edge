# 🏛️ AD011 DISCOVERY REPORT — TRADFI MULTI-TIMEFRAME ALPHA

**Programa:** AD011  
**Data da Execução:** 2026-09-07T06:21:33.108Z  
**Autoridade:** Senior CTO & Executive Engineering Director  
**Status:** 🔴 ALL CELLS FALSIFIED / UNDERPOWERED  

## 1. Sumário Executivo

O programa **AD011** investigou formalmente a existência de alfa causal proveniente de **Varreduras de Liquidez em 4H (Macro Sweeps)** confirmadas por **Deslocamento CISD em 1H** em um universo diversificado de 6 ativos institucionais: Índices de Ações EUA (`SPY`, `QQQ`), Forex G10 (`EURUSD`, `GBPUSD`), Macro Commodity (`GLD`) e Benchmark de Controle Cripto (`BTCUSDT`).

Foram simuladas **24 células combinatórias** no período estrito de Discovery (2023-11-21 a 2024-12-31), aplicando fricções realistas de mercado, **Block Bootstrap de 14 dias (B=10.000)** e penalidade de multiplicidade estrita de **Benjamini-Yekutieli (BY, 2001)**.

## 2. Matriz Forense de Resultados (Todas as 24 Células)

| ID | Ativo | L (4H) | R:R | N | Win% | E[R] (Net) | PF | 95% CI | p_block | q_BY | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AD011_SPY_L24_RR25** | SPY | 24 | 2.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_SPY_L24_RR35** | SPY | 24 | 3.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_SPY_L48_RR25** | SPY | 48 | 2.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_SPY_L48_RR35** | SPY | 48 | 3.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_QQQ_L24_RR25** | QQQ | 24 | 2.5 | 1 | 100% | **+0.581R** | 99 | [0.58, 0.58] | 0.0001 | 0.0023 | 🔴 REJECT |
| **AD011_QQQ_L24_RR35** | QQQ | 24 | 3.5 | 1 | 100% | **+0.581R** | 99 | [0.58, 0.58] | 0.0001 | 0.0023 | 🔴 REJECT |
| **AD011_QQQ_L48_RR25** | QQQ | 48 | 2.5 | 1 | 100% | **+0.581R** | 99 | [0.58, 0.58] | 0.0001 | 0.0023 | 🔴 REJECT |
| **AD011_QQQ_L48_RR35** | QQQ | 48 | 3.5 | 1 | 100% | **+0.581R** | 99 | [0.58, 0.58] | 0.0001 | 0.0023 | 🔴 REJECT |
| **AD011_EURUSD_L24_RR25** | EURUSD | 24 | 2.5 | 16 | 37.5% | **-0.356R** | 0.5 | [-0.88, 0.39] | 0.8942 | 1.0000 | 🔴 REJECT |
| **AD011_EURUSD_L24_RR35** | EURUSD | 24 | 3.5 | 16 | 37.5% | **-0.347R** | 0.51 | [-0.88, 0.41] | 0.8816 | 1.0000 | 🔴 REJECT |
| **AD011_EURUSD_L48_RR25** | EURUSD | 48 | 2.5 | 11 | 27.3% | **-0.716R** | 0.12 | [-1.11, -0.26] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_EURUSD_L48_RR35** | EURUSD | 48 | 3.5 | 11 | 27.3% | **-0.716R** | 0.12 | [-1.11, -0.26] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_GBPUSD_L24_RR25** | GBPUSD | 24 | 2.5 | 14 | 35.7% | **-0.391R** | 0.44 | [-0.84, 0.03] | 0.9552 | 1.0000 | 🔴 REJECT |
| **AD011_GBPUSD_L24_RR35** | GBPUSD | 24 | 3.5 | 14 | 35.7% | **-0.320R** | 0.54 | [-0.83, 0.11] | 0.8969 | 1.0000 | 🔴 REJECT |
| **AD011_GBPUSD_L48_RR25** | GBPUSD | 48 | 2.5 | 11 | 36.4% | **-0.347R** | 0.48 | [-0.77, 0.09] | 0.9474 | 1.0000 | 🔴 REJECT |
| **AD011_GBPUSD_L48_RR35** | GBPUSD | 48 | 3.5 | 11 | 36.4% | **-0.256R** | 0.61 | [-0.76, 0.18] | 0.8423 | 1.0000 | 🔴 REJECT |
| **AD011_GLD_L24_RR25** | GLD | 24 | 2.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_GLD_L24_RR35** | GLD | 24 | 3.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_GLD_L48_RR25** | GLD | 48 | 2.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_GLD_L48_RR35** | GLD | 48 | 3.5 | 0 | 0% | **0.000R** | 0 | [0.00, 0.00] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_BTCUSDT_L24_RR25** | BTCUSDT | 24 | 2.5 | 16 | 31.3% | **-0.560R** | 0.2 | [-0.92, -0.15] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_BTCUSDT_L24_RR35** | BTCUSDT | 24 | 3.5 | 16 | 31.3% | **-0.560R** | 0.2 | [-0.92, -0.15] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_BTCUSDT_L48_RR25** | BTCUSDT | 48 | 2.5 | 10 | 20% | **-0.747R** | 0.06 | [-1.07, -0.35] | 1.0000 | 1.0000 | 🔴 REJECT |
| **AD011_BTCUSDT_L48_RR35** | BTCUSDT | 48 | 3.5 | 10 | 20% | **-0.747R** | 0.06 | [-1.07, -0.35] | 1.0000 | 1.0000 | 🔴 REJECT |

## 3. Diagnóstico e Avaliação dos 5 Gates Constitucionais

Para que uma hipótese seja elegível para a Fase de Confirmação (Holdout 2025–2026), ela precisa atender rigorosamente a todos os 5 gates:
1. **Gate 1 (Densidade Amostral)**: $N \ge 60$ trades não-sobrepostos.
2. **Gate 2 (Expectativa Líquida)**: $E[R] \ge +0.200R$ pós-custos.
3. **Gate 3 (Fator de Lucro)**: $\text{PF} \ge 1.40$.
4. **Gate 4 (Significância de Bootstrap)**: $p_{\text{block}} < 0.0500$.
5. **Gate 5 (Controle Benjamini-Yekutieli)**: $q_{\text{BY}} < 0.0500$.

### 🔴 Veredito: Falsificação / Poder Estatístico Insuficiente
Nenhuma das 24 variações atingiu cumulativamente os 5 gates. As causas estruturais observadas nos dados são detalhadas no arquivo forense.
