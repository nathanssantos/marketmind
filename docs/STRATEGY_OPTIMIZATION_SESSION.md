# Strategy Optimization Session - December 2024

## Objetivo
Revisar, corrigir e otimizar as estratégias JSON do sistema de backtesting.

## Trabalho Realizado

### 1. Problemas Identificados nos JSONs

#### Críticos (Corrigidos):
- **williams-momentum.json**: Estava usando `crossover` com constante (não funciona). Corrigido para usar `.prev` comparison:
  ```json
  // Antes (ERRADO)
  { "left": "williamsR", "op": "crossover", "right": "$oversold" }

  // Depois (CORRETO)
  { "left": "williamsR.prev", "op": "<", "right": "$oversold" },
  { "left": "williamsR", "op": ">=", "right": "$oversold" }
  ```

- **rsi-oversold-bounce.json**: Mesmo problema - crossover com constante.

- **cci-trend-rider.json**:
  - Usava `crossover` com constante
  - SHORT tinha `-100` hardcoded ao invés de usar parâmetro
  - Criamos `strongTrendUp` e `strongTrendDown` como parâmetros separados

- **keltner-squeeze.json**: Faltava verificação completa do squeeze (BB lower também deve estar dentro do Keltner)

#### Moderados (Corrigidos):
- **donchian-breakout.json** e **adx-ema-trend.json**: ADX threshold padrão de 25 era muito restritivo. Alterado para 20.

- Removida condição `close > ema20` de estratégias de **mean-reversion** (williams-momentum) porque é contraditória - quando RSI/Williams está em oversold, o preço normalmente está ABAIXO da média.

### 2. Bug Crítico Encontrado e Corrigido

**Problema:** O `StrategyLoader.loadAll()` EXCLUÍA estratégias com `status: "unprofitable"` por padrão.

**Impacto:** Nenhuma estratégia com status `unprofitable` era carregada pelo BacktestEngine, então todas retornavam 0 trades.

**Correção:** Adicionado `{ includeUnprofitable: true }` na chamada `loader.loadAll()` do BacktestEngine (linha 138):
```typescript
// apps/backend/src/services/backtesting/BacktestEngine.ts:138
const allStrategies = await loader.loadAll({ includeUnprofitable: true });
```

### 3. Validações Finais (TODAS FUNCIONANDO!)

| Estratégia | TF | Trades | WR% | PF | PnL% | Sharpe | Status |
|------------|-----|--------|-----|------|------|--------|--------|
| cci-trend-rider | 1d | 44 | 29.5% | **1.22** | **+0.54%** | 0.55 | Lucrativa |
| donchian-breakout | 1d | 68 | 29.4% | **1.21** | **+0.76%** | 0.51 | Lucrativa |
| williams-momentum | 1d | 73 | 27.4% | 1.10 | -0.37% | -0.20 | Marginal |
| adx-ema-trend | 4h | 16 | 31.3% | 1.33 | +0.42% | 1.10 | Lucrativa |
| rsi-oversold-bounce | 1d | 17 | 23.5% | 0.90 | -0.61% | -1.60 | Unprofitable |
| keltner-squeeze | 4h | 20 | 20.0% | 0.73 | -1.28% | -3.07 | Unprofitable |

### 4. Arquivos Modificados

```
apps/backend/
  src/services/backtesting/BacktestEngine.ts   # FIX: includeUnprofitable: true
  strategies/builtin/
    williams-momentum.json      # Entry conditions corrigidas
    rsi-oversold-bounce.json    # Entry conditions corrigidas
    cci-trend-rider.json        # Parâmetros + entry corrigidos
    keltner-squeeze.json        # Squeeze conditions completas
    donchian-breakout.json      # ADX threshold 25->20
    adx-ema-trend.json          # ADX threshold 25->20

apps/backend/strategies/README.md  # Documentação do .prev
docs/STRATEGY_OPTIMIZATION_SESSION.md  # Este documento
```

## Próximos Passos

1. **Otimizar estratégias lucrativas** (cci-trend-rider, donchian-breakout, adx-ema-trend)
2. **Atualizar backtestSummary** nos JSONs com resultados validados
3. **Atualizar status** das estratégias (active/unprofitable)
4. **Rodar otimização** para encontrar melhores parâmetros

## Comandos Úteis

```bash
# Validar estratégia (sem filtro de tendência para ver todos os trades)
npx tsx src/cli/backtest-runner.ts validate -s williams-momentum --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-10-01 --no-trend-filter

# Otimizar estratégia
npx tsx src/cli/backtest-runner.ts optimize -s cci-trend-rider --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-10-01
```

