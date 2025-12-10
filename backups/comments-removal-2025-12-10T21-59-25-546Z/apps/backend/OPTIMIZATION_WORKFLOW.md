# 🎯 Workflow de Otimização de Estratégias - MarketMind

## Objetivo

Melhorar o desempenho de todas as estratégias através de otimização sistemática de parâmetros, com foco em aumentar o **Profit Factor** de 1.13-1.36 para 1.5-2.5 (meta da indústria).

## Problema Identificado

Após análise comparativa com benchmarks:
- ✅ Win Rates corretas (28-67% conforme tipo de estratégia)
- ❌ Profit Factors baixos (1.13-1.36 vs esperado 1.5-2.5)
- ❌ PnL baixo/negativo (-3.75% a +0.93%)

**Causa raiz:** Parâmetros de R:R (Risk:Reward), targets e stops não otimizados.

## Estratégia de Otimização

### 1️⃣ Fase 1: Otimização em Massa

**Executar:**
```bash
cd apps/backend
node batch-optimize.mjs
```

**O que faz:**
- Otimiza 10 estratégias principais
- Período: 2023-2024 completo (2 anos para maior robustez)
- Grid search com 9-48 combinações por estratégia
- Foca em melhorar Profit Factor e PnL
- Filtros: min WR 30%, min PF 1.3
- Execução paralela (4 workers)

**Duração estimada:** 2-4 horas (dependendo do hardware)

**Estratégias incluídas:**
1. order-block-fvg
2. liquidity-sweep
3. divergence-rsi-macd
4. larry-williams-9-1
5. larry-williams-9-2
6. larry-williams-9-3
7. larry-williams-9-4
8. connors-rsi2-original
9. mean-reversion-bb-rsi
10. rsi2-mean-reversion

### 2️⃣ Fase 2: Aplicar Parâmetros Otimizados

**Executar:**
```bash
node apply-optimized-params.mjs
```

**O que faz:**
- Lê os resultados da otimização
- Atualiza arquivos JSON das estratégias
- Mantém histórico de otimizações anteriores
- Adiciona seção `backtestSummary` com métricas

**Arquivos modificados:**
- `strategies/builtin/<strategy>.json` (cada estratégia otimizada)

### 3️⃣ Fase 3: Validação dos Resultados

**Executar:**
```bash
# Validar uma estratégia específica
npm run backtest:validate -- \
  --strategy order-block-fvg \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-06-01 \
  --end 2024-12-31

# Ou rodar script de comparação (antes vs depois)
node compare-optimization-results.mjs
```

**O que validar:**
- ✅ Profit Factor > 1.5 (meta mínima)
- ✅ PnL positivo no período de teste
- ✅ Win Rate mantido ou melhorado
- ✅ Max Drawdown controlado (<10%)

### 4️⃣ Fase 4: Walk-Forward Analysis (Robustez)

**Executar:**
```bash
npm run backtest:walkforward -- \
  --strategy order-block-fvg \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2023-01-01 \
  --end 2024-12-31 \
  --training-months 6 \
  --testing-months 2 \
  --step-months 2
```

**O que avaliar:**
- Degradação de performance < 30% (in-sample vs out-of-sample)
- Consistência nos períodos de teste
- Robustez geral (ROBUST ou NOT ROBUST)

## Parâmetros Otimizados por Tipo de Estratégia

### Smart Money (Order Blocks, Liquidity Sweeps)
- `lookbackPeriod`: 30-60 candles
- `orderBlockVolumeMultiplier`: 1.2-1.8x
- `targetMultiplier`: 1.5-3.0 (foco em aumentar R:R)

### Momentum/Trend (Larry Williams, Divergências)
- `lookbackDays`: 3-7 dias
- `rsiPeriod`: 10-16
- `divergenceLookback`: 10-20
- `targetMultiplier`: 2.0-3.5 (aumentar targets)

