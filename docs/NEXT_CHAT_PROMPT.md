# Prompt para Continuar o Plano de Otimização

## Contexto

Estou trabalhando no MarketMind, um app Electron de trading. Siga as instruções em `CLAUDE.md`.

**Branch atual:** `feature/trailing-stop-backtest-simulation`

## O Que Foi Concluído

### 1. Trailing Stop Optimization (82,944 combinações testadas)
- **Melhores params LONG:** Activation 90%, Distance 40%, ATR 1.5, BE 0.5%
- **Melhores params SHORT:** Activation 80%, Distance 30%, ATR 1.5-3.0, BE 0.5-1.5%
- **Resultado:** +$428.68 (+42.9%), Win Rate 37.6%, Sharpe 0.535

### 2. Comparação de Timeframes (8 testados)
- **Único lucrativo:** 12h (+11.75% em 3 anos)
- **Insight:** LONGs sempre melhores que SHORTs
- **Decisão:** Focar otimização no 12h, considerar LONG-only

### 3. Market Indicators Sidebar COMPLETA
- Gráficos históricos (31d) para todos indicadores
- Componentes reutilizáveis: `MiniAreaChart`, `MiniLineChart`
- Tooltips padronizados com datas
- Caching otimizado (refresh 5-30min)
- Layout padronizado: badges abaixo dos títulos

### 4. Entry Levels & R:R Optimization Script IMPLEMENTADO
- **Script:** `apps/backend/src/cli/optimize-entry-levels.ts`
- **Quick-test (12 combinações):** Entry 100% (breakout) é 7.7x melhor que 61.8% atual
- **Resultado:** +$2,572 (+257%) vs $335 (+33.5%) com Entry 61.8%
- **LONGs dominam:** +$18,260 vs SHORTs: -$855

**Melhor configuração encontrada:**
```json
{
  "maxFibonacciEntryProgressPercent": 100,
  "minRiskRewardRatioLong": 0.75,
  "minRiskRewardRatioShort": 0.75
}
```

## Próximos Passos

### Prioridade 1: Entry Levels FULL Optimization (12h)
```bash
# Rodar otimização completa (180 combinações)
cd apps/backend
pnpm tsx src/cli/optimize-entry-levels.ts --mode=full

# Ou testar LONG-only
pnpm tsx src/cli/optimize-entry-levels.ts --mode=full --long-only
```

### Prioridade 2: Walk-Forward Validation
Validar as configs com dados out-of-sample (70/30 split).

### Prioridade 3: Trend Filter Optimization (Seção 14)
```bash
# Métodos a testar:
- EMA simples (período único)
- Combinado (EMA + MACD + RSI)
- ADX (força de tendência)

# Períodos a testar:
- EMA9, EMA21, EMA50, EMA200
```

### Prioridade 4: Aplicar Defaults Ótimos (Seção 15)
Aplicar as melhores configs encontradas como defaults do sistema.

## Arquivos Importantes

```
docs/OPTIMIZATION_MASTER_PLAN.md     # Plano completo atualizado
apps/backend/src/cli/                # Scripts de otimização
├── optimize-entry-levels.ts         # ✅ NOVO - Entry Levels & R:R
├── optimize-trailing-stop.ts        # Trailing Stop
├── compare-timeframes.ts            # Comparação de timeframes
apps/backend/src/services/backtesting/
├── MultiWatcherBacktestEngine.ts    # Engine principal (atualizado)
├── WalkForwardOptimizer.ts          # Walk-forward validation
└── MonteCarloSimulator.ts           # Monte Carlo simulation
```

## Regra Obrigatória

**SEMPRE** rodar teste rápido antes de otimização completa:
```bash
cd apps/backend
pnpm tsx src/cli/[script].ts --quick-test --verbose
```

## Tarefa

Rodar a otimização FULL de Entry Levels com `--mode=full` e `--long-only` para confirmar os resultados do quick-test e validar se LONG-only melhora os resultados.
