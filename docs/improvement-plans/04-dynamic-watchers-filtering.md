# Plano 4: Melhoria da Filtragem do Dynamic Watchers

**Status:** Planejado
**Prioridade:** 2 (Melhora qualidade dos trades)
**Risco:** Médio
**Arquivos estimados:** ~8
**Testes novos:** ~20

---

## Objetivo

Filtrar ativos no Quick Start apenas para aqueles em tendência clara que sigam a mesma tendência do BTC.

---

## Estado Atual

### Pipeline Atual (Quick Start)

```
1. Market cap ranked symbols (top 100+)
   ↓
2. Opportunity scoring (volume, volatility, win rate)
   ↓
3. Capital requirements filter
   ↓
4. Kline availability filter
   ↓
5. Funding rates filter (futures only)
   ↓
OUTPUT: Ranked, capital-approved symbols
```

### Filtros de Tendência Existentes

| Filtro | Arquivo | Uso Atual | Aplicado Em |
|--------|---------|-----------|-------------|
| Trend Filter | `trend-filter.ts` | EMA21 vs price | Por trade |
| BTC Correlation | `btc-correlation-filter.ts` | Score 0-100 | Por trade |
| Market Regime | `market-regime-filter.ts` | ADX trending/ranging | Por trade |
| MTF Filter | `mtf-filter.ts` | EMA50/200 HTF | Por trade |

### Problema

Os filtros de tendência **existem** mas são aplicados apenas na **execução de trades**, não na **seleção de ativos** do Quick Start.

**Resultado:** Quick Start pode selecionar ativos que estão ranging ou contra a tendência do BTC, desperdiçando slots de watchers.

---

## Solução Proposta

### Novo Pipeline (Quick Start)

```
1. Market cap ranked symbols (top 100+)
   ↓
2. Opportunity scoring
   ↓
3. Capital requirements filter
   ↓
4. Kline availability filter
   ↓
5. Funding rates filter (futures)
   ↓
6. [NOVO] Trend clarity filter (ADX > 25)
   ↓
7. [NOVO] BTC alignment filter (same direction)
   ↓
OUTPUT: Trending, BTC-aligned, capital-approved symbols
```

---

## Ações Planejadas

### 1. Criar Trend Alignment Module

**Arquivo:** `packages/indicators/src/trendAlignment.ts`

