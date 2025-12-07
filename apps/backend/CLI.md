# MarketMind Backtesting CLI

Sistema de linha de comando para validar, otimizar e analisar estratégias de trading através de backtesting com dados históricos reais da Binance.

## 📋 Índice

- [Instalação](#instalação)
- [Comandos Disponíveis](#comandos-disponíveis)
- [Guia Rápido](#guia-rápido)
- [Exemplos Práticos](#exemplos-práticos)
- [Estratégias Disponíveis](#estratégias-disponíveis)
- [Parâmetros e Opções](#parâmetros-e-opções)
- [Resultados e Métricas](#resultados-e-métricas)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Instalação

As dependências já estão instaladas. Para verificar se o CLI está funcionando:

```bash
npm run backtest -- --help
```

## 📌 Comandos Disponíveis

| Comando | Descrição | Atalho NPM |
|---------|-----------|------------|
| `validate` | Validar uma estratégia com backtest detalhado | `npm run backtest:validate` |
| `optimize` | Otimizar parâmetros via grid search | `npm run backtest:optimize` |
| `walkforward` | Análise walk-forward para validar robustez da estratégia | `npm run backtest:walkforward` |
| `montecarlo` | Simulação Monte Carlo para análise estatística | `npm run backtest:montecarlo` |
| `sensitivity` | Análise de sensibilidade de parâmetros para detectar over-optimization | `npm run backtest:sensitivity` |
| `compare` | Comparar múltiplos resultados de backtests | `npm run backtest:compare` |
| `export` | Exportar resultados para CSV | `npm run backtest:export` |

---

## ⚡ Guia Rápido

### 1. Validar uma estratégia

Teste uma estratégia com parâmetros específicos:

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --min-confidence 70
```

**Resultado:**
- Total de trades executados
- Win rate, profit factor, Sharpe ratio
- Max drawdown e comissões
- Interpretação automática dos resultados
- Arquivo JSON salvo automaticamente em `results/validations/`

### 2. Otimizar parâmetros

Encontre os melhores parâmetros através de grid search:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --param minConfidence=60,70,80 \
  --parallel 4 \
  --top 10
```

**Resultado:**
- Testa todas as combinações (27 no exemplo acima)
- Execução paralela (4 workers)
- Top 10 melhores resultados em tabela
- Estatísticas agregadas (média de win rate, PnL, etc.)
- Recomendação automática da melhor configuração
- Arquivo JSON salvo em `results/optimizations/`

### 3. Comparar resultados

Compare múltiplos backtests lado a lado:

```bash
npm run backtest:compare -- \
  results/validations/setup91_BTCUSDT_*.json \
  results/validations/setup91_ETHUSDT_*.json
```

**Resultado:**
- Tabela comparativa com todas as métricas
- Identificação dos melhores performers
- Ranking por diferentes métricas

### 4. Walk-Forward Analysis

Valide a robustez da estratégia evitando overfitting:

```bash
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1,2,3 \
  --param takeProfitPercent=4,6,8 \
  --training-months 6 \
  --testing-months 2 \
  --step-months 2
```

**O que acontece:**
- Divide dados em janelas (6 meses treino + 2 meses teste)
- Otimiza parâmetros no período de treino
- Valida no período de teste (out-of-sample)
- Move janela e repete
- Calcula degradação de performance

**Resultado:**
- Métricas agregadas (in-sample vs out-of-sample)
- Degradação de performance (threshold: 30%)
- Avaliação de robustez (ROBUST ou NOT ROBUST)
- Recomendação baseada em estabilidade

### 5. Exportar para CSV

Exporte resultados para análise em Excel/Sheets:

```bash
npm run backtest:export -- \
  results/validations/setup91_BTCUSDT_*.json \
  --output my-analysis.csv \
  --verbose
```

**Resultado:**
- CSV com todos os trades individuais
- Summary com métricas finais
- Preview no terminal (com --verbose)

---

## 📊 Exemplos Práticos

### Exemplo 1: Teste Rápido (1 mês)

Validação rápida com 1 mês de dados:

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --min-confidence 70
```

### Exemplo 2: Otimização Completa (ano todo)

Grid search com dados do ano inteiro:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1,1.5,2,2.5,3 \
  --param takeProfitPercent=4,5,6,7,8 \
  --param minConfidence=50,60,70,80 \
  --parallel 4 \
  --sort-by totalPnlPercent \
  --min-win-rate 50 \
  --min-profit-factor 1.5 \
  --top 5
```

Isso testará **5 × 5 × 4 = 100 combinações** e filtrará apenas as que têm win rate >50% e profit factor >1.5.

### Exemplo 3: Multi-Símbolo

Teste a mesma estratégia em múltiplos pares:

```bash
# BTC
npm run backtest:validate -- \
  --strategy setup91 --symbol BTCUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# ETH
npm run backtest:validate -- \
  --strategy setup91 --symbol ETHUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# SOL
npm run backtest:validate -- \
  --strategy setup91 --symbol SOLUSDT --interval 4h \
  --start 2024-01-01 --end 2024-12-01 \
  --capital 1000 --stop-loss 2 --take-profit 6

# Comparar resultados
npm run backtest:compare -- results/validations/setup91_*USDT_4h_*.json
```

### Exemplo 4: Timeframe Comparison

Compare a mesma estratégia em diferentes timeframes:

```bash
# 1 hora
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 1h --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# 4 horas
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 4h --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# 1 dia
npm run backtest:validate -- --strategy setup91 --symbol BTCUSDT --interval 1d --start 2024-01-01 --end 2024-12-01 --capital 1000 --stop-loss 2 --take-profit 6

# Comparar
npm run backtest:compare -- results/validations/setup91_BTCUSDT_*.json
```

### Exemplo 5: Walk-Forward Analysis Completo

Validação profissional de robustez evitando overfitting:

```bash
# Passo 1: Run walk-forward analysis
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --training-months 6 \
  --testing-months 2 \
  --step-months 2 \
  --verbose
```

**O que acontece:**
1. Cria janelas deslizantes (sliding windows):
   - Window 1: Jan-Jun (treino) + Jul-Ago (teste)
   - Window 2: Mar-Ago (treino) + Set-Out (teste)
   - Window 3: Mai-Out (treino) + Nov-Dez (teste)

2. Para cada janela:
   - Otimiza 9 combinações (3×3) no período de treino
   - Escolhe melhores parâmetros
   - Valida no período de teste (out-of-sample)

3. Calcula métricas agregadas:
   - Sharpe Ratio médio in-sample vs out-of-sample
   - Degradação de performance
   - Robustez da estratégia

**Interpretação dos resultados:**

- **Degradação < 15%**: ✓ Excelente estabilidade
- **Degradação 15-30%**: ⚠ Estabilidade aceitável
- **Degradação > 30%**: ✗ Overfitting detectado

**Quando usar Walk-Forward:**
- Antes de colocar estratégia em produção
- Para validar parâmetros otimizados
- Para detectar overfitting
- Para avaliar robustez temporal

### 6. Monte Carlo Simulation

Análise estatística via simulação Monte Carlo:

```bash
npm run backtest:montecarlo -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --simulations 1000 \
  --confidence-level 0.95
```

**O que acontece:**
- Executa backtest inicial
- Embaralha ordem dos trades 1000 vezes (Fisher-Yates shuffle)
- Calcula distribuição de resultados possíveis
- Fornece intervalos de confiança (95%)
- Estima probabilidades de cenários específicos

**Resultado:**
- Estatísticas (média, mediana, desvio padrão)
- Intervalos de confiança para equity, drawdown, retorno
- Probabilidades (lucro, drawdowns >10/20/30%, retornos >10/20/50%)
- Cenários: pior caso, melhor caso, mediano
- Avaliação de significância estatística

**Interpretação:**
- **Probability of Profit > 80%**: ✓ Estatisticamente significativo
- **95% CI não inclui zero**: ✓ Resultados robustos
- **Worst case ainda lucrativo**: ✓ Excelente consistência
- **Std Dev muito alto**: ⚠ Alta variabilidade

**Quando usar Monte Carlo:**
- Para avaliar significância estatística dos resultados
- Para estimar probabilidades de diferentes cenários
- Para calcular intervalos de confiança
- Para stress testing da estratégia

### 7. Sensitivity Analysis

Detecte over-optimization analisando sensibilidade de parâmetros:

```bash
npm run backtest:sensitivity -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1,1.5,2,2.5,3 \
  --param takeProfitPercent=4,5,6,7,8 \
  --metric sharpeRatio
```

**O que acontece:**
- Testa todas as combinações de parâmetros
- Analisa sensibilidade de cada parâmetro individualmente
- Classifica sensibilidade (LOW, MEDIUM, HIGH, CRITICAL)
- Identifica regiões estáveis de performance (plateaus)
- Detecta over-optimization automaticamente

**Resultado:**
- **Análise por Parâmetro**: Sensibilidade, max deviation, avg deviation
- **Recommended Range**: Faixa de valores estáveis
- **Over-Optimization Detection**: Alerta se parâmetros estão super-otimizados
- **Optimal Plateau**: Região estável de alto desempenho
- **Robustness Score**: 0-100 (quanto maior, mais robusto)
- **Heatmap 2D**: Se testar exatamente 2 parâmetros

**Interpretação da Sensibilidade:**
- **LOW (<10% deviation)**: ✓ Parâmetro robusto, seguro para uso
- **MEDIUM (10-25%)**: ⚠ Sensibilidade moderada, usar com cuidado
- **HIGH (25-50%)**: ⚠⚠ Alta sensibilidade, risco de overfitting
- **CRITICAL (>50%)**: ✗ Parâmetro super-otimizado, NÃO usar

**Robustness Score:**
- **80-100**: ✓ Excelente - estratégia production-ready
- **60-79**: ⚠ Aceitável - validar com walk-forward
- **<60**: ✗ Over-optimized - re-otimizar com ranges mais amplos

**Quando usar Sensitivity:**
- Após otimização de parâmetros
- Para validar parâmetros escolhidos
- Para identificar parâmetros críticos vs robustos
- Antes de colocar estratégia em produção

---

## 🎯 Estratégias Disponíveis

| Estratégia | Nome CLI | Tipo | Timeframe Ideal |
|------------|----------|------|----------------|
| Setup 9.1 | `setup91` | Trend Pullback (LONG) | 1h, 4h |
| Setup 9.2 | `setup92` | Pullback/Retest (LONG) | 4h, 1d |
| Setup 9.3 | `setup93` | Breakout + Continuation | 1h, 4h |
| Setup 9.4 | `setup94` | Support/Resistance Bounce | 4h, 1d |
| Pattern 1-2-3 | `pattern123` | Classical Swing Pattern | 4h, 1d |
| Bull Trap | `bullTrap` | Reversal SHORT | 1h, 4h |
| Bear Trap | `bearTrap` | Reversal LONG | 1h, 4h |
| Breakout Retest | `breakoutRetest` | Momentum + Retest | 1h, 4h |
| Pinbar | `pinbar` | Consolidation Breakout | 1h, 4h |
| Inside Bar | `insidebar` | Consolidation Breakout | 1h, 4h |
| Order Block + FVG | `orderBlockFVG` | Smart Money Concepts | 4h, 1d |
| VWAP EMA Cross | `vwapEma` | Volume-Weighted | 15m, 1h |
| Divergence | `divergence` | RSI/MACD Reversals | 1h, 4h |
| Liquidity Sweep | `liquiditySweep` | Smart Money Liquidity | 1h, 4h |

---

## ⚙️ Parâmetros e Opções

### Comando: `validate`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `--strategy` | ✅ | - | Nome da estratégia (ex: setup91) |
| `--symbol` | ✅ | - | Par de trading (ex: BTCUSDT, ETHUSDT) |
| `--interval` | ✅ | - | Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.) |
| `--start` | ✅ | - | Data inicial (YYYY-MM-DD) |
| `--end` | ✅ | - | Data final (YYYY-MM-DD) |
| `--capital` | ❌ | 1000 | Capital inicial em USD |
| `--stop-loss` | ❌ | 2 | Stop loss em % |
| `--take-profit` | ❌ | 6 | Take profit em % |
| `--min-confidence` | ❌ | 70 | Confiança mínima do setup (0-100) |
| `--max-position` | ❌ | 10 | Tamanho máximo da posição (% do capital) |
| `--commission` | ❌ | 0.1 | Comissão por trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Usar SL/TP calculados pela estratégia |
| `--only-with-trend` | ❌ | true | Apenas trades alinhados com EMA200 |
| `--verbose` | ❌ | false | Mostrar logs detalhados trade-by-trade |

### Comando: `optimize`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `--strategy` | ✅ | - | Nome da estratégia |
| `--symbol` | ✅ | - | Par de trading |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Data inicial |
| `--end` | ✅ | - | Data final |
| `--param` | ✅ | - | Parâmetro a otimizar (formato: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Capital inicial |
| `--parallel` | ❌ | 4 | Número de workers paralelos (1-16) |
| `--sort-by` | ❌ | totalPnlPercent | Métrica para ordenar resultados |
| `--top` | ❌ | 10 | Número de top resultados a exibir |
| `--min-win-rate` | ❌ | - | Filtrar por win rate mínimo (%) |
| `--min-profit-factor` | ❌ | - | Filtrar por profit factor mínimo |

**Exemplo de múltiplos --param:**
```bash
--param stopLossPercent=1,2,3 \
--param takeProfitPercent=4,6,8 \
--param minConfidence=60,70,80
```
Isso testará **3 × 3 × 3 = 27 combinações**.

### Comando: `walkforward`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `--strategy` | ✅ | - | Nome da estratégia |
| `--symbol` | ✅ | - | Par de trading |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Data inicial |
| `--end` | ✅ | - | Data final |
| `--param` | ✅ | - | Parâmetro a otimizar (formato: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Capital inicial |
| `--training-months` | ❌ | 6 | Tamanho da janela de treino (meses) |
| `--testing-months` | ❌ | 2 | Tamanho da janela de teste (meses) |
| `--step-months` | ❌ | 2 | Passo para mover janelas (meses) |
| `--verbose` | ❌ | false | Mostrar logs detalhados de todas as janelas |

### Comando: `montecarlo`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `--strategy` | ✅ | - | Nome da estratégia |
| `--symbol` | ✅ | - | Par de trading |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Data inicial |
| `--end` | ✅ | - | Data final |
| `--capital` | ❌ | 1000 | Capital inicial em USD |
| `--stop-loss` | ❌ | 2 | Stop loss em % |
| `--take-profit` | ❌ | 6 | Take profit em % |
| `--min-confidence` | ❌ | 70 | Confiança mínima do setup (0-100) |
| `--max-position` | ❌ | 10 | Tamanho máximo da posição (% do capital) |
| `--commission` | ❌ | 0.1 | Comissão por trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Usar SL/TP calculados pela estratégia |
| `--only-with-trend` | ❌ | true | Apenas trades alinhados com EMA200 |
| `--simulations` | ❌ | 1000 | Número de simulações Monte Carlo (100-100000) |
| `--confidence-level` | ❌ | 0.95 | Nível de confiança (0.80-0.99) |
| `--verbose` | ❌ | false | Mostrar logs detalhados |

### Comando: `sensitivity`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `--strategy` | ✅ | - | Nome da estratégia |
| `--symbol` | ✅ | - | Par de trading |
| `--interval` | ✅ | - | Timeframe |
| `--start` | ✅ | - | Data inicial |
| `--end` | ✅ | - | Data final |
| `--param` | ✅ | - | Parâmetro a analisar (formato: name=val1,val2,val3) |
| `--capital` | ❌ | 1000 | Capital inicial em USD |
| `--min-confidence` | ❌ | 70 | Confiança mínima do setup (0-100) |
| `--max-position` | ❌ | 10 | Tamanho máximo da posição (% do capital) |
| `--commission` | ❌ | 0.1 | Comissão por trade (%) |
| `--use-algorithmic-levels` | ❌ | false | Usar SL/TP calculados pela estratégia |
| `--only-with-trend` | ❌ | true | Apenas trades alinhados com EMA200 |
| `--metric` | ❌ | sharpeRatio | Métrica para análise (sharpeRatio, totalReturn, profitFactor, winRate) |
| `--verbose` | ❌ | false | Mostrar resultados detalhados por parâmetro |

**Exemplo de múltiplos --param:**
```bash
--param stopLossPercent=1,1.5,2,2.5,3 \
--param takeProfitPercent=4,5,6,7,8
```
Isso testará **5 × 5 = 25 combinações** e analisará sensibilidade de cada parâmetro.

### Comando: `compare`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `<files...>` | ✅ | - | Arquivos JSON para comparar (mínimo 2) |
| `--verbose` | ❌ | false | Mostrar logs detalhados |

### Comando: `export`

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `<file>` | ✅ | - | Arquivo JSON para exportar |
| `--output` | ❌ | auto | Caminho do CSV de saída |
| `--verbose` | ❌ | false | Mostrar preview do CSV |

---

## 📈 Resultados e Métricas

### Métricas Calculadas

| Métrica | Descrição | Valor Bom |
|---------|-----------|-----------|
| **Total Trades** | Número de trades executados | >30 (validação estatística) |
| **Win Rate** | % de trades vencedores | >55% |
| **Profit Factor** | (Total ganhos) / (Total perdas) | >2.0 |
| **Total PnL** | Lucro/prejuízo total (%) | >20% ao ano |
| **Sharpe Ratio** | Retorno ajustado ao risco | >1.5 |
| **Max Drawdown** | Maior queda desde o pico (%) | <20% |
| **Avg Trade Duration** | Duração média dos trades | Varia por estratégia |
| **Total Commission** | Comissões pagas | Quanto menor, melhor |

### Interpretação Automática

O CLI fornece interpretação automática dos resultados:

```
✓ POSITIVES:
  • Excellent win rate (61.7%)
  • Excellent profit factor (2.58)
  • Good Sharpe ratio (1.82)
  • Low max drawdown (1.69%)
  • Good sample size (47 trades)

⚠ AREAS FOR IMPROVEMENT:
  (nenhuma neste caso)

✓ RECOMMENDATION: Strategy shows promise! Consider parameter optimization.
```

### Estrutura de Resultados Salvos

Os resultados são salvos automaticamente em:

```
results/
├── validations/              # Resultados de validate
│   ├── setup91_BTCUSDT_1h_2024-12-07T00-22-57.json
│   └── setup91_ETHUSDT_1h_2024-12-07T00-23-06.json
├── optimizations/            # Resultados de optimize
│   └── setup91_BTCUSDT_4h_2024-12-07T01-15-30.json
├── walkforward/              # Resultados de walk-forward analysis
│   └── setup91_BTCUSDT_4h_wf_2024-12-07T02-30-15.json
├── montecarlo/               # Resultados de Monte Carlo simulation
│   └── setup91_BTCUSDT_4h_mc_2024-12-07T03-45-22.json
├── sensitivity/              # Resultados de sensitivity analysis
│   └── setup91_BTCUSDT_4h_sensitivity_2024-12-07T04-20-33.json
└── comparisons/              # CSVs exportados
    └── setup91_BTCUSDT_1h_2024-12-07T00-22-57.csv
```

---

## 🔧 Troubleshooting

### Erro: "Symbol must end with USDT"

**Causa:** Símbolo inválido (ex: BTC, BTCUSD)

**Solução:** Use símbolos que terminam com USDT (ex: BTCUSDT, ETHUSDT, SOLUSDT)

### Erro: "Start date must be before end date"

**Causa:** Datas invertidas

**Solução:** Verifique que `--start` é anterior a `--end`

### Erro: "Risk/Reward ratio is below recommended minimum"

**Causa:** Take profit muito baixo em relação ao stop loss

**Solução:**
- Aumentar `--take-profit` ou diminuir `--stop-loss`
- Ou usar `--use-algorithmic-levels` para deixar a estratégia calcular SL/TP

### Aviso: "Grid search will test X combinations. This may take a long time."

**Causa:** Muitas combinações de parâmetros

**Solução:**
- Reduzir número de valores em cada `--param`
- Começar com grid grosso, depois refinar
- Aumentar `--parallel` (até 8)

### Erro: "File not found"

**Causa:** Arquivo de resultado não existe

**Solução:** Verifique o caminho do arquivo (use `ls results/validations/`)

---

## 💡 Dicas e Boas Práticas

### 1. Workflow Iterativo Recomendado

```bash
# 1. Teste rápido (1 mês)
npm run backtest:validate -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-11-01 --end 2024-12-01

# 2. Se resultados promissores, otimize (grid grosso)
npm run backtest:optimize -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --param stopLossPercent=1,2,3 \
  --param takeProfitPercent=4,6,8 \
  --parallel 4 --top 5

# 3. Refinar melhor região
npm run backtest:optimize -- \
  --strategy setup91 --symbol BTCUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --param stopLossPercent=1.5,1.75,2,2.25,2.5 \
  --param takeProfitPercent=5.5,6,6.5 \
  --parallel 4 --top 3

# 4. Validar em outros símbolos
npm run backtest:validate -- \
  --strategy setup91 --symbol ETHUSDT --interval 1h \
  --start 2024-01-01 --end 2024-12-01 \
  --stop-loss 2 --take-profit 6
```

### 2. Períodos de Teste

- **Teste rápido**: 1 mês (Nov 2024)
- **Validação**: 6 meses (Jul-Dez 2024)
- **Otimização completa**: Ano todo (2024)
- **Out-of-sample**: Últimos 3 meses (Out-Dez 2024)

### 3. Filtros de Qualidade

Use filtros para encontrar apenas estratégias viáveis:

```bash
--min-win-rate 50 \
--min-profit-factor 1.5
```

### 4. Paralelização

- **1-2 workers**: CPU mais lenta
- **4 workers**: Padrão recomendado
- **8 workers**: Se você tem CPU potente
- **>8 workers**: Geralmente não melhora performance

---

## 📚 Recursos Adicionais

- **Código fonte**: `/apps/backend/src/cli/`
- **Resultados**: `/apps/backend/results/`
- **Estratégias**: `/apps/backend/src/services/setup-detection/`

---

## 🚨 Avisos Importantes

1. **Resultados passados não garantem resultados futuros**
2. **Sempre teste em paper trading antes de usar capital real**
3. **Comissões da Binance**: 0.1% para spot (padrão), 0.02-0.04% para Maker/Taker
4. **Slippage não está incluído** nos backtests (mercado real pode ter slippage)
5. **Tamanho mínimo de posição**: Binance tem requisitos mínimos de ordem (ex: $10-20 USD)

---

## 📞 Suporte

Em caso de problemas ou dúvidas, verifique:
1. Este documento (CLI.md)
2. Logs de erro (com `--verbose`)
3. Arquivos de código em `/apps/backend/src/cli/`

Happy backtesting! 📈🚀
