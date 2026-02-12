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

### 1️⃣ Fase 1: Otimização Completa (3 Estágios)

**Executar:**
```bash
cd apps/backend
pnpm optimize:full
```

**O que faz:**
- Stage 1: Sensitivity sweep (Fibonacci targets, entry progress, R:R ratios)
- Stage 2: Cross-product das top combinações do Stage 1
- Stage 3: Trailing stop optimization nos melhores configs
- Suporta SIGINT/SIGTERM (salva progresso para resume)
- ETA display, kline gap warnings, per-symbol stats

**Output:** `/tmp/prod-parity-optimization-run/` (summary.txt, optimal-config.json, CSVs)

### 2️⃣ Fase 2: Aplicar Parâmetros Otimizados

**Executar:**
```bash
pnpm tsx scripts/audit/apply-optimizations.ts
```

**O que faz:**
- Lê o `optimal-config.json` gerado pelo Stage 2
- Aplica os melhores parâmetros à configuração de produção
- Mantém histórico de otimizações anteriores

### 3️⃣ Fase 3: Validação dos Resultados

**Executar:**
```bash
pnpm backtest:validate -- \
  --strategy order-block-fvg \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-06-01 \
  --end 2024-12-31
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
- ✅ Rodar `pnpm optimize:full` (3 stages, suporta resume)
- ✅ Revisar summary.txt e optimal-config.json

**Dia 2:**
- ✅ Aplicar otimizações (`pnpm tsx scripts/audit/apply-optimizations.ts`)
- ✅ Validar estratégias principais
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
# 1. Otimização completa (3 stages com resume)
pnpm optimize:full

# 2. Aplicar parâmetros otimizados
pnpm tsx scripts/audit/apply-optimizations.ts

# 3. Validar uma estratégia
pnpm backtest:validate -- --strategy <name> --symbol BTCUSDT --interval 1h --start 2024-06-01 --end 2024-12-31

# 4. Comparar resultados
pnpm backtest:compare -- results/validations/*order-block-fvg*.json

# 5. Walk-forward (robustez)
pnpm backtest:walkforward -- --strategy <name> --symbol BTCUSDT --interval 1h --start 2023-01-01 --end 2024-12-31
```

---

**Nota:** Este workflow visa melhorar sistematicamente todas as estratégias para atingir benchmarks da indústria (PF 1.5-2.5, PnL positivo consistente).