```typescript
import type { Kline } from '@marketmind/types';
import { calculateADX } from './adx';
import { calculateEMA } from './ema';
import { calculateRSI } from './rsi';

export interface TrendAlignmentConfig {
  adxPeriod?: number;        // Default: 14
  adxThreshold?: number;     // Default: 25
  emaPeriod?: number;        // Default: 21
  emaConfirmBars?: number;   // Default: 3
  rsiPeriod?: number;        // Default: 14
  rsiLowerBound?: number;    // Default: 30
  rsiUpperBound?: number;    // Default: 70
}

export interface TrendInfo {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isClearTrend: boolean;
  strength: number;          // 0-100
  adx: number;
  priceVsEma: 'ABOVE' | 'BELOW' | 'CROSSING';
  rsi: number;
}

export interface TrendAlignmentResult {
  asset: TrendInfo;
  btc: TrendInfo;
  isAligned: boolean;
  alignmentScore: number;    // 0-100
  recommendation: 'TRADE' | 'SKIP' | 'CAUTION';
  reason: string;
}

const DEFAULT_CONFIG: Required<TrendAlignmentConfig> = {
  adxPeriod: 14,
  adxThreshold: 25,
  emaPeriod: 21,
  emaConfirmBars: 3,
  rsiPeriod: 14,
  rsiLowerBound: 30,
  rsiUpperBound: 70,
};

export const analyzeTrend = (
  klines: Kline[],
  config: TrendAlignmentConfig = {}
): TrendInfo => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (klines.length < cfg.adxPeriod + 14) {
    return {
      direction: 'NEUTRAL',
      isClearTrend: false,
      strength: 0,
      adx: 0,
      priceVsEma: 'CROSSING',
      rsi: 50,
    };
  }

  const adx = calculateADX(klines, cfg.adxPeriod);
  const ema = calculateEMA(klines.map(k => k.close), cfg.emaPeriod);
  const rsi = calculateRSI(klines, cfg.rsiPeriod);
  const currentPrice = klines[klines.length - 1].close;
  const currentEma = ema[ema.length - 1];

  // Check price vs EMA for last N bars
  const recentKlines = klines.slice(-cfg.emaConfirmBars);
  const recentEma = ema.slice(-cfg.emaConfirmBars);
  const allAbove = recentKlines.every((k, i) => k.close > recentEma[i]);
  const allBelow = recentKlines.every((k, i) => k.close < recentEma[i]);

  const priceVsEma: 'ABOVE' | 'BELOW' | 'CROSSING' =
    allAbove ? 'ABOVE' : allBelow ? 'BELOW' : 'CROSSING';

  const isClearTrend = adx >= cfg.adxThreshold && priceVsEma !== 'CROSSING';

  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (isClearTrend) {
    direction = priceVsEma === 'ABOVE' ? 'BULLISH' : 'BEARISH';
  }

  // Strength: combination of ADX and distance from EMA
  const emaDistance = Math.abs(currentPrice - currentEma) / currentEma * 100;
  const strength = Math.min(100, (adx / 50 * 50) + (emaDistance * 10));

  return {
    direction,
    isClearTrend,
    strength,
    adx,
    priceVsEma,
    rsi,
  };
};

export const checkTrendAlignment = (
  assetKlines: Kline[],
  btcKlines: Kline[],
  config: TrendAlignmentConfig = {}
): TrendAlignmentResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const asset = analyzeTrend(assetKlines, cfg);
  const btc = analyzeTrend(btcKlines, cfg);

  // Calculate alignment
  const isDirectionAligned = asset.direction === btc.direction;
  const bothHaveClearTrend = asset.isClearTrend && btc.isClearTrend;
  const isAligned = isDirectionAligned && bothHaveClearTrend;

  // Alignment score
  let alignmentScore = 50; // Base score
  if (isDirectionAligned) alignmentScore += 20;
  if (bothHaveClearTrend) alignmentScore += 20;
  if (asset.rsi > cfg.rsiLowerBound && asset.rsi < cfg.rsiUpperBound) alignmentScore += 10;

  // Recommendation
  let recommendation: 'TRADE' | 'SKIP' | 'CAUTION';
  let reason: string;

  if (!btc.isClearTrend) {
    recommendation = 'CAUTION';
    reason = 'BTC sem tendência clara (ranging)';
  } else if (!asset.isClearTrend) {
    recommendation = 'SKIP';
    reason = `Ativo sem tendência clara (ADX: ${asset.adx.toFixed(1)})`;
  } else if (!isDirectionAligned) {
    recommendation = 'SKIP';
    reason = `Tendência oposta ao BTC (Asset: ${asset.direction}, BTC: ${btc.direction})`;
  } else if (asset.rsi < cfg.rsiLowerBound || asset.rsi > cfg.rsiUpperBound) {
    recommendation = 'CAUTION';
    reason = `RSI em extremo (${asset.rsi.toFixed(1)})`;
  } else {
    recommendation = 'TRADE';
    reason = `Alinhado com BTC ${btc.direction}`;
  }

  return {
    asset,
    btc,
    isAligned,
    alignmentScore,
    recommendation,
    reason,
  };
};
```

---

### 2. Criar Market Structure Helper

**Arquivo:** `packages/indicators/src/marketStructure.ts`

