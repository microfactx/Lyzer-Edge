---
type: research_and_framework
title: Capital Engine - Consórcio Imobiliário, Alavancagem Patrimonial & DSCR Modeling
created: 2026-09-09
status: approved
author: Jonatan Ciamarro & CTO Office
---

# LYZER CAPITAL ENGINE: CONSÓRCIO QUANTITATIVO & ASSET LEVERAGE

## 1. Princípio de Separação de Mandato

O ecossistema Lyzer é governado por dois motores estanques:

```
┌─────────────────────────────────────────────────────────────┐
│                 LYZER CAPITAL ENGINE (Core)                 │
│  Tesouro Selic • CDB 110-120% • LCI/LCA • Consórcio Imóvel  │
│  Gera: Solidez de Balanço, Preservação e Fluxo de Caixa     │
└──────────────────────────────┬──────────────────────────────┘
                               │
               FLUXO LÍQUIDO EXCEDENTE (Risk Budget)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  LYZER ALPHA ENGINE (Edge)                  │
│   Funding/Basis Carry • Microestrutura L3 • StatArb Quant   │
│   Objetivo: Captura de Alfa Descorrelacionado sem Ruína     │
└─────────────────────────────────────────────────────────────┘
```

**Regulamento Constitucional BACEN:**
A carta de crédito de consórcio contemplada possui vinculação estrita à categoria do bem (Resolução BCB 285). É vedado seu direcionamento para contas de trading de derivativos. O crédito deve ser transformado em **ativo gerador de fluxo real (imóvel)**, cujo excedente de caixa é vertido ao Alpha Engine.

---

## 2. Modelagem Matemática do Consórcio Quantitativo

### A. Eficiência de Contemplação ($\text{CE}$)
Mede a multiplicação de poder de compra em relação ao capital próprio líquido imobilizado:

$$\text{CE} = \frac{\text{Crédito Líquido Disponível}}{\text{Capital Próprio Imobilizado}} = \frac{C_{\text{nominal}} - L_{\text{embutido}}}{L_{\text{próprio}} + \text{Custos}_{\text{adm}}}$$

- **Estratégia A (100% Lance Próprio):** $C = 300\text{k}, L_p = 100\text{k} \implies \text{CE} = 3.0\times$. (Liquidez própria aniquilada).
- **Estratégia B (Lance Embutido 20% + Lance Próprio R$ 30k):** $C_{\text{liq}} = 240\text{k}, L_p = 30\text{k} \implies \text{CE} = 8.0\times$. (R$ 70k retidos rendendo juros compostos).

### B. Cobertura do Serviço da Dívida ($\text{DSCR}$)
Mede a imunidade do sistema à inadimplência e à vacância imobiliária:

$$\text{DSCR} = \frac{\text{Fluxo de Caixa Líquido do Ativo (Aluguel)} + \text{Rendimento do Caixa Core}}{\text{Parcela Mensal do Consórcio}}$$

- $\text{DSCR} < 1.0$: Sistema frágil. Exige aporte externo contínuo (*Negative Carry*).
- $1.0 \le \text{DSCR} < 1.3$: Sistema vulnerável a vacância ou inadimplência do inquilino.
- $\text{DSCR} \ge 1.5$: **Grau Institucional Lyzer**. A renda fixa cobre qualquer hiato de aluguel e gera sobra para o Alpha Engine.

### C. Custo Efetivo Real do Consórcio ($\text{CET}_{\text{consórcio}}$)
O consórcio não é isento de juros; ele possui custo financeiro estrutural:

$$\text{CET}_{\text{anual}} \approx \frac{\text{Taxa Adm Total} + \text{Fundo Reserva}}{\text{Prazo (anos)}} + \text{Seguro MIP (a.a.)} + \text{Reajuste Anual (INCC/IPCA)}$$

---

## 3. Matriz Quantitativa de Seleção de Grupos em Andamento

Para cotas de grupos em andamento ou novas, o filtro quantitativo do Lyzer exige:

| Métrica | Critério Mínimo | Critério Ideal (Score 10) |
| :--- | :--- | :--- |
| **Distribuição de Lances (P50 - Mediana)** | $\le 35\%$ do saldo | $\le 28\%$ do saldo |
| **Estabilidade dos Lances (P75 - P25)** | Desvio interquartil $\le 8\%$ | Desvio interquartil $\le 4\%$ |
| **Percentual Máximo de Lance Embutido** | $\ge 20\%$ | $25\%$ a $30\%$ |
| **Inadimplência do Grupo** | $\le 12\%$ | $\le 5\%$ |
| **Saldo do Fundo Comum** | $\ge 2$ créditos médios | $\ge 5$ créditos médios |
| **Prazo Decorrido da Cota** | $\ge 20\%$ do total | $30\%$ a $45\%$ do total |
| **Governança da Administradora** | Fiscalizada BACEN / Top 10 | Banco de 1ª linha ou Adm Líder |
