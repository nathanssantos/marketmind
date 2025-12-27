# Indicator Implementation Plan

> Adding all 45+ indicators to MarketMind's chart toggle popover with Web Workers for performance

## Overview

| Metric | Value |
|--------|-------|
| Total Indicators | 45+ |
| New Renderers | ~35 |
| New Workers | ~20 |
| New Categories | 4 (expand from 4 to 8) |
| Languages | 4 (en, pt, es, fr) |

---

## Phase 1: Foundation Infrastructure

### 1.1 Refactor CanvasManager for Dynamic Panels

**File:** `apps/electron/src/renderer/utils/canvas/CanvasManager.ts`

Replace hardcoded panel heights with dynamic registry:

```typescript
interface PanelConfig {
  id: string;
  height: number;
  order: number;
}

// Replace:
// - stochasticPanelHeight: number
// - rsiPanelHeight: number

// With:
private panels: Map<string, PanelConfig> = new Map();

setPanelHeight(panelId: string, height: number, order: number): void;
getPanelTop(panelId: string): number;
getTotalPanelHeight(): number;
getActivePanels(): PanelConfig[];
```

### 1.2 Create Indicator State Store

**New File:** `apps/electron/src/renderer/store/indicatorStore.ts`

```typescript
interface IndicatorState {
  // All indicator toggles in one place
  activeIndicators: Set<string>;
  indicatorParams: Record<string, Record<string, number>>;

  toggleIndicator: (id: string) => void;
  setIndicatorParam: (id: string, param: string, value: number) => void;
  isActive: (id: string) => boolean;
}
```

### 1.3 Add Panel Height Constants

**File:** `apps/electron/src/shared/constants/chartConfig.ts`

```typescript
export const INDICATOR_PANEL_HEIGHTS = {
  SMALL: 60,    // Simple single-line oscillators
  STANDARD: 80, // RSI, Stochastic, Williams %R, CCI
  LARGE: 100,   // MACD, ADX (multiple lines + histogram)
} as const;

export const PANEL_RENDER_ORDER = [
  'rsi', 'stochastic', 'macd', 'adx', 'cci', 'williamsR',
  'stochRsi', 'cmo', 'mfi', 'ultimateOsc', 'tsi', 'ppo',
  'roc', 'ao', 'aroon', 'vortex', 'elderRay', 'obv', 'cmf', 'klinger'
] as const;
```

### 1.4 Create Renderer Factory Utilities

**New File:** `apps/electron/src/renderer/components/Chart/indicators/panelUtils.ts`

Shared utilities for panel rendering:
- `drawPanelBackground()`
- `drawOverboughtOversoldZones()`
- `drawZeroLine()`
- `drawScaleLabels()`
- `drawIndicatorLine()`
- `drawHistogram()`

---

## Phase 2: High-Priority Oscillators (with Workers)

### 2.1 MACD

**Renderer:** `apps/electron/src/renderer/components/Chart/useMACDRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/macd.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useMACDWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | LARGE (100px) |
| Components | MACD line, Signal line, Histogram |
| Default Params | fast=12, slow=26, signal=9 |
| Colors | macdLine (blue), signalLine (orange), histogram (+green/-red) |

### 2.2 ADX (Average Directional Index)

**Renderer:** `apps/electron/src/renderer/components/Chart/useADXRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/adx.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useADXWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | LARGE (100px) |
| Components | ADX line, +DI line, -DI line, 25 threshold |
| Default Params | period=14 |
| Colors | adx (yellow), plusDI (green), minusDI (red) |

### 2.3 Williams %R

**Renderer:** `apps/electron/src/renderer/components/Chart/useWilliamsRRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/williamsR.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useWilliamsRWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Scale | -100 to 0 |
| Zones | Overbought: -20, Oversold: -80 |
| Default Params | period=14 |

### 2.4 CCI (Commodity Channel Index)

**Renderer:** `apps/electron/src/renderer/components/Chart/useCCIRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/cci.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useCCIWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Scale | Unbounded (typically -200 to +200) |
| Zones | +100, -100 threshold lines |
| Default Params | period=20 |

### 2.5 Stochastic RSI