```typescript
import type { Kline } from '@marketmind/types';
import { findSwingPoints, type SwingPoint } from './swingPoints';

export interface MarketStructure {
  trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  confidence: number;  // 0-100
}

export const analyzeMarketStructure = (
  klines: Kline[],
  lookback: number = 50
): MarketStructure => {
  const recentKlines = klines.slice(-lookback);
  const swings = findSwingPoints(recentKlines);

  const swingHighs = swings.filter(s => s.type === 'high').slice(-4);
  const swingLows = swings.filter(s => s.type === 'low').slice(-4);

  let higherHighs = 0;
  let lowerHighs = 0;
  let higherLows = 0;
  let lowerLows = 0;

  // Count higher highs / lower highs
  for (let i = 1; i < swingHighs.length; i++) {
    if (swingHighs[i].price > swingHighs[i - 1].price) higherHighs++;
    else lowerHighs++;
  }

  // Count higher lows / lower lows
  for (let i = 1; i < swingLows.length; i++) {
    if (swingLows[i].price > swingLows[i - 1].price) higherLows++;
    else lowerLows++;
  }

  // Determine trend
  let trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  let confidence: number;

  if (higherHighs >= 2 && higherLows >= 2) {
    trend = 'UPTREND';
    confidence = ((higherHighs + higherLows) / (swingHighs.length + swingLows.length - 2)) * 100;
  } else if (lowerHighs >= 2 && lowerLows >= 2) {
    trend = 'DOWNTREND';
    confidence = ((lowerHighs + lowerLows) / (swingHighs.length + swingLows.length - 2)) * 100;
  } else {
    trend = 'RANGING';
    confidence = 50;
  }

  return {
    trend,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    lastSwingHigh: swingHighs[swingHighs.length - 1] ?? null,
    lastSwingLow: swingLows[swingLows.length - 1] ?? null,
    confidence,
  };
};
```

---

### 3. Integrar no Quick Start

**Arquivo:** `apps/backend/src/routers/auto-trading.ts`

```typescript
// Dentro de getFilteredSymbolsForQuickStart

// Passo 1: Buscar BTC klines e analisar tendência
const btcSymbol = input.marketType === 'FUTURES' ? 'BTCUSDT' : 'BTCUSDT';
const btcKlines = await klineService.getKlines({
  symbol: btcSymbol,
  interval: '4h',
  limit: 100,
});

const btcTrend = analyzeTrend(btcKlines);

// Se BTC não tem tendência clara, retornar menos símbolos ou avisar
if (!btcTrend.isClearTrend) {
  // Opção 1: Continuar mas com aviso
  // Opção 2: Retornar array vazio
  // Opção 3: Usar filtro menos restritivo
}

// Passo 2: Para cada símbolo elegível, verificar alinhamento
const alignedSymbols: string[] = [];
const skippedTrend: { symbol: string; reason: string }[] = [];

for (const symbol of eligibleSymbols) {
  // Buscar klines do ativo
  const assetKlines = await klineService.getKlines({
    symbol,
    interval: input.interval,
    limit: 100,
  });

  const alignment = checkTrendAlignment(assetKlines, btcKlines);

  if (alignment.recommendation === 'TRADE') {
    alignedSymbols.push(symbol);
  } else {
    skippedTrend.push({ symbol, reason: alignment.reason });
  }

  // Parar quando atingir limite
  if (alignedSymbols.length >= input.limit) break;
}

return {
  symbols: alignedSymbols,
  skippedInsufficientCapital,
  skippedInsufficientKlines,
  skippedTrend,  // NOVO
  btcTrend: {
    direction: btcTrend.direction,
    isClearTrend: btcTrend.isClearTrend,
    adx: btcTrend.adx,
  },
  // ... resto
};
```

---

### 4. Atualizar Frontend

**Arquivo:** `apps/electron/src/renderer/components/Trading/WatcherManager/QuickStartSection.tsx`

