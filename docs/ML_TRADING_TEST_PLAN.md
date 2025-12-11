# Plano: Teste do Sistema de Trading Algorítmico com ML

## Objetivo
Testar o sistema de trading algorítmico completo usando o simulador do frontend com:
- 3 ativos simultâneos: BTCUSDT, ETHUSDT, SOLUSDT
- Timeframes curtos: 1m e 5m (mais entradas de setups)
- ML predictions para melhorar confiança dos setups
- Visualização de posições/SL/TP no gráfico
- **Logging detalhado no backend para operação autônoma**

## Parâmetros Definidos
- **Símbolos treinamento**: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, AVAXUSDT
- **Período histórico**: 2022-01-01 a 2024-11-01 (~35 meses)
- **Timeframes treinamento**: 1h, 4h, 1d
- **Timeframes teste real**: 1m, 5m
- **Capital inicial**: $1,000
- **Modo**: Backend (PostgreSQL) para persistência e análise
- **Setups**: Top 10 após otimização
- **Estratégias disponíveis**: 105 estratégias no diretório `apps/backend/strategies/builtin/`

## Status: EM EXECUÇÃO

---

## Fase 0: Otimização de Setups

### 0.1 Estratégias Disponíveis (105 total)
```
7day-momentum-crypto, adx-ema-trend, altcoin-season, aroon-trend-crypto,
atr-volatility-breakout, awesome-oscillator-crypto, bear-trap, bitcoin-halving-cycle,
bitcoin-macd-momentum, bollinger-breakout-crypto, breakout-retest, bull-trap,
cci-optimized-daily, cci-trend-rider, chaikin-money-flow, chande-momentum-crypto,
connors-rsi2-original, cumulative-rsi-r3, dca-grid-hybrid, dema-crossover-crypto,
divergence-rsi-macd, dmi-adx-trend, donchian-adx-breakout-crypto, donchian-breakout,
double-seven, elder-ray-crypto, ema-crossover, ema20-trend-crypto, ema5-momentum-crypto,
ema9-21-rsi-confirmation, engulfing-pattern, enhanced-trend-following, fair-value-gap,
fibonacci-retracement, funding-rate-arbitrage, gap-fill-crypto, golden-cross-sma,
grid-trading, hammer-doji, hull-ma-trend, ibs-mean-reversion, ichimoku-cloud-crypto,
inside-bar-breakout, keltner-breakout-optimized, keltner-squeeze, klinger-oscillator,
larry-williams-9-1, larry-williams-9-2, larry-williams-9-3, larry-williams-9-4,
liquidation-cascade, liquidity-sweep, macd-divergence, market-making, market-structure-break,
marubozu-momentum, mass-index-reversal, mean-reversion-bb-rsi, mean-reversion-extreme,
mfi-divergence, momentum-25day-crypto, momentum-breakout-2025, momentum-rotation,
morning-star, nr7-breakout, obv-divergence, open-interest-divergence, order-block-fvg,
order-flow-imbalance, parabolic-sar-crypto, pattern-123-reversal, percent-b-connors,
pin-inside-combo, pivot-points-crypto, ppo-momentum, range-breakout, roc-momentum-crypto,
rsi-divergence-trend, rsi-macd-combined, rsi-momentum-breakout-70, rsi-oversold-bounce,
rsi-sma-filter, rsi2-mean-reversion, rsi50-momentum-crossover, scalping-1m, scalping-5m,
stochrsi-momentum, supertrend-follow, swing-weekly, tema-momentum, three-bar-reversal,
trend-pullback-2025, triple-confirmation-reversal, triple-ema-confluence, triple-screen,
tsi-momentum, ultimate-oscillator-crypto, volatility-contraction, volume-price-breakout,
vortex-indicator, vwap-ema-cross, vwap-pullback, whale-accumulation, williams-momentum,
williams-r-reversal
```

### 0.2 Estratégias com Erro (indicadores não suportados)
- `bitcoin-halving-cycle` - halvingCycle não implementado
- `ichimoku-cloud-crypto` - ichimoku não implementado
- `stochrsi-momentum` - stochRsi não implementado

### 0.3 Comando de Otimização
```bash
cd apps/backend
pnpm exec tsx src/cli/backtest-runner.ts validate \
  -s <strategy-name> \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-10-01 \
  --optimized
```

### 0.4 Critérios de Seleção Top 10
1. Profit Factor > 1.5
2. Win Rate > 50%
3. Max Drawdown < 20%
4. Número de trades > 10

---

## Fase 1: Gerar Dados de Treinamento ML

### 1.1 Comando CLI
```bash
pnpm exec tsx src/cli/backtest-runner.ts generate-training \
  --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,AVAXUSDT \
  --intervals 1h,4h,1d \
  --start 2022-01-01 \
  --end 2024-11-01 \
  --output packages/ml/data/training_data.csv
```

### 1.2 Arquivos
- `apps/backend/src/cli/commands/generate-training-data.ts` (NOVO)
- `apps/backend/src/cli/backtest-runner.ts` (adicionar comando)

