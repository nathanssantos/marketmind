# Plano de Melhoria: Indicadores Técnicos

## 1. Estado Atual

### 1.1 Indicadores Implementados

**Total: 30+ indicadores técnicos**

| Categoria | Indicadores |
|-----------|-------------|
| Trend | EMA, SMA, DEMA, TEMA, HMA, WMA, VWAP, Supertrend, Parabolic SAR |
| Momentum | RSI, Stochastic, MACD, ROC, CCI, Williams %R, CMO, TSI, Ultimate Oscillator |
| Volatility | Bollinger Bands, ATR, Keltner Channels, Donchian Channels |
| Volume | OBV, CMF, MFI, Klinger, Volume Profile |
| Complex | Ichimoku Cloud, ADX, Aroon, Vortex, Elder Ray, PPO, Awesome Oscillator |

### 1.2 Arquitetura de Indicadores

```
packages/indicators/src/
├── indicators/
│   ├── atr.ts              # Average True Range
│   ├── bollinger-bands.ts  # Bollinger Bands
│   ├── ema.ts              # Exponential Moving Average
│   ├── macd.ts             # MACD
│   ├── rsi.ts              # Relative Strength Index
│   ├── stochastic.ts       # Stochastic Oscillator
│   └── ...
├── utils/
│   ├── math.ts             # Funções matemáticas
│   └── validation.ts       # Validação de inputs
└── index.ts                # Exports
```

### 1.3 Renderers de Indicadores

```
apps/electron/src/renderer/hooks/chart-renderers/
├── useRSIRenderer.ts
├── useStochasticRenderer.ts
├── useMACDRenderer.ts
├── useBollingerBandsRenderer.ts
├── useIchimokuRenderer.ts
└── ... (30+ arquivos)
```

### 1.4 Métricas de Testes

- 200+ testes para indicadores
- Cobertura > 90%
- Validação contra valores de referência

---

## 2. Análise Acadêmica

### 2.1 Moving Averages

**Referências:**
- "Smoothing Data with Moving Averages" (NIST)
- "Exponential Smoothing" (Holt, 1957)
- "Technical Analysis from A to Z" (Achelis, 2000)

**Fórmulas:**

```
SMA(n) = (P₁ + P₂ + ... + Pₙ) / n

EMA(n) = α × Pₜ + (1 - α) × EMA(n-1)
onde α = 2 / (n + 1)

DEMA(n) = 2 × EMA(n) - EMA(EMA(n))

TEMA(n) = 3 × EMA(n) - 3 × EMA(EMA(n)) + EMA(EMA(EMA(n)))

HMA(n) = WMA(2 × WMA(n/2) - WMA(n), √n)

WMA(n) = Σ(Pᵢ × i) / Σi
```

**Validação:**
- SMA: Confirmado contra TA-Lib
- EMA: Confirmado contra TradingView
- HMA: Confirmado contra fórmula original de Alan Hull

### 2.2 RSI (Relative Strength Index)

**Referência:**
- "New Concepts in Technical Trading Systems" (J. Welles Wilder Jr., 1978)

**Fórmula Original:**
```
RSI = 100 - (100 / (1 + RS))

RS = Average Gain / Average Loss

Initial Average:
  Avg Gain = Sum of Gains over n periods / n
  Avg Loss = Sum of Losses over n periods / n

Subsequent:
  Avg Gain = ((Previous Avg Gain × (n-1)) + Current Gain) / n
  Avg Loss = ((Previous Avg Loss × (n-1)) + Current Loss) / n

n = 14 (padrão)
```

**Zonas:**
- Overbought: > 70
- Oversold: < 30

**Validação:**
- Wilder's smoothing (não SMA) ✅
- Primeiro cálculo usa média simples ✅
- Valores subsequentes usam fórmula de suavização ✅

### 2.3 MACD (Moving Average Convergence Divergence)

**Referência:**
- Gerald Appel (1979)
- "The Moving Average Convergence-Divergence Trading Method" (Appel, 2005)

**Fórmula:**
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line - Signal Line
```

**Parâmetros Padrão:**
- Fast Period: 12
- Slow Period: 26
- Signal Period: 9

**Validação:**
- Usa EMA (não SMA) ✅
- Histogram é a diferença ✅
- Signal line é EMA do MACD ✅

### 2.4 Bollinger Bands

**Referência:**
- "Bollinger on Bollinger Bands" (John Bollinger, 2001)
- www.bollingerbands.com (documentação oficial)

**Fórmula:**
```
Middle Band = SMA(20)
Upper Band = SMA(20) + (2 × σ)
Lower Band = SMA(20) - (2 × σ)

