# Guia de Otimização de Estratégias - MarketMind

## Resumo Executivo

Este documento contém as instruções para otimizar as 8 estratégias de trading usando a CLI de backtesting do MarketMind.

---

## Estratégias Disponíveis

| Estratégia | Nome CLI | Tipo |
|------------|----------|------|
| Setup 9.1 | `setup91` | EMA9 Reversals |
| Setup 9.2 | `setup92` | EMA9 Pullback |
| Setup 9.3 | `setup93` | EMA9 Double Pullback |
| Setup 9.4 | `setup94` | EMA9 Continuation |
| Pattern 1-2-3 | `pattern123` | Classical Swing Pattern |
| Bull Trap | `bullTrap` | Reversal SHORT |
| Bear Trap | `bearTrap` | Reversal LONG |
| Breakout Retest | `breakoutRetest` | Momentum + Retest |

---

## Exemplos de Parâmetros Otimizáveis

### Pattern 123
- `pivotLookback`: Período para identificar pivots (default: 5)
- `targetMultiplier`: Multiplicador do alvo (default: 2.0)
- `breakoutThreshold`: Threshold de breakout (default: 0.002)

### Setup 9.3
- `emaPeriod`: Período da EMA (default: 9)
- `atrPeriod`: Período do ATR (default: 12)
- `atrStopMultiplier`: Multiplicador do stop (default: 2)
- `atrTargetMultiplier`: Multiplicador do alvo (default: 4)
- `volumeMultiplier`: Multiplicador de volume (default: 1.0)

### Breakout Retest
- `lookbackPeriod`: Período de lookback (default: 30)
- `volumeMultiplier`: Multiplicador de volume (default: 1.4)
- `emaPeriod`: Período da EMA (default: 20)
- `retestTolerance`: Tolerância do retest (default: 0.005)

---

## Comandos de Otimização

### Diretório de trabalho
```bash
cd /Users/nathan/Documents/dev/marketmind/apps/backend
```

### Pattern 123 - Otimização Completa (1 ano)
```bash
npm run backtest:optimize -- \
  --strategy pattern123 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param pivotLookback=3,4,5,6,7 \
  --param targetMultiplier=1.5,2.0,2.5,3.0 \
  --param breakoutThreshold=0.001,0.002,0.003 \
  --max-position 10 \
  --commission 0.1 \
  --use-algorithmic-levels \
  --parallel 4 \
  --top 10
```

### Setup 9.3 - Otimização Completa (1 ano)
```bash
npm run backtest:optimize -- \
  --strategy setup93 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param emaPeriod=5,7,9,12,15,20 \
  --param atrPeriod=10,12,14,16,20 \
  --param atrTargetMultiplier=3,4,5,6 \
  --max-position 10 \
  --commission 0.1 \
  --use-algorithmic-levels \
  --parallel 4 \
  --top 10
```

### Breakout Retest - Otimização Completa (1 ano)
```bash
npm run backtest:optimize -- \
  --strategy breakoutRetest \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param lookbackPeriod=20,25,30,35,40 \
  --param volumeMultiplier=1.0,1.2,1.4,1.6 \
  --param emaPeriod=15,20,25 \
  --max-position 10 \
  --commission 0.1 \
  --use-algorithmic-levels \
  --parallel 4 \
  --top 10
```

---

## Resultados da Otimização Completa (Jan-Dez 2024)

### Resumo Geral

| Estratégia | Win Rate | PnL % | Profit Factor | Sharpe | Max DD | Status |
|-----------|----------|-------|---------------|--------|--------|--------|
| **Pattern 123** | 43.72% | +642.91% | 5.91 | 2.84 | 5.50% | **Excelente** |
| **Setup 9.3** | 18.34% | +4.45% | 1.09 | 0.49 | 13.19% | Marginal |
| **Breakout Retest** | 29.41% | -5.53% | 0.88 | -0.76 | 11.98% | Negativo |

---

### Pattern 123 - Resultados Detalhados

**Melhor Configuração:**
| Parâmetro | Valor |
|-----------|-------|
| `pivotLookback` | 6 |
| `targetMultiplier` | 1.5 |
| `breakoutThreshold` | 0.001 |

**Métricas:**
- **Trades**: 1759
- **Win Rate**: 43.72%
- **PnL Total**: +6429.12 USDT (+642.91%)
- **Profit Factor**: 5.91
- **Sharpe Ratio**: 2.84
- **Max Drawdown**: 417.31 USDT (5.50%)
- **Avg Win**: $10.06 | **Avg Loss**: $1.32
- **Maior Ganho**: $133.83 | **Maior Perda**: -$26.28

**Top 3 Configurações:**
1. `pivotLookback=7, targetMultiplier=1.5` → PnL: +662.31%, Sharpe: 2.88
2. `pivotLookback=6, targetMultiplier=1.5` → PnL: +642.91%, Sharpe: 2.84
3. `pivotLookback=4, targetMultiplier=1.5` → PnL: +621.77%, Sharpe: 2.77

---

### Setup 9.3 - Resultados Detalhados

**Melhor Configuração:**
| Parâmetro | Valor |
|-----------|-------|
| `emaPeriod` | 12 |
| `atrPeriod` | 16 |
| `atrTargetMultiplier` | 4 |