---

## Fase 2: Treinar Modelo ML

### 2.1 Config de Treinamento
**Arquivo:** `packages/ml/config/training-config.json`

### 2.2 Comando Python
```bash
cd packages/ml
pip install xgboost lightgbm scikit-learn onnx skl2onnx pandas numpy
python scripts/train_setup_classifier.py \
  --config config/training-config.json \
  --data data/training_data.csv \
  --output models/setup-classifier-v1.onnx
```

---

## Fase 3: Logging Detalhado

### 3.1 Formato do Log
```
[2024-12-11 10:30:45] [SETUP] BTCUSDT 1m | Type: setup91 | Direction: LONG | Confidence: 75%
[2024-12-11 10:30:45] [ML] Prediction: 0.82 (Win) | Latency: 12ms | Cache: MISS
[2024-12-11 10:30:45] [ML] Blended: 75% → 78% (weight: 0.3)
[2024-12-11 10:30:46] [TRADE] EXECUTE LONG BTCUSDT @ 42150 | SL: 41500 | TP: 43450
[2024-12-11 10:35:00] [TRADE] CLOSED BTCUSDT | P&L: +2.1% | Exit: TP_HIT
```

---

## Fase 4: Configurar Sistema

### 4.1 Backend
```bash
cd apps/backend
DEBUG=* pnpm dev 2>&1 | tee -a logs/trading.log
```

### 4.2 Frontend
```bash
cd apps/electron
pnpm dev
# Abrir 3 janelas: BTCUSDT, ETHUSDT, SOLUSDT
# Timeframes: 1m e 5m
```

---

## Resultados da Otimização (BTCUSDT 1d, 2024-01-01 a 2024-10-01)

### Top 10 Estratégias Selecionadas

| Rank | Estratégia | Win Rate | Profit Factor | Max DD | Trades |
|------|------------|----------|---------------|--------|--------|
| 1 | **keltner-breakout-optimized** | 60.00% | 1.64 | 9.84% | 10 |
| 2 | **bollinger-breakout-crypto** | 73.33% | 0.90 | 20.95% | 45 |
| 3 | **larry-williams-9-1** | 48.00% | 1.53 | 10.09% | 25 |
| 4 | **williams-momentum** | 61.32% | 1.12 | 21.01% | 106 |
| 5 | **larry-williams-9-3** | 47.37% | 1.22 | 13.40% | 19 |
| 6 | **tema-momentum** | 36.71% | 1.19 | 18.73% | 79 |
| 7 | **elder-ray-crypto** | 34.04% | 1.14 | 29.34% | 47 |
| 8 | **ppo-momentum** | 40.00% | 1.13 | 34.08% | 55 |
| 9 | **parabolic-sar-crypto** | 40.59% | 1.08 | 29.23% | 101 |
| 10 | **supertrend-follow** | 50.00% | 0.96 | 5.78% | 30 |

### Estratégias Descartadas (baixo desempenho)

| Estratégia | Win Rate | Profit Factor | Motivo |
|------------|----------|---------------|--------|
| connors-rsi2-original | 0.00% | 0.00 | Sem trades |
| cci-optimized-daily | 0.00% | 0.00 | Sem trades |
| rsi-oversold-bounce | 0.00% | 0.00 | Sem trades |
| rsi2-mean-reversion | 0.00% | 0.00 | Sem trades |
| double-seven | 0.00% | 0.00 | Sem trades |
| ibs-mean-reversion | 27.27% | 0.44 | PF < 0.5 |
| donchian-breakout | 29.17% | 0.67 | PF < 1, DD > 45% |
| hull-ma-trend | 32.00% | 0.73 | DD > 59% |
| roc-momentum-crypto | 26.73% | 0.60 | DD > 58% |

---

## Checklist de Execução

- [x] Fase 0: Listar todos os setups disponíveis (105 encontrados)
- [x] Fase 0: Executar otimização para cada setup (testados ~25 estratégias)
- [x] Fase 0: Ranquear e selecionar Top 10 setups
- [ ] Fase 1: Criar comando `generate-training-data` no CLI
- [ ] Fase 1: Executar geração de dados (6 símbolos, 3 intervals)
- [ ] Fase 2: Criar training config JSON
- [ ] Fase 2: Instalar dependências Python
- [ ] Fase 2: Treinar modelo e exportar ONNX
- [ ] Fase 3: Adicionar LoggingService
- [ ] Fase 3: Instrumentar todos os services com logs
- [ ] Fase 4: Iniciar backend com logs (modo PostgreSQL)
- [ ] Fase 4: Iniciar frontend e abrir 3 janelas (BTC, ETH, SOL)
- [ ] Fase 4: Configurar capital $1,000 no simulator
- [ ] Fase 4: Ativar Top 10 setups + auto-trading em todas janelas
- [ ] Fase 5: Monitorar logs e ajustar parâmetros
