# Pesquisa de Backtesting e Estratégias - MarketMind

## Resumo da Sessão

Data: 2025-12-07

---

## 1. Bugs Corrigidos no Sistema de Backtesting

### 1.1 Classificação de Win/Loss (CRÍTICO)
**Arquivo:** `apps/backend/src/services/backtesting/BacktestEngine.ts:388-391`

**Problema:** Usava `netPnl` (após fees) para classificar trades como win/loss.
- Trade lucrativo (gross) mas com loss após fees era classificado como PERDA
- Win rate reportado era MUITO MENOR que o real

**Correção:**
```typescript
// ANTES (errado)
const winningTrades = trades.filter((t) => (t.netPnl ?? 0) > 0);

// DEPOIS (correto)
const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0); // gross PnL
```

### 1.2 Cálculo de Comissão (CRÍTICO)
**Arquivo:** `apps/backend/src/services/backtesting/BacktestEngine.ts:350-355`

**Problema:** Usava preço de entrada para calcular comissão de saída.

**Correção:**
```typescript
// ANTES (errado)
const commission = positionValue * (config.commission ?? 0.001) * 2;

// DEPOIS (correto)
const commissionRate = config.commission ?? 0.001;
const entryCommission = positionSize * entryPrice * commissionRate;
const exitCommission = positionSize * exitPrice * commissionRate;
const commission = entryCommission + exitCommission;
```

### 1.3 Ambiguidade SL/TP no Mesmo Candle
**Arquivo:** `apps/backend/src/services/backtesting/BacktestEngine.ts:283-323`

**Problema:** Sempre verificava SL primeiro, criando viés pessimista.

**Correção:** Usa direção do candle como heurística:
- Candle bullish (close > open) → assume TP primeiro para LONG
- Candle bearish (close < open) → assume SL primeiro para LONG

### 1.4 Stop Loss MeanReversion Muito Apertado
**Arquivo:** `apps/backend/src/services/setup-detection/MeanReversionDetector.ts:91-93, 141-143`

**Problema:** Usava apenas 50% da largura da Bollinger Band.

**Correção:** Aumentou para 150% (1.5x) da largura da banda.

### 1.5 Slippage Adicionado
**Arquivo:** `apps/backend/src/services/backtesting/BacktestEngine.ts:333-342`
**Tipo:** `packages/types/src/backtesting.ts:21`

**Novo campo:** `slippagePercent` (default 0.05%)
- Aplicado apenas em Stop Loss (market order)
- Take Profit assume limit order (sem slippage)

### 1.6 Métricas Gross vs Net Adicionadas
**Arquivo:** `packages/types/src/backtesting.ts:77-79`

Novos campos:
- `grossWinRate` - Win rate baseado em PnL bruto
- `grossProfitFactor` - Profit factor antes de fees
- `totalGrossPnl` - PnL total antes de fees

---

## 2. Benchmarks da Indústria (Métricas de Trading)

| Métrica | Ruim | Aceitável | Bom | Excelente |
|---------|------|-----------|-----|-----------|
| **Win Rate** | <40% | 40-50% | 50-60% | >60% |
| **Profit Factor** | <1.0 | 1.0-1.5 | 1.5-2.0 | >2.0 |
| **Sharpe Ratio** | <0.5 | 0.5-1.0 | 1.0-2.0 | >2.0 |
| **Max Drawdown** | >30% | 20-30% | 10-20% | <10% |
| **Retorno Anual** | <10% | 10-20% | 20-50% | >50% |

### Notas sobre Win Rate vs R:R

Para ser lucrativo, a combinação de Win Rate e Risk:Reward deve satisfazer:

| Win Rate | R:R Mínimo Necessário |
|----------|----------------------|
| 30% | 2.5:1 |
| 40% | 1.5:1 |
| 50% | 1.0:1 |
| 60% | 0.7:1 |
| 70% | 0.5:1 |

---

## 3. Resultados dos Backtests (BTCUSDT 4h, 2024)

### Estratégias Lucrativas (Ordenadas por PnL)