σ = Desvio padrão dos últimos 20 períodos
```

**Parâmetros Padrão:**
- Period: 20
- Std Dev Multiplier: 2

**%B Indicator:**
```
%B = (Close - Lower Band) / (Upper Band - Lower Band)
```

**Bandwidth:**
```
Bandwidth = (Upper Band - Lower Band) / Middle Band
```

### 2.5 Stochastic Oscillator

**Referência:**
- George Lane (1950s)
- "Lane's Stochastics" (Technical Analysis of Stocks & Commodities)

**Fórmula:**
```
%K = 100 × (Close - Low₁₄) / (High₁₄ - Low₁₄)
%D = SMA(%K, 3)

Low₁₄ = Lowest low of last 14 periods
High₁₄ = Highest high of last 14 periods
```

**Variações:**
- Fast Stochastic: %K raw, %D = SMA(%K, 3)
- Slow Stochastic: %K = SMA(Fast %K, 3), %D = SMA(Slow %K, 3)
- Full Stochastic: Parâmetros customizáveis

### 2.6 ATR (Average True Range)

**Referência:**
- "New Concepts in Technical Trading Systems" (Wilder, 1978)

**Fórmula:**
```
True Range = max(
  High - Low,
  |High - Previous Close|,
  |Low - Previous Close|
)

ATR = Wilder's Smoothing of TR over n periods
    = ((ATR₋₁ × (n-1)) + TR) / n
```

**Padrão:**
- Period: 14

### 2.7 Ichimoku Cloud

**Referência:**
- Goichi Hosoda (1960s)
- "Ichimoku Charts" (Nicole Elliott, 2007)

**Fórmulas:**
```
Tenkan-sen (Conversion Line) = (High₉ + Low₉) / 2
Kijun-sen (Base Line) = (High₂₆ + Low₂₆) / 2
Senkou Span A = (Tenkan-sen + Kijun-sen) / 2, plotted 26 periods ahead
Senkou Span B = (High₅₂ + Low₅₂) / 2, plotted 26 periods ahead
Chikou Span = Close, plotted 26 periods back
```

**Parâmetros Padrão:**
- Tenkan: 9
- Kijun: 26
- Senkou B: 52

### 2.8 ADX (Average Directional Index)

**Referência:**
- "New Concepts in Technical Trading Systems" (Wilder, 1978)

**Fórmula:**
```
+DM = High - Previous High (if > 0 and > -DM)
-DM = Previous Low - Low (if > 0 and > +DM)

+DI = 100 × Smoothed +DM / ATR
-DI = 100 × Smoothed -DM / ATR

DX = 100 × |+DI - -DI| / (+DI + -DI)
ADX = Smoothed DX
```

**Interpretação:**
- ADX > 25: Tendência forte
- ADX < 20: Sem tendência
- +DI > -DI: Tendência bullish
- -DI > +DI: Tendência bearish

---

## 3. Benchmarking de Mercado

### 3.1 TA-Lib (Technical Analysis Library)

**Referência:** https://ta-lib.org

- Biblioteca C open-source
- 200+ indicadores
- Padrão da indústria para validação

**O que podemos aprender:**
- Nomenclatura padronizada de parâmetros
- Tratamento de edge cases
- Otimização de performance

### 3.2 TradingView

- Pine Script para indicadores
- Grande comunidade
- Indicadores validados

**O que podemos aprender:**
- UX de configuração de indicadores
- Valores default por ativo
- Overlay vs Panel rendering

### 3.3 pandas-ta (Python)

**Referência:** https://github.com/twopirllc/pandas-ta

- 130+ indicadores
- Bem documentado
- Testes extensivos

**O que podemos aprender:**
- Organização de código
- Documentação de indicadores
- Validação de fórmulas

---

## 4. Problemas Identificados

### 4.1 Performance

1. **Recálculo desnecessário** - Indicadores recalculados a cada render
2. **Falta de cache** - Mesmo input gera novo cálculo
3. **Não incremental** - Novo candle recalcula tudo

### 4.2 Precisão

1. **Smoothing inconsistente** - Alguns usam SMA em vez de Wilder's
2. **Edge cases** - Divisão por zero não tratada em todos
3. **Período inicial** - Alguns indicadores incorretos nos primeiros valores

### 4.3 Documentação

1. **Falta de referências** - Sem citação de papers/livros
2. **Parâmetros não documentados** - Difícil saber defaults
3. **Sem exemplos de uso** - Apenas código

### 4.4 Testes

1. **Sem validação contra TA-Lib** - Valores não comparados
2. **Poucos edge cases** - Divisão por zero, arrays vazios
3. **Sem testes de performance** - Benchmarks

---

## 5. Melhorias Propostas

### 5.1 Caching de Indicadores

```typescript
interface IndicatorCache {
  lastInput: Kline[];
  lastResult: number[];
  checksum: string;
}