**Métricas:**
- **Trades**: 469
- **Win Rate**: 18.34%
- **PnL Total**: +44.54 USDT (+4.45%)
- **Profit Factor**: 1.09
- **Sharpe Ratio**: 0.49
- **Max Drawdown**: 139.60 USDT (13.19%)
- **Avg Win**: $6.16 | **Avg Loss**: $1.27
- **Maior Ganho**: $13.14 | **Maior Perda**: -$5.34

**Observações:**
- Estratégia com resultados marginais
- Win rate baixo (~18%) compensado parcialmente pelo R:R
- Drawdown elevado (>13%) para o retorno obtido
- **Recomendação**: Considerar filtros adicionais ou descartar

---

### Breakout Retest - Resultados Detalhados

**Melhor Configuração:**
| Parâmetro | Valor |
|-----------|-------|
| `lookbackPeriod` | 20 |
| `volumeMultiplier` | 1.0-1.6 (sem impacto) |
| `emaPeriod` | 15-25 (sem impacto) |

**Métricas:**
- **Trades**: 238
- **Win Rate**: 29.41%
- **PnL Total**: -55.29 USDT (-5.53%)
- **Profit Factor**: 0.88
- **Sharpe Ratio**: -0.76
- **Max Drawdown**: 124.47 USDT (11.98%)

**Observações:**
- **Estratégia não lucrativa** em nenhuma configuração testada
- volumeMultiplier e emaPeriod não afetam os resultados (possível bug na implementação)
- lookbackPeriod maior (35-40) piora significativamente os resultados
- **Recomendação**: Revisar implementação ou descartar estratégia

---

## Comandos CLI Disponíveis

```bash
# Otimização de parâmetros
npm run backtest:optimize

# Validação de estratégia
npm run backtest:validate

# Walk-forward analysis
npm run backtest:walkforward

# Monte Carlo simulation
npm run backtest:montecarlo

# Análise de sensibilidade
npm run backtest:sensitivity

# Comparar resultados
npm run backtest:compare

# Exportar resultados
npm run backtest:export
```

---

## Opções da CLI de Otimização

```
--strategy <type>       Estratégia (setup93, pattern123, breakoutRetest)
--symbol <symbol>       Par de trading (BTCUSDT, ETHUSDT, SOLUSDT)
--interval <interval>   Timeframe (1h, 4h, 1d)
--start <date>          Data início (YYYY-MM-DD)
--end <date>            Data fim (YYYY-MM-DD)
--capital <amount>      Capital inicial (default: 1000)
--param <param>         Parâmetro a otimizar (nome=val1,val2,val3)
--max-position <pct>    Tamanho máximo posição % (default: 10)
--commission <pct>      Comissão % (default: 0.1)
--use-algorithmic-levels  Usar SL/TP calculados pela estratégia
--only-with-trend       Só operar a favor da EMA200
--parallel <n>          Workers paralelos (default: 4)
--top <n>               Mostrar top N resultados (default: 10)
--sort-by <metric>      Ordenar por métrica
--min-win-rate <pct>    Filtrar por win rate mínimo
--min-profit-factor <v> Filtrar por profit factor mínimo
--verbose               Logs detalhados
```

---

## Arquivos de Resultados

Os resultados são salvos em:
```
apps/backend/results/optimizations/
```

Formato: `{strategy}_{symbol}_{interval}_{timestamp}.json`

---

## Próximos Passos

1. ~~Executar otimização completa de 1 ano para cada estratégia~~ ✅ **Concluído**
2. Validar melhores configurações com walk-forward analysis
3. Executar Monte Carlo para análise de risco
4. Comparar resultados entre estratégias
5. Implementar configurações otimizadas no sistema (Pattern 123 apenas)

---

## Conclusões e Recomendações

### Estratégias Recomendadas para Uso

| Estratégia | Recomendação | Justificativa |
|-----------|--------------|---------------|
| **Pattern 123** | **Usar** | Excelentes métricas: PnL +642%, PF 5.91, Sharpe 2.84, DD 5.5% |
| **Setup 9.3** | Revisar/Testar mais | Marginalmente lucrativo, precisa de melhorias |
| **Breakout Retest** | **Não usar** | Não lucrativo, possível bug na implementação |

### Configuração Recomendada - Pattern 123

```json
{
  "pattern123": {
    "enabled": true,
    "pivotLookback": 6,
    "targetMultiplier": 1.5,
    "breakoutThreshold": 0.001
  }
}
```

### Alertas

⚠️ **Breakout Retest**: Os parâmetros `volumeMultiplier` e `emaPeriod` não parecem afetar os resultados do backtesting. Isso pode indicar um bug na implementação do detector ou na forma como os parâmetros são passados para a estratégia.

---

## Notas Importantes

- O período de 1 ano (2024-01-01 a 2024-12-01) é recomendado para resultados robustos
- Timeframe 4h oferece bom equilíbrio entre sinais e ruído
- Usar `--use-algorithmic-levels` para SL/TP dinâmicos calculados pela estratégia
- A opção `--only-with-trend` filtra setups contra a EMA200 (ativada por padrão)
- Aumentar `--parallel` pode acelerar, mas consome mais recursos