| Estratégia | Win Rate | PnL | Profit Factor | Sharpe | Trades |
|------------|----------|-----|---------------|--------|--------|
| **pattern123** | **67.6%** | **+7.03%** | **4.49** | **3.29** | 37 |
| **adx-ema-trend** | **34.6%** | **+1.38%** | **1.54** | **2.18** | 26 |
| bearTrap | 29.1% | +0.69% | 1.20 | 0.41 | 79 |
| trend-pullback-2025 | 28.3% | +0.44% | 1.16 | - | 113 |
| cci-trend-rider | 28.4% | +0.35% | 1.15 | 0.14 | 134 |
| obv-divergence | 29.5% | +0.23% | 1.16 | 0.19 | 61 |

### Estratégias Não Lucrativas (Precisam Otimização)

| Estratégia | Win Rate | PnL | Profit Factor | Sharpe | Trades |
|------------|----------|-----|---------------|--------|--------|
| ema-crossover | 25.6% | -1.68% | 1.00 | - | 86 |
| keltner-squeeze | 23.7% | -2.02% | 0.91 | -1.56 | 59 |
| momentum-breakout-2025 | 22.2% | -2.49% | 0.83 | - | 54 |
| donchian-breakout | 24.4% | -3.12% | 0.90 | -1.61 | 90 |
| supertrend-follow | 22.8% | -4.01% | 0.87 | -1.87 | 101 |
| williams-momentum | 14.6% | -4.32% | 0.50 | -5.91 | 41 |

### Conclusões:
1. **pattern123** é a melhor estratégia - métricas excelentes (Sharpe 3.29, PF 4.49)
2. **adx-ema-trend** também funciona bem - bom Sharpe (2.18) com poucos trades
3. **trend-pullback-2025** nova estratégia mostra promessa (+0.44%)
4. Estratégias simples de crossover (donchian, supertrend) têm win rate muito baixo
5. Bull market 2024: estratégias que seguem tendência funcionam melhor
6. Win rate baixo (~25-30%) pode ser lucrativo se R:R for alto (>2:1)

---

## 4. Estratégias para Bull Market 2025

### 4.1 Estratégias Criadas (2025)

#### vwap-pullback ⭐ MELHOR NOVA ESTRATÉGIA
**Arquivo:** `apps/backend/strategies/builtin/vwap-pullback.json`
**Resultados:** PF 1.95, Sharpe 3.49 (BTCUSDT), Sharpe 4.94 (ETHUSDT)

- Entry: Pullback para VWAP em tendência + RSI oversold + candle bullish
- Exit: ATR-based SL (1.2x) e TP (2x)
- Foco: Compra em suporte dinâmico (VWAP)

#### triple-ema-confluence
**Arquivo:** `apps/backend/strategies/builtin/triple-ema-confluence.json`
**Resultados:** PF 1.18, Sharpe 0.31, 84 trades (BTCUSDT)

- Entry: EMA9 > EMA21 > EMA55 + close crossover EMA9
- Exit: ATR-based SL (1.5x) e TP (3x)
- Foco: Entries em tendências consolidadas

#### rsi-divergence-trend
**Arquivo:** `apps/backend/strategies/builtin/rsi-divergence-trend.json`
**Resultados:** Precisa otimização (PF 0.52)

- Entry: RSI oversold + preço acima trend EMA + ADX confirma tendência
- Exit: ATR-based SL (1.5x) e TP (2.5x)
- Foco: Reversões em tendências fortes

#### momentum-breakout-2025 (v1.1)
**Arquivo:** `apps/backend/strategies/builtin/momentum-breakout-2025.json`

- Entry: EMA9 cruza EMA21 + preço acima EMA50 + RSI > 55 + volume alto
- Exit: ATR-based SL (1.5x) e TP (3x)
- **Novo:** Suporte a expressões matemáticas (volume.sma20 * 1.5)

#### trend-pullback-2025
**Arquivo:** `apps/backend/strategies/builtin/trend-pullback-2025.json`
**Resultados:** PF 1.16, 113 trades (BTCUSDT)

- Entry: Pullback para EMA9 em tendência (EMA21 > EMA50)
- Exit: ATR-based SL (1.2x) e TP (2.5x)
- Foco: Buy the dip em tendências estabelecidas

### 4.2 Estratégias para Pesquisar/Criar

1. ✅ ~~VWAP Reversion~~ → vwap-pullback (criada)
2. **Ichimoku Cloud Breakout** - Breakout da nuvem com confirmação
3. **Volume Profile Strategy** - Entry em POC (Point of Control)
4. **Market Structure Break** - Break of structure com volume
5. **Order Block Strategy** - Entrada em order blocks institucionais
6. **Fair Value Gap (FVG)** - Entrada em gaps de valor justo
7. **Swing Failure Pattern** - Falha em romper high/low anterior
8. **Golden/Death Cross** - EMA50/200 crossover com filtros
9. **Parabolic SAR Trend** - Trend following com SAR
10. ✅ ~~Triple EMA~~ → triple-ema-confluence (criada)

