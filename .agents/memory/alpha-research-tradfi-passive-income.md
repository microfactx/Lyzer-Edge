---
type: project
created: 2026-09-07
updated: 2026-09-07
---

# Alpha Research & TradFi Passive Income Lineage (AD013–AD016 & H017)

## User Mandate & Operational Status
- **User Directive**: Focus on institutional algorithmic passive income ("renda passiva algorítmica") with strict capital preservation.
- **H017 Status**: Confirmed production alpha (Productive Collateral Carry 2.0x, LST Staking, +6.42% a.a. in holdout, Sharpe 14.89, MaxDD 1.45%). Currently in an active 7-day wall-clock soak on Railway testnet running until **2026-09-14**. Zero modifications allowed to H017 code or capital during the soak.

## TradFi Research Discoveries (2023–2024 Discovery Window)
1. **AD013 (TradFi Regime Adaptive)**:
   - Evaluated 28 intraday cells (SPY, QQQ, GLD, EURUSD, GBPUSD, USDJPY, BTC).
   - Falsified (0/28 approved under BY FDR). Forex achieved $\ge 2$ trades/week but had negative expectancy ($-0.30R$ to $-0.50R$). Equities had positive drift but failed sample density ($N < 60$).

2. **AD014 (Passive Macro Carry & T-Bills Anchor)**:
   - Evaluated 16 single-currency macro carry cells.
   - Breakthrough isolated in `USDJPY`: `AD014_USDJPY_EMA200_VOL135` achieved **+10.86% a.a. net return** ($p=0.0001, q_{\text{BY}}=0.0008$) by harvesting Fed-BoJ swap spread and avoiding the July 2024 Yen Unwind via 5.0% T-Bills. MaxDD was 4.74%.

3. **AD015 (Multi-Currency Carry Basket)**:
   - Evaluated 16 basket cells across 4 JPY carry pairs (`USDJPY`, `GBPJPY`, `AUDJPY`, `CADJPY`).
   - **Primary Breakthrough**: `AD015_EW_UNIFIED_EMA200_VOL135` delivered **+9.07% annualized net return**, while basket diversification crushed Max Drawdown to **2.96%** (Passing Gate 1 $\ge 7.50\%$ and Gate 4 $\le 3.50\%$, with $p_{\text{block}} = 0.0001$ and $q_{\text{BY}} = 0.0005$).
   - Promoted to formal confirmatory charter (H019).

4. **H019 (Confirmatory Holdout 2025–2026 Validation)**:
   - Evaluated candidate `AD015_EW_UNIFIED_EMA200_VOL135` on Virgin Temporal Holdout (2025-01-01 -> 2026-09-07, 10,071 hours / 419.6 days).
   - **Constitutional Verdict: 🔴 CONFIRMATORY_REJECTION (Failed all 5 Gates)**:
     - Annualized Net Return: **-1.95% a.a.** (vs $\ge +6.00\%$)
     - Total Net Return: **-2.24%** (vs $> 0.00\%$)
     - Sharpe Ratio: **-0.28** (vs $\ge 1.20$)
     - Max Drawdown: **7.10%** (vs $\le 4.00\%$)
     - Statistical Significance: **$p_{\text{block}} = 1.0000$**
   - **Forensic Diagnosis**: High chop and bidirectional macro noise around the 200h EMA triggered 162 regime transitions (transitions every 2.5 days on average), accumulating 4.86% in turnover fee drag. Coupled with spot currency depreciation, this completely destroyed the nominal interest rate spread. Promotion permanently blocked under *"O Tribunal Nunca Aprende"*.

5. **AD016 (Dual-Funding G10 & High-Yield Emerging Market Carry)**:
   - Evaluated 24 cells under strict zero-lookahead forward stepping.
   - **Trilha A (Dual-Funding G10 - JPY + CHF)**: Proved resilient (+4.91% to +6.96% a.a.), achieved lowest drawdown in lab history (**MaxDD 2.08%**), and Sharpe up to **1.61**. Diversifying the funding leg across JPY and CHF eliminated single-currency funding shocks.
   - **Trilha B (Emerging Markets Carry - MXN, BRL, ZAR, PLN)**: Decisively FALSIFIED ($-3.49\%$ to $-9.50\%$ a.a., MaxDD up to $10.37\%$). Severe devaluations in BRL (-26%) and MXN (-20%) in 2024 completely obliterated interest carry, validating UIP and proving EM carry is an epistemic value trap.
   - **Trilha C (Hybrid)**: Contaminated by EM devaluations ($-0.17\%$ to $-3.96\%$ a.a.).

## Governance & Safety Invariants
- Production V8 Engine SHA-256 invariant: `fc19e807255b3ecfb8351e82d7dc9d244c1e511d9aa007ac8b67b12d584b4db1`.
- Virgin temporal holdout (2025–2026) remains 100% sealed in all directories (`holdout_sealed/`).