**Renderer:** `apps/electron/src/renderer/components/Chart/useStochRSIRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/stochRsi.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useStochRSIWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Scale | 0-100 |
| Zones | 80/20 |
| Components | K line, D line |
| Default Params | rsiPeriod=14, stochPeriod=14, kPeriod=3, dPeriod=3 |

---

## Phase 3: Overlay Indicators (with Workers)

### 3.1 Ichimoku Cloud

**Renderer:** `apps/electron/src/renderer/components/Chart/useIchimokuRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/ichimoku.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useIchimokuWorker.ts`

| Property | Value |
|----------|-------|
| Display | Overlay on main chart |
| Components | Tenkan-sen, Kijun-sen, Senkou Span A/B (cloud), Chikou Span |
| Default Params | tenkan=9, kijun=26, senkou=52 |
| Colors | tenkan (blue), kijun (red), cloud A (green fill), cloud B (red fill) |

### 3.2 Supertrend

**Renderer:** `apps/electron/src/renderer/components/Chart/useSupertrendRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/supertrend.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useSupertrendWorker.ts`

| Property | Value |
|----------|-------|
| Display | Overlay line that changes color |
| Default Params | period=10, multiplier=3 |
| Colors | Uptrend (green), Downtrend (red) |

### 3.3 Parabolic SAR

**Renderer:** `apps/electron/src/renderer/components/Chart/useParabolicSARRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/parabolicSar.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useParabolicSARWorker.ts`

| Property | Value |
|----------|-------|
| Display | Dots above/below candles |
| Default Params | step=0.02, max=0.2 |
| Colors | Above price (red), Below price (green) |

### 3.4 Keltner Channel

**Renderer:** `apps/electron/src/renderer/components/Chart/useKeltnerRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/keltner.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useKeltnerWorker.ts`

| Property | Value |
|----------|-------|
| Display | Overlay bands (similar to Bollinger) |
| Components | Upper, Middle (EMA), Lower bands |
| Default Params | period=20, multiplier=2 |

### 3.5 Donchian Channel

**Renderer:** `apps/electron/src/renderer/components/Chart/useDonchianRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/donchian.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useDonchianWorker.ts`

| Property | Value |
|----------|-------|
| Display | Overlay channel |
| Components | Upper (highest high), Lower (lowest low), Middle |
| Default Params | period=20 |

---

## Phase 4: Volume Indicators (with Workers)

### 4.1 OBV (On-Balance Volume)

**Renderer:** `apps/electron/src/renderer/components/Chart/useOBVRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/obv.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useOBVWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Components | OBV line, optional SMA |
| Scale | Unbounded (cumulative volume) |

### 4.2 CMF (Chaikin Money Flow)

**Renderer:** `apps/electron/src/renderer/components/Chart/useCMFRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/cmf.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useCMFWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Scale | -1 to +1 |
| Display | Histogram with zero line |
| Default Params | period=20 |

### 4.3 Klinger Oscillator

**Renderer:** `apps/electron/src/renderer/components/Chart/useKlingerRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/klinger.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useKlingerWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | LARGE (100px) |
| Components | Klinger line, Signal line |
| Display | Similar to MACD |

### 4.4 Elder Ray

**Renderer:** `apps/electron/src/renderer/components/Chart/useElderRayRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/elderRay.worker.ts`
**Hook:** `apps/electron/src/renderer/hooks/useElderRayWorker.ts`

| Property | Value |
|----------|-------|
| Panel Height | STANDARD (80px) |
| Components | Bull Power, Bear Power histograms |
| Default Params | period=13 |

---

## Phase 5: Additional Oscillators (with Workers)

| Indicator | Worker | Panel Height | Scale | Key Feature |
|-----------|--------|--------------|-------|-------------|
| CMO | Yes | STANDARD | -100 to +100 | Zero line |
| MFI | Yes | STANDARD | 0-100 | 80/20 zones |
| Ultimate Oscillator | Yes | STANDARD | 0-100 | Multiple timeframes |
| TSI | Yes | STANDARD | -100 to +100 | Signal line crossovers |
| PPO | Yes | STANDARD | Unbounded | Percentage-based MACD |
| ROC | Yes | STANDARD | Unbounded | Momentum |
| Awesome Oscillator | Yes | STANDARD | Unbounded | Histogram colors |
| Aroon | Yes | STANDARD | 0-100 | Up/Down lines |
| Vortex | Yes | STANDARD | Unbounded | VI+/VI- lines |
| Cumulative RSI | Yes | STANDARD | Unbounded | Cumulative sum |