### Mean Reversion (Connors RSI2, BB-RSI)
**FOCO PRINCIPAL:** Aumentar targets e reduzir stops para melhorar R:R
- `rsiOversoldLevel`: 5-15
- `targetPercent`: 0.5-2.0% (AUMENTAR - era muito baixo)
- `stopLossPercent`: 1.5-2.5% (REDUZIR - era muito largo)
- `bbStdDev`: 1.5-2.5

## Métricas de Sucesso

### Antes da Otimização (Jun-Dez 2024)
| Métrica | Valor Atual | Meta |
|---------|-------------|------|
| Profit Factor | 1.13-1.36 | >1.5 |
| PnL % (6 meses) | -3.75% a +0.93% | >3% |
| Win Rate | 28-67% | Manter |
| Max Drawdown | 3-5% | <10% |

### Após Otimização (Esperado)
| Métrica | Meta | Ideal |
|---------|------|-------|
| Profit Factor | 1.5-2.0 | >2.0 |
| PnL % (6 meses) | 3-8% | >10% |
| Win Rate | 30-70% | Manter |
| Max Drawdown | <8% | <5% |

## Troubleshooting

### Otimização muito lenta
- Reduzir `--parallel` de 4 para 2
- Reduzir grid de parâmetros (menos valores)
- Usar período mais curto (6 meses em vez de 2 anos)

### Nenhuma configuração passa nos filtros
- Reduzir `--min-win-rate` de 30% para 25%
- Reduzir `--min-profit-factor` de 1.3 para 1.2
- Ampliar grid de parâmetros

### Performance pior após otimização
- Overfitting! Usar walk-forward analysis
- Ampliar grid de parâmetros (menos granular)
- Aumentar período de otimização

## Cronograma Sugerido

**Dia 1:**
- ✅ Rodar `batch-optimize.mjs` (2-4h)
- ✅ Revisar resultados em `results/optimizations/`

**Dia 2:**
- ✅ Executar `apply-optimized-params.mjs`
- ✅ Validar 3 estratégias principais
- ✅ Comparar métricas antes/depois

**Dia 3:**
- ✅ Walk-forward analysis nas top 5 estratégias
- ✅ Ajustes finos se necessário
- ✅ Documentar resultados finais

## Arquivos Gerados

```
results/
├── optimizations/
│   ├── order-block-fvg_BTCUSDT_1h_2024-12-09.json
│   ├── liquidity-sweep_BTCUSDT_1h_2024-12-09.json
│   └── ... (10 arquivos)
│
├── validations/
│   ├── order-block-fvg_BTCUSDT_1h_after_optimization.json
│   └── ... (comparações)
│
└── walkforward/
    └── order-block-fvg_BTCUSDT_1h_walkforward.json
```

## Próximos Passos

Após otimização bem-sucedida:

1. **Commit das mudanças**
   ```bash
   git add strategies/builtin/*.json
   git commit -m "feat: optimize strategy parameters (PF 1.13-1.36 → 1.5-2.0)"
   ```

2. **Atualizar documentação**
   - Adicionar métricas otimizadas ao README
   - Atualizar BACKTEST_ANALYSIS_2024.md

3. **Preparar para trading real**
   - Testar com paper trading (simulador)
   - Monitorar performance em tempo real
   - Ajustar position sizing

## Comandos Rápidos

```bash
# 1. Otimizar todas as estratégias
node batch-optimize.mjs

# 2. Aplicar parâmetros otimizados
node apply-optimized-params.mjs

# 3. Validar uma estratégia
npm run backtest:validate -- --strategy <name> --symbol BTCUSDT --interval 1h --start 2024-06-01 --end 2024-12-31

# 4. Comparar resultados
npm run backtest:compare -- results/validations/*order-block-fvg*.json

# 5. Walk-forward (robustez)
npm run backtest:walkforward -- --strategy <name> --symbol BTCUSDT --interval 1h --start 2023-01-01 --end 2024-12-31
```

---

**Nota:** Este workflow visa melhorar sistematicamente todas as estratégias para atingir benchmarks da indústria (PF 1.5-2.5, PnL positivo consistente).