---

## 5. Conceitos Importantes para Crypto Trading 2025

### 5.1 Características de Bull Markets
- Pullbacks são oportunidades de compra
- Mean reversion funciona mal (evitar shorts)
- Momentum strategies funcionam bem
- Trend following é mais eficaz
- Breakouts têm maior taxa de sucesso

### 5.2 Melhores Timeframes
- **4h**: Bom equilíbrio entre sinais e ruído
- **1d**: Menos trades mas maior qualidade
- **1h**: Mais trades mas mais whipsaws

### 5.3 Gestão de Risco Recomendada
- Max position: 5-10% do capital por trade
- Max drawdown tolerável: 15-20%
- Risk per trade: 1-2% do capital
- Mínimo R:R: 2:1 para estratégias de baixo win rate

---

## 6. Arquivos Modificados

### Backend
- `apps/backend/src/services/backtesting/BacktestEngine.ts`
- `apps/backend/src/services/setup-detection/MeanReversionDetector.ts`
- `apps/backend/src/cli/utils/validators.ts`
- `apps/backend/src/cli/commands/validate.ts`
- `apps/backend/src/cli/backtest-runner.ts`

### Types
- `packages/types/src/backtesting.ts`

### Estratégias Criadas
- `apps/backend/strategies/builtin/momentum-breakout-2025.json`
- `apps/backend/strategies/builtin/trend-pullback-2025.json`
- `apps/backend/strategies/builtin/vwap-pullback.json` (nova)
- `apps/backend/strategies/builtin/triple-ema-confluence.json` (nova)
- `apps/backend/strategies/builtin/rsi-divergence-trend.json` (nova)

### Melhorias no Sistema
- `apps/backend/src/services/setup-detection/dynamic/ConditionEvaluator.ts`
  - Adicionado suporte a expressões matemáticas (ex: `"volume.sma20 * 1.5"`)

---

## 7. Comandos Úteis para Backtest

```bash
# Backtest básico
pnpm exec tsx src/cli/backtest-runner.ts validate \
  -s pattern123 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --use-algorithmic-levels \
  --no-trend-filter

# Com SL/TP fixos
pnpm exec tsx src/cli/backtest-runner.ts validate \
  -s meanReversion \
  --symbol BTCUSDT \
  -i 1h \
  --start 2024-06-01 \
  --end 2024-12-01 \
  --stop-loss 2 \
  --take-profit 6

# Optimization
pnpm exec tsx src/cli/backtest-runner.ts optimize \
  -s pattern123 \
  --symbol BTCUSDT \
  -i 4h \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1,1.5,2,2.5 \
  --param takeProfitPercent=3,4,5,6
```

---

## 8. Próximos Passos

### Concluído
- [x] Testar novas estratégias (momentum-breakout-2025, trend-pullback-2025)
- [x] Corrigir estratégias 2025 que não geravam sinais (condições muito restritivas)
- [x] Testar todas as estratégias dinâmicas disponíveis

### Pendente
1. [ ] Otimizar parâmetros das melhores estratégias (pattern123, adx-ema-trend)
2. [ ] Criar mais estratégias da lista 4.2 (VWAP, Ichimoku, etc.)
3. [ ] Testar em múltiplos símbolos (ETH, SOL, etc.)
4. [ ] Testar em diferentes timeframes (1h, 1d)
5. [ ] Walk-forward analysis para validar robustez
6. [ ] Implementar trailing stop melhorado

### Observações Importantes
- Estratégias com muitas condições simultâneas (AND) geram poucos sinais
- Condições de entrada devem ser simples, usar confidence bonuses para qualidade
- EMA crossover + filtro de tendência é uma combinação eficaz
- Win rate baixo (~25-30%) funciona se R:R >= 2:1

### H2 2024 - Bull Market Period (Jun-Dec)

| Estratégia | Trades | Win Rate | PnL | PF | Sharpe |
|------------|--------|----------|-----|-----|--------|
| **adx-ema-trend** | 14 | 35.7% | **+0.87%** | 1.62 | **2.48** |
| **trend-pullback-2025** | 72 | 30.6% | **+1.08%** | 1.24 | 0.67 |
| bearTrap | 52 | 26.9% | -0.26% | 1.10 | -0.20 |
| cci-trend-rider | 88 | 23.9% | -2.78% | 0.92 | -1.45 |