---

## Phase 6: Moving Average Extensions

**File:** `apps/electron/src/renderer/components/Chart/useMovingAverageRenderer.ts`

Extend existing renderer to support:

| MA Type | Calculation | Worker |
|---------|-------------|--------|
| DEMA | Double Exponential | No (fast) |
| TEMA | Triple Exponential | No (fast) |
| WMA | Weighted | No (fast) |
| HMA | Hull | Yes (complex) |

---

## Phase 7: Price Structure Indicators

### 7.1 Pivot Points

**Renderer:** `apps/electron/src/renderer/components/Chart/usePivotPointsRenderer.ts`

| Property | Value |
|----------|-------|
| Display | Horizontal lines overlay |
| Components | P, S1, S2, S3, R1, R2, R3 |
| Types | Standard, Fibonacci, Woodie, Camarilla |

### 7.2 Fibonacci Levels

**Renderer:** `apps/electron/src/renderer/components/Chart/useFibonacciRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/fibonacci.worker.ts`

| Property | Value |
|----------|-------|
| Display | Horizontal lines from swing points |
| Levels | 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100% |
| Auto-detection | Based on swing highs/lows |

### 7.3 Fair Value Gaps (FVG)

**Renderer:** `apps/electron/src/renderer/components/Chart/useFVGRenderer.ts`

| Property | Value |
|----------|-------|
| Display | Rectangle zones |
| Types | Bullish FVG, Bearish FVG |
| Fill tracking | Show unfilled gaps |

### 7.4 Liquidity Levels

**Renderer:** `apps/electron/src/renderer/components/Chart/useLiquidityLevelsRenderer.ts`
**Worker:** `apps/electron/src/renderer/workers/liquidityLevels.worker.ts`

| Property | Value |
|----------|-------|
| Display | Horizontal zones |
| Detection | High volume nodes, equal highs/lows |

---

## Worker Implementation Pattern

### Worker Template

**File:** `apps/electron/src/renderer/workers/[indicator].worker.ts`

```typescript
import { calculate[Indicator] } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

interface WorkerMessage {
  klines: Kline[];
  params: Record<string, number>;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { klines, params } = e.data;

  if (!klines || klines.length === 0) {
    self.postMessage(null);
    return;
  }

  try {
    const result = calculate[Indicator](klines, params);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
```

### Worker Hook Template

**File:** `apps/electron/src/renderer/hooks/use[Indicator]Worker.ts`

```typescript
import { useEffect, useRef, useState } from 'react';
import type { Kline } from '@marketmind/types';
import type { [Indicator]Result } from '@marketmind/indicators';

interface Use[Indicator]WorkerProps {
  klines: Kline[] | null;
  enabled: boolean;
  params?: Record<string, number>;
}

export const use[Indicator]Worker = ({
  klines,
  enabled,
  params = {}
}: Use[Indicator]WorkerProps) => {
  const [data, setData] = useState<[Indicator]Result | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    workerRef.current = new Worker(
      new URL('../workers/[indicator].worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<[Indicator]Result | null>) => {
      setData(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [enabled]);

  useEffect(() => {
    if (!workerRef.current || !klines || !enabled) return;
    workerRef.current.postMessage({ klines, params });
  }, [klines, enabled, JSON.stringify(params)]);

  return data;
};
```

---

## Indicator Toggle Popover Categories

### Updated Category Structure