## Notas Importantes

### Sobre `.prev` References
O sistema suporta `.prev`, `.prev2`, `.prev3`, etc. para acessar valores anteriores de indicadores:
```json
{ "left": "rsi.prev", "op": "<", "right": 30 }     // RSI 1 candle atrás
{ "left": "ema9.prev2", "op": "<", "right": "ema9.prev" }  // EMA 2 candles atrás
```

### Sobre Crossover
O operador `crossover` funciona apenas entre dois indicadores (ex: `emaFast crossover emaSlow`), NÃO funciona com constantes (ex: `rsi crossover 30`).

Para simular crossover com constante, use:
```json
{ "left": "indicator.prev", "op": "<", "right": threshold },
{ "left": "indicator", "op": ">=", "right": threshold }
```

### Sobre status das estratégias
- O `StrategyLoader` por padrão **exclui** estratégias com status `unprofitable` ou `deprecated`
- Para backtesting, use `loadAll({ includeUnprofitable: true })`
- Para produção, estratégias unprofitable são automaticamente filtradas

### Estratégias de Mean-Reversion
NÃO usar filtros de tendência como `close > ema20` porque em oversold/overbought o preço geralmente está CONTRA a tendência.

## 🔴 PROBLEMA CRÍTICO: PnLs Muito Abaixo dos Benchmarks

### Comparação com Benchmarks (STRATEGY_BENCHMARKS.md)

| Estratégia | Métrica | Benchmark | Nosso Resultado | Gap |
|------------|---------|-----------|-----------------|-----|
| **RSI Oversold Bounce** | Win Rate | 60-75% | 23.5% | **-36.5 a -51.5 pp** |
| | Sharpe | 2.0-3.0 | -1.60 | **-3.6 a -4.6** |
| | Profit Factor | 3.0+ | 0.90 | **-2.1+** |
| **Williams %R** | Win Rate | 44-81% | 27.4% | **-16.6 a -53.6 pp** |
| | Sharpe | 1.5-2.5 | -0.20 | **-1.7 a -2.7** |
| | Profit Factor | 2.2 | 1.10 | **-1.1** |
| **CCI Trend Rider** | Win Rate | 50-53% | 29.5% | **-20.5 a -23.5 pp** |
| **Keltner Squeeze** | Win Rate | 54-77% | 20.0% | **-34 a -57 pp** |
| | Profit Factor | 2.0 | 0.73 | **-1.27** |

### Possíveis Causas (A Investigar)

#### 1. **Parâmetros Incompatíveis com Benchmarks**
Os benchmarks usam configurações específicas que podem não estar implementadas:
- **RSI 2** (período 2!) vs nosso padrão de 14
- **Williams %R** com período 2-day (não 14!)
- **Keltner** com período 6 e ATR 1.3 (não 20 e 2.0!)
- **CCI** com período 50 (não 20!)

#### 2. **Filtros Muito Restritivos**
- `minConfidence` pode estar filtrando sinais válidos
- `minRiskReward` pode estar excluindo trades lucrativos
- `onlyWithTrend` (EMA200 filter) pode estar cortando trades de mean-reversion

#### 3. **Stop Loss / Take Profit Inadequados**
Os benchmarks usam regras específicas de saída:
- **Connors RSI**: Sem stop! Exit quando close > 5 SMA
- **Williams %R**: Exit em -50 ou tempo (não % fixo)
- **Keltner**: ATR stop com settings específicos

#### 4. **Bug no Cálculo de Indicadores**
Possíveis problemas:
- `.prev` pode não estar retornando valor correto
- Indicadores podem estar usando candle errado (off-by-one)
- Cálculo de ATR/volatilidade pode estar incorreto

#### 5. **Bug no Trade Execution**
- Entry price pode estar errado (usando close vs next open)
- Exit pode estar sendo feito no mesmo candle (look-ahead bias)
- Commission sendo aplicada incorretamente

#### 6. **Dados de Mercado**
- Período testado (2024) pode ser desfavorável
- BTCUSDT pode ter comportamento diferente dos benchmarks (S&P 500, QQQ)
- Gaps/volatilidade em crypto vs stocks

### Investigação Necessária