```tsx
// Mostrar info de tendência do BTC
<Badge colorScheme={btcTrend.direction === 'BULLISH' ? 'green' : 'red'}>
  BTC: {btcTrend.direction} (ADX: {btcTrend.adx.toFixed(1)})
</Badge>

{!btcTrend.isClearTrend && (
  <Alert status="warning">
    BTC sem tendência clara. Ativos podem ter performance reduzida.
  </Alert>
)}

// Mostrar símbolos pulados por tendência
{skippedTrend.length > 0 && (
  <Collapse>
    <Text>Pulados por tendência: {skippedTrend.length}</Text>
    {skippedTrend.map(s => (
      <Text key={s.symbol}>{s.symbol}: {s.reason}</Text>
    ))}
  </Collapse>
)}
```

---

### 5. Expor Funções Existentes

**Arquivo:** `apps/backend/src/utils/filters/btc-correlation-filter.ts`

```typescript
// Expor funções que podem ser reutilizadas
export { getBtcTrendInfo } from './btc-correlation-filter';
export { calculateADX, getMarketRegime } from './market-regime-filter';
```

---

## Arquivos a Modificar/Criar

### Novos Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `packages/indicators/src/trendAlignment.ts` | Análise de alinhamento de tendência |
| `packages/indicators/src/marketStructure.ts` | Análise de estrutura de mercado |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `packages/indicators/src/index.ts` | Exportar novos módulos |
| `apps/backend/src/routers/auto-trading.ts` | Integrar filtro no Quick Start |
| `apps/backend/src/utils/filters/btc-correlation-filter.ts` | Expor funções |
| `apps/backend/src/utils/filters/market-regime-filter.ts` | Expor ADX |
| `QuickStartSection.tsx` | Mostrar info de tendência |

---

## Configuração

### Parâmetros Ajustáveis

```typescript
const TREND_FILTER_CONFIG = {
  // ADX threshold para considerar trending
  ADX_THRESHOLD: 25,

  // Período do ADX
  ADX_PERIOD: 14,

  // Período da EMA para direção
  EMA_PERIOD: 21,

  // Quantos candles price deve estar acima/abaixo EMA
  EMA_CONFIRM_BARS: 3,

  // Limites RSI para evitar extremos
  RSI_LOWER_BOUND: 30,
  RSI_UPPER_BOUND: 70,

  // Mínimo de klines necessários
  MIN_KLINES: 50,
};
```

---

## Verificação

### Unit Tests

- [ ] `analyzeTrend` retorna BULLISH quando price > EMA e ADX > 25
- [ ] `analyzeTrend` retorna BEARISH quando price < EMA e ADX > 25
- [ ] `analyzeTrend` retorna NEUTRAL quando ADX < 25
- [ ] `checkTrendAlignment` retorna TRADE quando ambos alinhados
- [ ] `checkTrendAlignment` retorna SKIP quando direções opostas
- [ ] `analyzeMarketStructure` detecta uptrend com HH/HL
- [ ] `analyzeMarketStructure` detecta downtrend com LH/LL

### Integration Tests

- [ ] Quick Start filtra corretamente em mercado bullish
- [ ] Quick Start filtra corretamente em mercado bearish
- [ ] Quick Start retorna menos símbolos quando BTC ranging
- [ ] Symbols retornados realmente seguem BTC

### Manual Tests

- [ ] Testar com diferentes condições de mercado
- [ ] Verificar que ativos selecionados performam melhor
- [ ] Comparar win rate antes/depois da mudança

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Filtro muito restritivo | Média | Médio | ADX threshold configurável |
| Poucos símbolos em ranging | Alta | Médio | Fallback para top volume |
| Performance (muitas kline fetches) | Média | Médio | Cache de klines |
| Falsos positivos/negativos | Média | Baixo | Múltiplos indicadores |

---

## Dependências

- **Pode usar:** `packages/indicators/src/atr.ts`, `swingPoints.ts` existentes
- **Não depende de:** Outros planos
