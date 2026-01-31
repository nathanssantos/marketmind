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

## Próximos Passos

1. Integrar com MultiWatcherBacktestEngine (setups reais)
2. Adicionar otimização de filtros
3. Adicionar otimização de Fibonacci targets
4. Aplicar melhor config como default do sistema