```bash
# 1. Testar RSI com período 2 (Connors style)
# Criar estratégia connors-rsi2-original.json com:
# - rsiPeriod: 2
# - oversoldLevel: 10
# - Exit: close > SMA5

# 2. Testar Williams %R com período 2
# - williamsPeriod: 2
# - oversold: -90

# 3. Testar Keltner com settings do benchmark
# - emaPeriod: 6
# - atrMultiplier: 1.3

# 4. Debug detalhado de um trade
npx tsx src/cli/backtest-runner.ts validate -s rsi-oversold-bounce --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-03-01 --debug
```

### Arquivos para Investigar

1. **IndicatorEngine.ts** - Verificar cálculo de indicadores e `.prev`
2. **ConditionEvaluator.ts** - Verificar avaliação de condições
3. **BacktestEngine.ts** - Verificar execução de trades (entry/exit timing)
4. **Trade execution logic** - Verificar se não há look-ahead bias

### Hipóteses Principais

1. **MAIS PROVÁVEL**: Os parâmetros padrão nos JSONs não correspondem aos settings dos benchmarks
2. **PROVÁVEL**: Filtros (`minConfidence`, `onlyWithTrend`) estão removendo sinais válidos
3. **POSSÍVEL**: Bug no timing de entrada/saída (look-ahead bias)
4. **POSSÍVEL**: Crypto (BTCUSDT) comporta-se diferente de stocks (benchmarks são maioria S&P/QQQ)

---

## Status Final
- [x] Identificar problemas nos JSONs
- [x] Corrigir JSONs problemáticos
- [x] Debugar BacktestEngine (`includeUnprofitable: true`)
- [x] Validar estratégias corrigidas
- [ ] **🔴 CRÍTICO: Investigar gap entre nossos resultados e benchmarks**
- [ ] Testar com parâmetros exatos dos benchmarks
- [ ] Verificar bugs no IndicatorEngine/BacktestEngine
- [ ] Otimizar e atualizar JSONs com melhores parâmetros
- [ ] Atualizar status das estratégias baseado nos resultados

---

## Sessão Anterior (Contexto)

O sistema de backtesting foi corrigido para carregar estratégias `unprofitable`. As estratégias agora geram trades, mas os resultados estão MUITO abaixo dos benchmarks documentados em `STRATEGY_BENCHMARKS.md`.

**Próximo chat deve focar em:**
1. Comparar parâmetros exatos dos benchmarks vs nossos JSONs
2. Criar versões das estratégias com parâmetros dos benchmarks
3. Debugar um trade específico para verificar timing
4. Verificar se há look-ahead bias ou bugs nos indicadores

---

## 🔴 BUG IDENTIFICADO: Exit Logic Incorreta

### Problema Principal: Exit com SL/TP Fixo vs Indicator-Based Exit

Os benchmarks de alta performance usam **exits baseados em indicadores**, não stop loss/take profit fixos:

| Estratégia | Exit nos Benchmarks | Exit no Nosso Sistema |
|------------|--------------------|-----------------------|
| **Connors RSI 2** | `close > SMA(5)` | ATR SL + R:R TP ❌ |
| **Williams %R** | `williamsR > -50` | ATR SL + R:R TP ❌ |
| **RSI Oversold** | `rsi > 50 ou 60` | ATR SL + R:R TP ❌ |

### Exemplo: connors-rsi2-original.json

**Exit atual (ERRADO):**
```json
"exit": {
  "stopLoss": { "type": "atr", "multiplier": 3 },
  "takeProfit": { "type": "riskReward", "multiplier": 2 }
}
```

**Exit correto (Connors original):**
```json
"exit": {
  "conditions": {
    "long": [
      { "left": "close", "op": ">", "right": "sma5" }
    ]
  },
  "stopLoss": { "type": "atr", "multiplier": 3 }
}
```

### Impacto

Com exit % fixo:
- Trade pode fechar muito cedo (antes do movimento completo)
- Trade pode ficar aberto demais (esperando target que não vem)
- Win rate diminui drasticamente

Com exit baseado em indicador:
- Trade fecha quando o indicador mostra que a reversão foi completa
- Win rate muito mais alto (75% nos benchmarks)

### Arquivos para Modificar

1. **BacktestEngine.ts** - Implementar exit conditions baseadas em indicadores
2. **strategyDefinition.ts** - Adicionar suporte a `exit.conditions`
3. **Todos os JSONs de mean-reversion** - Corrigir lógica de exit

### Verificar se o Sistema Suporta

