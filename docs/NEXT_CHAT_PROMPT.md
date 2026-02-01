# Prompt para Continuar o Plano de Otimização

## Contexto

Estou trabalhando no MarketMind, um app Electron de trading. Siga as instruções em `CLAUDE.md`.

**Branch atual:** `feature/trailing-stop-backtest-simulation`

## O Que Foi Concluído (100% Core)

### 1. Trailing Stop Optimization (82,944 combinações testadas)
- **Melhores params LONG:** Activation 90%, Distance 40%, ATR 1.5, BE 0.5%
- **Melhores params SHORT:** Activation 80%, Distance 30%, ATR 1.5-3.0, BE 0.5-1.5%
- **Resultado:** +$428.68 (+42.9%), Win Rate 37.6%, Sharpe 0.535

### 2. Comparação de Timeframes v2 (21 estratégias, 485 min)
- **7/8 timeframes lucrativos** (vs apenas 1/8 na v1)
- **12h é o melhor:** +$6,038 (+603.8%), PF 2.30, MaxDD 21%
- **4h alternativa:** +$2,065 (+206.5%), MaxDD 20.5% (menor DD)
- **Apenas 12h e 4h têm SHORT lucrativo**
- **30m único negativo:** -$663 (overtrading)

### 3. Entry Levels & R:R Optimization
- **Entry 100% (breakout) é 7.7x melhor** que 61.8%
- **LONGs dominam:** +$180,604 vs SHORTs: -$3,139

### 4. BTC Correlation Filter
- **5.6x mais lucrativo** com filtro ($4,643 vs $830)
- **Drawdown reduzido** em 17% (24.8% vs 41.8%)

### 5. Monte Carlo Validation
- **100% probabilidade lucrativa** (1000 simulações)
- **CI95 Drawdown:** 27.1% (abaixo do limite 50%)
- **Retorno mediano:** +490.4%

### 6. Market Indicators Sidebar COMPLETA
- Fear & Greed, BTC Dominance, OI, L/S Ratio
- Gráficos históricos 31d com tooltips

### 7. Trailing Stop UI
- Separação LONG/SHORT implementada
- Toggle `useProfitLockDistance` adicionado

## Configuração Final Otimizada

```json
{
  "timeframe": "12h",
  "maxFibonacciEntryProgressPercent": 100,
  "minRiskRewardRatioLong": 0.75,
  "minRiskRewardRatioShort": 0.75,
  "trailingActivationPercentLong": 0.9,
  "trailingDistancePercentLong": 0.4,
  "trailingActivationPercentShort": 0.8,
  "trailingDistancePercentShort": 0.3,
  "useBtcCorrelationFilter": true,
  "useVolumeFilter": true,
  "useMomentumTimingFilter": true
}
```

## Fase Atual: Auditoria e Documentação

### Em Progresso
1. **Documentação Frontend:** Listar componentes, hooks, stores
2. **Documentação Backend:** Listar routers, services, CLI scripts
3. **Limpeza:** Remover docs obsoletos

### Futuro (Baixa Prioridade)
- **Rotation Melhorias:** Setup Pre-Scanner, Filter Pre-Validator
- **Order Book Integration:** Imbalance, Liquidity Walls

## Arquivos Importantes

```
docs/OPTIMIZATION_MASTER_PLAN.md     # Plano completo atualizado
apps/backend/src/cli/                # Scripts de otimização
├── optimize-trailing-stop.ts        # Trailing Stop (82,944 combos)
├── compare-timeframes-v2.ts         # Timeframes v2 (21 estratégias)
├── optimize-entry-levels.ts         # Entry Levels & R:R
├── compare-btc-filter.ts            # BTC Correlation
├── compare-trend-filters.ts         # Trend Filters
└── validate-robustness.ts           # Monte Carlo validation
```

## Métricas do Sistema

| Métrica | Valor |
|---------|-------|
| Testes | 2,419 passing |
| Test Files | 111 |
| Code Coverage | 92.15% |

## Tarefa

Continuar a fase de Auditoria e Documentação conforme definido no OPTIMIZATION_MASTER_PLAN.md seção 12.