```typescript
const categories: IndicatorCategory[] = [
  {
    id: 'oscillators',
    title: t('chart.indicators.categories.oscillators'),
    indicators: ['rsi', 'stochastic', 'williamsR', 'cci', 'stochRsi', 'cmo', 'mfi', 'ultimateOsc']
  },
  {
    id: 'momentum',
    title: t('chart.indicators.categories.momentum'),
    indicators: ['macd', 'tsi', 'ppo', 'roc', 'ao']
  },
  {
    id: 'trend',
    title: t('chart.indicators.categories.trend'),
    indicators: ['adx', 'aroon', 'vortex', 'parabolicSar', 'supertrend']
  },
  {
    id: 'volatility',
    title: t('chart.indicators.categories.volatility'),
    indicators: ['bollingerBands', 'atr', 'keltner', 'donchian']
  },
  {
    id: 'volume',
    title: t('chart.indicators.categories.volume'),
    indicators: ['volume', 'vwap', 'obv', 'cmf', 'klinger', 'elderRay']
  },
  {
    id: 'movingAverages',
    title: t('chart.indicators.categories.movingAverages'),
    indicators: [...existingMAs, 'dema', 'tema', 'wma', 'hma']
  },
  {
    id: 'priceStructure',
    title: t('chart.indicators.categories.priceStructure'),
    indicators: ['ichimoku', 'pivotPoints', 'fibonacci', 'fvg', 'liquidityLevels']
  },
  {
    id: 'crypto',
    title: t('chart.indicators.categories.crypto'),
    indicators: ['fundingRate', 'openInterest', 'btcDominance']
  }
];
```

---

## Files to Create

### Workers (20 files)
```
apps/electron/src/renderer/workers/
├── macd.worker.ts
├── adx.worker.ts
├── williamsR.worker.ts
├── cci.worker.ts
├── stochRsi.worker.ts
├── ichimoku.worker.ts
├── supertrend.worker.ts
├── parabolicSar.worker.ts
├── keltner.worker.ts
├── donchian.worker.ts
├── obv.worker.ts
├── cmf.worker.ts
├── klinger.worker.ts
├── elderRay.worker.ts
├── cmo.worker.ts
├── mfi.worker.ts
├── tsi.worker.ts
├── ppo.worker.ts
├── aroon.worker.ts
└── vortex.worker.ts
```

### Worker Hooks (20 files)
```
apps/electron/src/renderer/hooks/
├── useMACDWorker.ts
├── useADXWorker.ts
├── useWilliamsRWorker.ts
├── useCCIWorker.ts
├── useStochRSIWorker.ts
├── useIchimokuWorker.ts
├── useSupertrendWorker.ts
├── useParabolicSARWorker.ts
├── useKeltnerWorker.ts
├── useDonchianWorker.ts
├── useOBVWorker.ts
├── useCMFWorker.ts
├── useKlingerWorker.ts
├── useElderRayWorker.ts
├── useCMOWorker.ts
├── useMFIWorker.ts
├── useTSIWorker.ts
├── usePPOWorker.ts
├── useAroonWorker.ts
└── useVortexWorker.ts
```

### Renderers (25+ files)
```
apps/electron/src/renderer/components/Chart/
├── indicators/
│   ├── index.ts
│   ├── panelUtils.ts
│   └── types.ts
├── useMACDRenderer.ts
├── useADXRenderer.ts
├── useWilliamsRRenderer.ts
├── useCCIRenderer.ts
├── useStochRSIRenderer.ts
├── useIchimokuRenderer.ts
├── useSupertrendRenderer.ts
├── useParabolicSARRenderer.ts
├── useKeltnerRenderer.ts
├── useDonchianRenderer.ts
├── useOBVRenderer.ts
├── useCMFRenderer.ts
├── useKlingerRenderer.ts
├── useElderRayRenderer.ts
├── useCMORenderer.ts
├── useMFIRenderer.ts
├── useUltimateOscRenderer.ts
├── useTSIRenderer.ts
├── usePPORenderer.ts
├── useROCRenderer.ts
├── useAORenderer.ts
├── useAroonRenderer.ts
├── useVortexRenderer.ts
├── usePivotPointsRenderer.ts
├── useFibonacciRenderer.ts
├── useFVGRenderer.ts
└── useLiquidityLevelsRenderer.ts
```

