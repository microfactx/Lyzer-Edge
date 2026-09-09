# 🏛️ CAPITAL ENGINE — BATCH 001 AUDIT & FALSIFICATION REPORT

**Batch Identifier:** `CE-B001`  
**Study Title:** `CAPITAL ENGINE REAL ESTATE LEVERAGE VS. PASSIVE BRL BENCHMARK`  
**Execution Date:** 2026-09-09  
**Epistemic Authority:** Jonatan Ciamarro & Senior CTO Executive Office  
**Status:** 🔴 **FALSIFIED / REJECTED (FAIL-CLOSED CONSTITUTIONAL GOVERNANCE)**  

---

## 📊 1. EXECUTIVE SUMMARY & CONSTITUTIONAL VERDICT

A hipótese $H_1$ (de que a alavancagem patrimonial via consórcio imobiliário gera retorno líquido e fluxo de caixa superiores ao benchmark de Renda Fixa brasileiro) foi **COMPREENSIVAMENTE FALSIFICADA** em todas as células testadas.

### 🔴 Veredito do Tribunal:
$$\text{STATUS: REJECTED} \quad (H_0 \text{ CONFIRMADA})$$

1. **Destruição Relativa de NAV em Todos os Horizontes:**
   Em 15 anos ($T=180$ meses), R$ 100.000 em CDB 100% CDI acumula **R$ 515.616** líquidos (R$ 648.192 em CDB 115%). A melhor estrutura de consórcio atingiu apenas **R$ 318.251** (déficit patrimonial de R$ -197.365) no baseline, ou **R$ 435.646** sob yield extremo de aluguel.
2. **Armadilha de Iliquidez e Risco de Insolvência ($\text{Default Event}$):**
   - Na estratégia com lance próprio (C1), o investidor sofre insolvência crônica ($\text{Caixa Core}$ atinge **-R$ 129.297**), pois o aluguel líquido não cobre as parcelas reajustadas por INCC.
   - Na estratégia com lance embutido e R$ 70k retidos (C2), o caixa de segurança é gradualmente drenado ao longo dos anos para bancar o déficit operacional do imóvel, atingindo **-R$ 64.537**.
3. **Inanição Total do Lyzer Alpha Engine:**
   O fluxo de caixa livre gerado para o Lyzer Alpha foi de **R$ 0,00** em todos os cenários, pois 100% das receitas de locação foram canibalizadas pelo serviço da dívida do consórcio.

---

## 📈 2. TABELA DE RESULTADOS MÊS A MÊS AUDITADOS ($T = 180$)

| Estratégia / Benchmark | NAV 3 Anos | NAV 5 Anos | NAV 10 Anos | NAV 15 Anos | Mínimo Caixa Core | Evento de Insolvência | Fluxo ao Lyzer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CDB 100% CDI (Passivo)** | R$ 136.558 | R$ 170.406 | R$ 296.419 | **R$ 515.616** | R$ 100.000+ | 🟢 ZERO | R$ 3.630/ano (Regra 70/30) |
| **CDB 115% CDI (Yield)** | R$ 142.626 | R$ 183.562 | R$ 344.939 | **R$ 648.192** | R$ 100.000+ | 🟢 ZERO | R$ 4.200/ano |
| **LCI 92% CDI (Isento)** | R$ 142.047 | R$ 180.700 | R$ 329.818 | **R$ 601.988** | R$ 100.000+ | 🟢 ZERO | R$ 4.000/ano |
| **C1: Consórcio 100% Lance Próprio** | R$ 71.909 | R$ 99.710 | R$ 197.521 | R$ 349.189 | **-R$ 129.297** | 🔴 **SIM (DEFAULT)** | **R$ 0,00** |
| **C2: Consórcio Lance Embutido 20%** | R$ 82.951 | R$ 112.637 | R$ 200.342 | R$ 318.251 | **-R$ 64.537** | 🔴 **SIM (DEFAULT)** | **R$ 0,00** |
| **C3: Consórcio Estresse Vacância 15%**| R$ 79.264 | R$ 105.466 | R$ 179.613 | R$ 289.030 | **-R$ 93.759** | 🔴 **SIM (DEFAULT)** | **R$ 0,00** |
| **C4: Consórcio Yield Extremo (0.65%/m)**| R$ 93.366 | R$ 132.893 | R$ 260.267 | R$ 435.646 | +R$ 52.857 | 🟢 NÃO | **R$ 0,00** |

---

## 🔬 3. ANATOMIA DA FALSIFICAÇÃO (POR QUE O CONSÓRCIO PERDE?)

1. **A Fricção de Entrada e Saída (O Buraco de 10%):**
   - Na entrada: 4.0% de ITBI e cartório (R$ 9.600 a R$ 12.000 pagos em dinheiro líquido no dia 1).
   - Na saída: 6.0% de corretagem de venda.
   - Tributação de ganho de capital: 15% sobre o ganho nominal (tributa a inflação).
2. **A Ilusão do Yield Imobiliário:**
   Um aluguel bruto de 0.50%/mês (6.0% a.a.) sofre depleção imediata:
   - 8% vacância + custos de condomínio/IPTU no vazio.
   - 10% taxa de administração imobiliária.
   - 5% provisão de manutenção.
   - 15% Carnê-Leão (IR).
   - **Resultado:** O yield líquido real do imóvel desaba para **~3.4% a 3.8% a.a.**!
3. **O Descasamento INCC vs Aluguel:**
   O saldo devedor do consórcio e as parcelas sobem anualmente pelo INCC (~4.8% a.a.), enquanto o imóvel alugado sofre vacância e manutenção. A parcela devora todo o aluguel e ainda gera déficit mensal (*Negative Carry*).
4. **O Custo de Oportunidade do CDI:**
   O CDI a 13.90% a.a. é um rolo compressor matemático. Render 11.8% a 12.5% a.a. líquido, sem vacância, sem inquilino, sem reforma e com liquidez diária/escalonada bate qualquer modelo alavancado com dívida indexada.

---

## ⚖️ 4. DIRETRIZ CONSTITUCIONAL FINAL

Em observância à Regra Constitucional do Capital Engine:
> **"Nenhuma operação de consórcio imobiliário será integrada ao Capital Engine como geradora de fluxo para o Lyzer Alpha, pois ela drena o caixa, destrói o NAV relativo e impede o financiamento do sistema."**

O `CAPITAL ENGINE` permanece ancorado no **Puro Flywheel de Renda Fixa (Tesouro Selic + CDB 110–120% CDI + LCI/LCA)** com partilha estrita 70/30, garantindo liquidez total, solvência inabalável e fluxo contínuo de risk budget para o Lyzer Alpha Engine.
