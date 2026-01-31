# Sistema de Otimização de Trailing Stop

Este é o **sistema principal de otimização** do MarketMind para encontrar os melhores parâmetros de trailing stop.

## Visão Geral

O sistema testa combinações de parâmetros de trailing stop para LONG e SHORT de forma independente, usando dados históricos granulares (5m) para simular o comportamento real do trailing stop.

## Uso Básico

```bash
# Modo rápido (25 combinações, validação)
pnpm tsx src/cli/optimize-trailing-stop.ts --quick-test

# Modo médio (82,944 combinações, recomendado)
pnpm tsx src/cli/optimize-trailing-stop.ts --mode=medium

# Modo completo (milhões de combinações, demorado)
pnpm tsx src/cli/optimize-trailing-stop.ts --mode=full
```

## Parâmetros CLI

| Parâmetro | Default | Descrição |
|-----------|---------|-----------|
| `--symbol` | BTCUSDT | Par de trading |
| `--start` | 2023-01-01 | Data inicial |
| `--end` | 2026-01-31 | Data final |
| `--mode` | medium | Modo: quick, medium, full |
| `--quick-test` | false | Alias para --mode=quick |
| `--top-n` | 20 | Quantidade de melhores resultados |
| `--verbose` | false | Log detalhado |

## Modos de Otimização

### Quick (Validação)
- **Combinações:** 25
- **Tempo:** ~1 minuto
- **Uso:** Validar que o sistema funciona

### Medium (Recomendado)
- **Combinações:** 82,944 (288 × 288)
- **Tempo:** ~80 minutos (3 anos)
- **Parâmetros:**
  - Activation: 70-120% (step 10)
  - Distance: 20-50% (step 10)
  - ATR Multiplier: 1.5-3.0 (step 0.5)
  - Breakeven: 0.5-1.5% (step 0.5)

### Full (Extensivo)
- **Combinações:** 25M+
- **Tempo:** ~20+ horas
- **Uso:** Busca exaustiva

## Parâmetros Otimizados

### Por Direção (LONG/SHORT independentes)

| Parâmetro | Descrição | Range |
|-----------|-----------|-------|
| `activationPercent` | % do TP para ativar trailing | 50-150% |
| `distancePercent` | Distância do trailing após ativação | 10-60% |
| `atrMultiplier` | Multiplicador ATR para cálculo | 1.0-4.0 |
| `breakevenProfitThreshold` | Threshold para mover SL para breakeven | 0.5-3.0% |

## Métricas de Score

O sistema usa um score composto para rankear combinações:

```
Score = PnL × 0.4 + Sharpe × 1000 × 0.4 - MaxDD × 10000 × 0.2
```

- **PnL (40%):** Lucro/prejuízo total
- **Sharpe (40%):** Retorno ajustado ao risco
- **Max Drawdown (20%):** Penalidade por drawdown alto

## Output

O sistema gera:
1. **Top N resultados** com configs completas
2. **JSON da melhor config** pronto para copiar
3. **Estatísticas de trailing:** ativações e exits

## Arquivos Relacionados

```
apps/backend/src/
├── cli/
│   ├── optimize-trailing-stop.ts    # CLI principal
│   ├── validate-trailing-backtest.ts # Validação
│   └── shared-backtest-config.ts    # Config compartilhada
└── services/backtesting/trailing-stop-backtest/
    ├── index.ts                     # Exports
    ├── types.ts                     # Tipos
    ├── SafeLogger.ts               # Controle de output
    ├── GranularPriceIndex.ts       # Índice de preços 5m
    └── TrailingStopSimulator.ts    # Simulador core
```

## Performance

| Dados | Combinações | Tempo Estimado |
|-------|-------------|----------------|
| 1 mês | 82,944 | ~20 min |
| 6 meses | 82,944 | ~40 min |
| 3 anos | 82,944 | ~80 min |

### Otimizações Futuras
- [ ] Paralelização com worker threads
- [ ] Cache de indicadores calculados
- [ ] Early exit para combinações ruins
- [ ] Streaming de klines (reduzir memória)

## Exemplo de Resultado

```json
{
  "trailingStopEnabled": true,
  "useAdaptiveTrailing": true,
  "long": {
    "activationPercent": 80,
    "distancePercent": 40,
    "atrMultiplier": 1.5,
    "breakevenProfitThreshold": 0.5
  },
  "short": {
    "activationPercent": 80,
    "distancePercent": 30,
    "atrMultiplier": 1.5,
    "breakevenProfitThreshold": 0.5
  }
}
```

## Teste das 106 Estratégias

O sistema possui **106 estratégias** em `strategies/builtin/*.json`. Após encontrar a config ótima de trailing stop:

### Workflow

```
1. Otimização Trailing Stop (atual)
   └── Encontrar melhor config LONG/SHORT

2. Screening de Estratégias
   └── Testar todas 106 com config ótima
   └── Filtrar: PnL > 0, Trades > 50, WinRate > 40%
   └── Resultado: ~30 estratégias

3. Ranking
   └── Score = PnL×0.3 + Sharpe×0.4 + (1-DD)×0.3
   └── Validar com Walk-Forward
   └── Resultado: Top 15 estratégias

4. Otimização Individual
   └── Otimizar params específicos de cada estratégia
   └── Testar combinações de filtros
   └── Validar com Monte Carlo
```

### CLI (TODO)

```bash
# Testar todas as estratégias
pnpm tsx src/cli/test-all-strategies.ts \
  --symbol BTCUSDT \
  --interval 2h \
  --start 2023-01-01 \
  --end 2026-01-31

# Otimizar estratégia específica
pnpm tsx src/cli/optimize-strategy.ts \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT
```

### Categorias

| Categoria | Exemplos | ~Qtd |
|-----------|----------|------|
| Larry Williams | 9.1, 9.2, 9.3, 9.4 | 4 |
| Momentum | momentum-breakout-2025 | 15 |
| Mean Reversion | rsi-oversold-bounce | 12 |
| Trend Following | ema-crossover, supertrend | 20 |
| Breakout | range-breakout, keltner | 15 |
| Pattern | engulfing, three-bar | 10 |
| Divergence | rsi-divergence, macd | 8 |
| Volume/Order Flow | whale-accumulation | 10 |
| Outros | scalping, grid-trading | 12 |

---

## Próximos Passos

1. ✅ Otimização trailing stop (em execução)
2. [ ] Testar 106 estratégias com config ótima
3. [ ] Eleger top 15-20 estratégias
4. [ ] Otimizar estratégias eleitas individualmente
5. [ ] Aplicar melhor config como default do sistema