### Store
```
apps/electron/src/renderer/store/
└── indicatorStore.ts
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/electron/src/renderer/utils/canvas/CanvasManager.ts` | Dynamic panel registry |
| `apps/electron/src/renderer/components/Layout/IndicatorTogglePopover.tsx` | Add all new indicators and categories |
| `apps/electron/src/renderer/pages/ChartWindow.tsx` | Integrate indicator store, wire up new renderers |
| `apps/electron/src/renderer/components/Chart/ChartCanvas.tsx` | Render new indicators |
| `apps/electron/src/shared/constants/chartConfig.ts` | Add panel height constants |
| `apps/electron/src/renderer/locales/en/translation.json` | Add all indicator translations |
| `apps/electron/src/renderer/locales/pt/translation.json` | Portuguese translations |
| `apps/electron/src/renderer/locales/es/translation.json` | Spanish translations |
| `apps/electron/src/renderer/locales/fr/translation.json` | French translations |

---

## Translation Keys

```json
{
  "chart": {
    "indicators": {
      "categories": {
        "oscillators": "Oscillators",
        "momentum": "Momentum",
        "trend": "Trend",
        "volatility": "Volatility",
        "volume": "Volume",
        "movingAverages": "Moving Averages",
        "priceStructure": "Price Structure",
        "crypto": "Crypto Metrics"
      },
      "names": {
        "macd": "MACD",
        "adx": "ADX",
        "williamsR": "Williams %R",
        "cci": "CCI",
        "stochRsi": "Stochastic RSI",
        "cmo": "CMO",
        "mfi": "MFI",
        "ultimateOsc": "Ultimate Oscillator",
        "tsi": "TSI",
        "ppo": "PPO",
        "roc": "ROC",
        "ao": "Awesome Oscillator",
        "aroon": "Aroon",
        "vortex": "Vortex",
        "ichimoku": "Ichimoku Cloud",
        "supertrend": "Supertrend",
        "parabolicSar": "Parabolic SAR",
        "keltner": "Keltner Channel",
        "donchian": "Donchian Channel",
        "obv": "OBV",
        "cmf": "CMF",
        "klinger": "Klinger",
        "elderRay": "Elder Ray",
        "pivotPoints": "Pivot Points",
        "fibonacci": "Fibonacci",
        "fvg": "Fair Value Gaps",
        "liquidityLevels": "Liquidity Levels",
        "dema": "DEMA",
        "tema": "TEMA",
        "wma": "WMA",
        "hma": "HMA"
      }
    }
  }
}
```

---

## Implementation Order

### Batch 1: Infrastructure + High Priority
1. CanvasManager refactor
2. Indicator store
3. Panel utilities
4. MACD (worker + renderer)
5. ADX (worker + renderer)
6. Williams %R (worker + renderer)
7. CCI (worker + renderer)

### Batch 2: Overlay Indicators
8. Ichimoku (worker + renderer)
9. Supertrend (worker + renderer)
10. Parabolic SAR (worker + renderer)
11. Keltner Channel (worker + renderer)
12. Donchian Channel (worker + renderer)

### Batch 3: Volume Indicators
13. OBV (worker + renderer)
14. CMF (worker + renderer)
15. Klinger (worker + renderer)
16. Elder Ray (worker + renderer)

### Batch 4: Remaining Oscillators
17. Stochastic RSI
18. CMO
19. MFI
20. Ultimate Oscillator
21. TSI
22. PPO
23. ROC
24. Awesome Oscillator
25. Aroon
26. Vortex

### Batch 5: Price Structure + MAs
27. Pivot Points
28. Fibonacci
29. FVG
30. Liquidity Levels
31. DEMA/TEMA/WMA/HMA support

### Batch 6: Translations + Polish
32. All translations (4 languages)
33. Update IndicatorTogglePopover
34. Integration tests
35. Performance optimization

---

## Performance Considerations

1. **Web Workers**: All CPU-intensive calculations run in background threads
2. **Memoization**: Results cached until klines change
3. **Viewport culling**: Only render visible portion
4. **Lazy loading**: Workers created only when indicator enabled
5. **Debouncing**: 100ms debounce on viewport changes for panel recalculation
6. **Max panels warning**: Alert when > 4 panel indicators active
