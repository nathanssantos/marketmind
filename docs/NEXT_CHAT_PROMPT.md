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

## Próximos Passos (Seção 13-14 do Plano)

### Prioridade 1: Entry Levels Optimization (12h)
```bash
# Localização do script a criar/modificar:
apps/backend/src/cli/optimize-entry-levels.ts

# Parâmetros a testar:
- Fibonacci entry levels: 0%, 38.2%, 50%, 61.8%, 78.6%, 100% (breakout)
- R:R mínimo: 0.5, 0.75, 1.0, 1.5, 2.0
- Trailing activation para breakout: 0% (imediato), 30%, 50%, 70%
```

### Prioridade 2: LONG-only Backtest
Confirmar se remover SHORTs melhora os resultados no 12h.

### Prioridade 3: Walk-Forward Validation
Validar as configs com dados out-of-sample (70/30 split).

### Prioridade 4: Trend Filter Optimization (Seção 14)
```bash
# Métodos a testar:
- EMA simples (período único)
- Combinado (EMA + MACD + RSI)
- ADX (força de tendência)

# Períodos a testar:
- EMA9, EMA21, EMA50, EMA200
```

## Arquivos Importantes

```
docs/OPTIMIZATION_MASTER_PLAN.md     # Plano completo (leia a Seção 13-14)
apps/backend/src/cli/                # Scripts de otimização
apps/backend/src/services/backtesting/
├── MultiWatcherBacktestEngine.ts    # Engine principal
├── WalkForwardOptimizer.ts          # Walk-forward validation
├── MonteCarloSimulator.ts           # Monte Carlo simulation
└── trailing-stop-backtest.ts        # GranularPriceIndex
```

## Regra Obrigatória

**SEMPRE** rodar teste rápido antes de otimização completa:
```bash
pnpm tsx src/cli/[script].ts --quick-test --verbose
```

## Tarefa

Leia a Seção 13 (Entry Levels & R:R) do `OPTIMIZATION_MASTER_PLAN.md` e implemente o script de otimização para testar os diferentes níveis de entrada Fibonacci e R:R mínimo no timeframe de 12h.