Checar se `exit.conditions` já é suportado no schema:
- `packages/types/src/strategyDefinition.ts`
- `apps/backend/src/services/setup-detection/dynamic/StrategyInterpreter.ts`

Se não existir, implementar:
```typescript
interface StrategyExit {
  stopLoss?: StopLossConfig;
  takeProfit?: TakeProfitConfig;
  conditions?: {  // NOVO
    long?: Condition[];
    short?: Condition[];
  };
}
```

### ✅ CONFIRMADO: Exit Conditions NÃO Suportadas

Verifiquei `packages/types/src/strategyDefinition.ts` - o `ExitConfig` atual:

```typescript
export interface ExitConfig {
  stopLoss: ExitLevel;
  takeProfit: ExitLevel;
  trailingStop?: TrailingStopConfig;
  // ❌ NÃO TEM conditions!
}
```

**Precisa ser modificado para:**

```typescript
export interface ExitConfig {
  stopLoss?: ExitLevel;           // Tornar opcional
  takeProfit?: ExitLevel;         // Tornar opcional
  trailingStop?: TrailingStopConfig;
  conditions?: ExitConditions;    // NOVO!
}

export interface ExitConditions {
  long?: ConditionGroup;
  short?: ConditionGroup;
}
```

### Arquivos para Implementar Exit Conditions

1. **packages/types/src/strategyDefinition.ts**
   - Adicionar `ExitConditions` interface
   - Modificar `ExitConfig` para incluir `conditions`
   - Tornar `stopLoss` e `takeProfit` opcionais

2. **apps/backend/src/services/backtesting/BacktestEngine.ts**
   - Na lógica de exit, checar `strategy.exit.conditions` primeiro
   - Se `conditions.long` (para posição LONG) for true, fechar posição
   - Manter SL como fallback de segurança

3. **apps/backend/src/services/setup-detection/dynamic/ConditionEvaluator.ts**
   - Já deve funcionar para avaliar exit conditions (reutilizar)

4. **Validação de estratégias**
   - Garantir que pelo menos `stopLoss` OU `conditions` existe
   - Não permitir estratégia sem nenhum mecanismo de exit

---

## 📋 RESUMO PARA PRÓXIMO CHAT

### O que foi feito
1. ✅ Corrigidos problemas com `crossover` em constantes (usar `.prev` pattern)
2. ✅ Corrigido bug do `StrategyLoader` excluindo estratégias `unprofitable`
3. ✅ Removidos filtros contraditórios em mean-reversion (close > ema20)
4. ✅ Ajustados ADX thresholds (25 → 20)
5. ✅ Estratégias agora geram trades

### O que NÃO está funcionando
🔴 **PnLs muito abaixo dos benchmarks** (gap de 30-50% em win rate!)

### Causa Raiz Identificada
**Exit conditions baseadas em indicadores NÃO são suportadas pelo sistema.**

Benchmarks usam exits como `close > SMA(5)` ou `RSI > 50`.
Nosso sistema só suporta `stopLoss` e `takeProfit` com % fixo ou ATR.

### Implementação Necessária

```typescript
// packages/types/src/strategyDefinition.ts
export interface ExitConditions {
  long?: ConditionGroup;
  short?: ConditionGroup;
}

export interface ExitConfig {
  stopLoss?: ExitLevel;           // Agora opcional
  takeProfit?: ExitLevel;         // Agora opcional
  trailingStop?: TrailingStopConfig;
  conditions?: ExitConditions;    // NOVO!
}
```

### Arquivos a Modificar
1. `packages/types/src/strategyDefinition.ts` - Adicionar ExitConditions
2. `apps/backend/src/services/backtesting/BacktestEngine.ts` - Implementar exit condition logic
3. Todos JSONs de mean-reversion - Adicionar exit conditions

### Exemplo de JSON Corrigido (connors-rsi2-original)

```json
{
  "exit": {
    "conditions": {
      "long": {
        "operator": "AND",
        "conditions": [
          { "left": "close", "op": ">", "right": "sma5" }
        ]
      }
    },
    "stopLoss": {
      "type": "atr",
      "multiplier": 3,
      "indicator": "atr"
    }
  }
}
```

### Prioridade
1. 🔴 Implementar `exit.conditions` no tipo e no BacktestEngine
2. 🟡 Atualizar connors-rsi2, williams-momentum, rsi-oversold-bounce
3. 🟢 Re-testar com parâmetros exatos dos benchmarks
4. 🟢 Otimizar estratégias que funcionarem

---

*Documento atualizado em: 2025-12-08*