const useIndicatorWithCache = (
  indicator: (klines: Kline[]) => number[],
  klines: Kline[],
  params: IndicatorParams
) => {
  const cache = useRef<IndicatorCache | null>(null);

  return useMemo(() => {
    const checksum = computeChecksum(klines, params);

    if (cache.current?.checksum === checksum) {
      return cache.current.lastResult;
    }

    const result = indicator(klines);
    cache.current = { lastInput: klines, lastResult: result, checksum };
    return result;
  }, [klines, params]);
};
```

### 5.2 Cálculo Incremental

```typescript
interface IncrementalIndicator<T> {
  state: T;
  update(newValue: number): number;
  reset(): void;
}

class IncrementalEMA implements IncrementalIndicator<{ ema: number }> {
  private alpha: number;
  state = { ema: 0 };

  constructor(period: number) {
    this.alpha = 2 / (period + 1);
  }

  update(price: number): number {
    this.state.ema = this.alpha * price + (1 - this.alpha) * this.state.ema;
    return this.state.ema;
  }
}
```

### 5.3 Validação contra TA-Lib

```typescript
describe('RSI Validation', () => {
  it('should match TA-Lib values', () => {
    const prices = [44.34, 44.09, 44.15, 43.61, 44.33, ...];
    const taLibResult = [70.53, 66.32, 66.55, ...];

    const result = calculateRSI(prices, 14);

    result.forEach((value, i) => {
      expect(value).toBeCloseTo(taLibResult[i], 2);
    });
  });
});
```

### 5.4 Documentação de Indicadores

```typescript
/**
 * Relative Strength Index (RSI)
 *
 * @description Measures the speed and change of price movements
 *
 * @reference
 * - Wilder, J.W. (1978). New Concepts in Technical Trading Systems
 * - https://www.investopedia.com/terms/r/rsi.asp
 *
 * @formula
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 *
 * @param prices - Array of closing prices
 * @param period - Lookback period (default: 14)
 * @returns Array of RSI values (0-100)
 *
 * @interpretation
 * - > 70: Overbought
 * - < 30: Oversold
 * - Divergence indicates potential reversal
 *
 * @example
 * const rsi = calculateRSI([44.34, 44.09, 44.15, ...], 14);
 * // Returns [NaN, NaN, ..., 70.53, 66.32, ...]
 */
export const calculateRSI = (prices: number[], period = 14): number[] => {
  // Implementation
};
```

---

## 6. Plano de Implementação

### Fase 1: Validação (1 semana)

| Task | Prioridade |
|------|------------|
| Validar RSI contra TA-Lib | P1 |
| Validar MACD contra TA-Lib | P1 |
| Validar Bollinger contra TA-Lib | P1 |
| Validar Stochastic contra TA-Lib | P1 |
| Documentar discrepâncias | P1 |

### Fase 2: Correções (1 semana)

| Task | Prioridade |
|------|------------|
| Corrigir smoothing em RSI | P1 |
| Corrigir edge cases (div/0) | P1 |
| Corrigir período inicial | P2 |
| Adicionar validação de input | P2 |

### Fase 3: Performance (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar caching | P2 |
| Implementar cálculo incremental | P2 |
| Benchmark de performance | P3 |
| Otimizar renderers | P3 |

### Fase 4: Documentação (1 semana)

| Task | Prioridade |
|------|------------|
| Documentar cada indicador | P2 |
| Adicionar referências acadêmicas | P2 |
| Criar examples/ com uso | P3 |
| Atualizar README | P3 |

---

## 7. Critérios de Validação

### 7.1 Precisão

- [ ] Todos indicadores validados contra TA-Lib
- [ ] Diferença máxima de 0.01%
- [ ] Edge cases tratados corretamente
- [ ] Período inicial com NaN (não valores incorretos)

### 7.2 Performance

- [ ] Caching implementado para todos
- [ ] < 10ms para 1000 candles
- [ ] Cálculo incremental para updates
- [ ] Zero recálculos desnecessários

### 7.3 Documentação

- [ ] Cada indicador com JSDoc completo
- [ ] Referência a paper/livro original
- [ ] Fórmula matemática documentada
- [ ] Exemplos de uso

### 7.4 Testes

- [ ] Cobertura > 95%
- [ ] Testes contra TA-Lib
- [ ] Testes de edge cases
- [ ] Testes de performance

---

## 8. Arquivos a Modificar

### Indicadores Core

1. `packages/indicators/src/indicators/rsi.ts`
2. `packages/indicators/src/indicators/macd.ts`
3. `packages/indicators/src/indicators/bollinger-bands.ts`
4. `packages/indicators/src/indicators/stochastic.ts`
5. `packages/indicators/src/indicators/atr.ts`
6. `packages/indicators/src/indicators/adx.ts`

### Renderers

1. `apps/electron/src/renderer/hooks/chart-renderers/*.ts`
2. Adicionar caching em cada renderer

### Testes

1. `packages/indicators/src/__tests__/`
2. Adicionar validação contra TA-Lib

### Documentação

1. `packages/indicators/README.md`
2. `packages/indicators/docs/` (criar)