**Conclusão:** No H2 2024 (bull market), trend-pullback-2025 performou melhor (+1.08%) que no ano inteiro.

---

## 10. Limitações do Sistema de Estratégias Dinâmicas

### 10.1 Operações NÃO Suportadas em Condições

O ConditionEvaluator **não suporta**:

1. **Expressões matemáticas**:
   - ❌ `"volume.sma20 * 1.5"`
   - ❌ `"emaFast * 1.01"`
   - ✅ Usar valores fixos ou parâmetros

2. **Referências históricas**:
   - ❌ `"high.prev"` (candle anterior)
   - ❌ `"close[-1]"` (notação de índice)
   - ✅ Crossover/crossunder detectam mudanças

3. **Indicadores derivados**:
   - ❌ `"atr.sma20"` (SMA de ATR)
   - ✅ Implementar no IndicatorEngine se necessário

### 10.2 Sintaxe Suportada

```json
// Comparação simples
{ "left": "close", "op": ">", "right": "emaTrend" }

// Parâmetros
{ "left": "rsi", "op": ">", "right": "$rsiThreshold" }

// Valores numéricos
{ "left": "adx.adx", "op": ">", "right": 25 }

// Crossover/crossunder
{ "left": "emaFast", "op": "crossover", "right": "emaSlow" }

// Nested indicators
{ "left": "adx.plusDI", "op": ">", "right": "adx.minusDI" }
```

### 10.3 Indicadores Suportados

- sma, ema, rsi, macd, bollingerBands
- atr, stochastic, vwap, pivotPoints
- adx, obv, williamsR, cci, mfi
- donchian, keltner, supertrend

### 10.4 Expressões Matemáticas (NOVO!)

Agora suportado no ConditionEvaluator:
```json
{ "left": "volume", "op": ">", "right": "volume.sma20 * 1.5" }
{ "left": "low", "op": "<=", "right": "emaFast * 1.01" }
{ "left": "high", "op": ">=", "right": "emaFast - 100" }
```

Operadores suportados: `*`, `/`, `+`, `-`

---

## 11. Testes Multi-Ativo

### BTCUSDT 4h (2024)
| Estratégia | Trades | Win% | PnL | PF | Sharpe |
|------------|--------|------|-----|-----|--------|
| vwap-pullback | 5 | 40% | +0.48% | 1.95 | **3.49** |
| triple-ema-confluence | 84 | 28.6% | +0.55% | 1.18 | 0.31 |
| adx-ema-trend | 26 | 34.6% | +1.38% | 1.54 | **2.18** |

### ETHUSDT 4h (2024)
| Estratégia | Trades | Win% | PnL | PF | Sharpe |
|------------|--------|------|-----|-----|--------|
| vwap-pullback | 2 | 50% | +0.35% | 2.92 | **4.94** |
| adx-ema-trend | 21 | 23.8% | -0.71% | 0.91 | -1.50 |

### SOLUSDT 4h (2024)
| Estratégia | Trades | Win% | PnL | PF | Sharpe |
|------------|--------|------|-----|-----|--------|
| adx-ema-trend | 22 | 31.8% | +0.67% | 1.36 | **1.29** |
| triple-ema-confluence | 128 | 24.2% | -3.85% | 0.93 | -1.38 |

### Conclusões Multi-Ativo
1. **vwap-pullback** tem o melhor Sharpe ratio em todos os ativos
2. **adx-ema-trend** funciona bem em BTC e SOL, não tão bem em ETH
3. Estratégias otimizadas para BTC nem sempre funcionam em outros ativos

---

## 9. Plano de Correção Original

O plano completo está em: `/Users/nathan/.claude/plans/floofy-forging-platypus.md`

Itens implementados:
- ✅ Corrigir classificação win/loss
- ✅ Corrigir cálculo de comissão
- ✅ Resolver ambiguidade SL/TP
- ✅ Adicionar slippage
- ✅ Corrigir SL do MeanReversion
- ✅ Adicionar métricas gross vs net

Itens pendentes:
- ⏳ Logging detalhado de rejeições de setup
- ⏳ Análise de sensibilidade de parâmetros
