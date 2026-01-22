# Plano de Melhoria: Sistema de Gráficos

## 1. Estado Atual

### 1.1 Componentes do Sistema de Charts

| Componente | Linhas | Descrição |
|------------|--------|-----------|
| `ChartCanvas.tsx` | 1,902 | Componente principal (CRÍTICO) |
| `ChartTooltip.tsx` | 683 | Tooltip de informações |
| `ChartControls.tsx` | ~200 | Controles de navegação |
| `ChartIndicatorPanel.tsx` | ~300 | Painel de indicadores |
| `ChartLegend.tsx` | ~150 | Legenda do gráfico |

### 1.2 Hooks de Renderização

```
apps/electron/src/renderer/hooks/chart-renderers/
├── useKlineRenderer.ts          # Candlesticks
├── useVolumeRenderer.ts         # Volume bars
├── useRSIRenderer.ts            # RSI
├── useStochasticRenderer.ts     # Stochastic
├── useMACDRenderer.ts           # MACD
├── useBollingerBandsRenderer.ts # Bollinger
├── useIchimokuRenderer.ts       # Ichimoku
├── useFibonacciRenderer.ts      # Fibonacci retracements
├── useOrderLinesRenderer.ts     # Order lines
├── useLiquidityLevelsRenderer.ts# Liquidity zones
├── useFVGRenderer.ts            # Fair Value Gaps
└── ... (30+ renderers)
```

### 1.3 Performance Atual

| Métrica | Valor Atual | Target |
|---------|-------------|--------|
| FPS (1000 candles) | ~45 fps | 60 fps |
| Initial render | ~200ms | <100ms |
| Re-render on scroll | ~50ms | <16ms |
| Memory usage | ~100MB | <50MB |

### 1.4 Features Implementadas

- Zoom/Pan com mouse e touch
- Crosshair com informações
- Múltiplos indicadores overlay
- Indicadores em painéis separados
- Fibonacci retracements
- Order lines (entries, stops, targets)
- Fair Value Gaps (FVG)
- Liquidity levels
- Volume profile (vertical)
- Multi-timeframe display

---

## 2. Análise Acadêmica

### 2.1 Canvas Rendering Performance

**Referências:**
- "High Performance Canvas" (HTML5 Rocks)
- "Canvas Performance Optimization" (MDN)
- "Immediate Mode vs Retained Mode" (Microsoft Graphics)

**Técnicas:**

1. **Layer Composition:**
```
Layer 0: Background (static)
Layer 1: Price axis (semi-static)
Layer 2: Candles (dynamic)
Layer 3: Indicators (dynamic)
Layer 4: Overlays (dynamic)
Layer 5: Crosshair (interactive)
```

2. **Dirty Rectangle:**
```javascript
// Só redesenha área modificada
const dirtyRect = calculateDirtyArea(changes);
ctx.save();
ctx.beginPath();
ctx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
ctx.clip();
// render...
ctx.restore();
```

3. **Off-screen Canvas:**
```javascript
// Pre-render elementos estáticos
const offscreen = new OffscreenCanvas(width, height);
const offCtx = offscreen.getContext('2d');
renderStaticElements(offCtx);

// Usar como cache
ctx.drawImage(offscreen, 0, 0);
```

### 2.2 WebGL para Charts

**Referências:**
- "WebGL Fundamentals" (webglfundamentals.org)
- TradingView Lightweight Charts (usa Canvas 2D otimizado)
- PIXI.js (WebGL abstraction)

**Benefícios:**
- GPU acceleration
- Milhões de pontos em tempo real
- Shaders para efeitos visuais

**Trade-offs:**
- Complexidade de implementação
- Debugging mais difícil
- Suporte browser variável

### 2.3 Virtual Scrolling para Time Series

**Referências:**
- "react-window" (Brian Vaughn)
- "Virtualized Lists" (React Documentation)

**Conceito:**
```
Total: 10,000 candles
Visible: 100 candles
Buffer: 50 candles (cada lado)

Renderizado: 200 candles (2% do total)
```

### 2.4 Request Animation Frame

**Referências:**
- "Scheduling with requestAnimationFrame" (Google Developers)
- "Browser Rendering Pipeline" (Paul Lewis)

**Pattern:**
```javascript
let frameId: number;
let lastTimestamp = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

const animate = (timestamp: number) => {
  const elapsed = timestamp - lastTimestamp;

  if (elapsed >= frameInterval) {
    render();
    lastTimestamp = timestamp - (elapsed % frameInterval);
  }

  frameId = requestAnimationFrame(animate);
};
```

---

## 3. Benchmarking de Mercado

### 3.1 TradingView

**Tecnologia:**
- Canvas 2D otimizado
- WebAssembly para cálculos pesados
- Compression de dados históricos

**Performance:**
- 60 fps consistente
- 1M+ candles sem lag
- Real-time streaming

**O que podemos aprender:**
- Layer separation
- Incremental rendering
- Efficient data structures

### 3.2 Lightweight Charts (TradingView Open Source)

**Código:** https://github.com/nicktidswell/lightweight-charts

**Técnicas:**
- Time scale optimization
- Price scale caching
- Bitmap caching

### 3.3 D3.js Financial Charts

**Referências:**
- "D3.js in Action" (Elijah Meeks)
- d3fc (D3 Financial Components)

**Abordagem:**
- SVG para charts pequenos
- Canvas para grandes datasets
- Hybrid rendering

### 3.4 React-Financial-Charts

**Código:** https://github.com/react-financial/react-financial-charts

**Técnicas:**
- React reconciliation otimizado
- Canvas abstraction
- Modular indicators

---

## 4. Problemas Identificados

### 4.1 ChartCanvas.tsx (1,902 linhas!)

**Problema Principal:** Arquivo massivo com múltiplas responsabilidades.

**Issues:**
1. 60+ imports
2. 30+ hooks de indicadores
3. State management complexo
4. Rendering, interaction, data tudo junto

**Proposta de Decomposição:**
```
components/Chart/
├── ChartCanvas/
│   ├── index.tsx              # Container (~300 lines)
│   ├── useChartState.ts       # Estado consolidado
│   ├── useChartInteraction.ts # Mouse, touch, zoom
│   ├── useChartRendering.ts   # Orchestração de render
│   ├── layers/
│   │   ├── BackgroundLayer.tsx
│   │   ├── PriceAxisLayer.tsx
│   │   ├── CandleLayer.tsx
│   │   ├── IndicatorLayer.tsx
│   │   └── OverlayLayer.tsx
│   └── renderers/
│       └── ... (mover de hooks/)
```

### 4.2 Re-renders Desnecessários

1. **Todos indicadores re-renderizam** quando qualquer um muda
2. **Crosshair causa full render** em vez de overlay only
3. **Zoom recalcula tudo** em vez de usar cache

### 4.3 Memory Leaks

1. Canvas contexts não são cleanup
2. Event listeners não removidos
3. Animation frames continuam após unmount

### 4.4 Cores Hardcoded

- 74 ocorrências de cores RGBA em renderers
- Não respeitam tema dark/light
- Difícil customização

---

## 5. Melhorias Propostas

### 5.1 Layer Architecture

```typescript
// components/Chart/layers/types.ts
interface ChartLayer {
  id: string;
  zIndex: number;
  canvas: HTMLCanvasElement;
  render: (ctx: CanvasRenderingContext2D, state: ChartState) => void;
  shouldRender: (prevState: ChartState, nextState: ChartState) => boolean;
}

// Background layer - renders once
const backgroundLayer: ChartLayer = {
  id: 'background',
  zIndex: 0,
  shouldRender: (prev, next) => prev.colorMode !== next.colorMode,
  render: (ctx, state) => {
    ctx.fillStyle = state.colors.background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
};

// Candle layer - renders on data or viewport change
const candleLayer: ChartLayer = {
  id: 'candles',
  zIndex: 2,
  shouldRender: (prev, next) =>
    prev.klines !== next.klines || prev.viewport !== next.viewport,
  render: (ctx, state) => {
    renderCandlesticks(ctx, state.visibleKlines, state.colors);
  },
};
```

### 5.2 Virtualized Rendering

```typescript
// hooks/useVirtualizedKlines.ts
const useVirtualizedKlines = (
  allKlines: Kline[],
  viewport: Viewport,
  buffer: number = 50
) => {
  return useMemo(() => {
    const startIndex = Math.max(0, viewport.startIndex - buffer);
    const endIndex = Math.min(allKlines.length, viewport.endIndex + buffer);

    return {
      visibleKlines: allKlines.slice(startIndex, endIndex),
      startIndex,
      totalCount: allKlines.length,
    };
  }, [allKlines, viewport.startIndex, viewport.endIndex, buffer]);
};
```

### 5.3 Off-screen Caching

```typescript
// hooks/useOffscreenCache.ts
const useOffscreenCache = (width: number, height: number) => {
  const cacheRef = useRef<Map<string, OffscreenCanvas>>(new Map());

  const getOrCreate = useCallback((key: string) => {
    if (!cacheRef.current.has(key)) {
      cacheRef.current.set(key, new OffscreenCanvas(width, height));
    }
    return cacheRef.current.get(key)!;
  }, [width, height]);

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  useEffect(() => {
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return { getOrCreate, invalidate };
};
```

### 5.4 Optimized Animation Loop

```typescript
// hooks/useAnimationFrame.ts
const useAnimationFrame = (
  callback: (timestamp: number) => void,
  deps: DependencyList
) => {
  const frameRef = useRef<number>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      callbackRef.current(timestamp);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, deps);
};
```

### 5.5 Consolidated Chart State

```typescript
// hooks/useChartState.ts
interface ChartState {
  klines: Kline[];
  viewport: Viewport;
  crosshair: Crosshair | null;
  indicators: IndicatorConfig[];
  colors: ChartColors;
  dimensions: Dimensions;
  interaction: InteractionState;
}

const useChartState = (props: ChartProps) => {
  const [state, dispatch] = useReducer(chartReducer, initialState);

  const actions = useMemo(() => ({
    setViewport: (viewport: Viewport) =>
      dispatch({ type: 'SET_VIEWPORT', viewport }),
    setCrosshair: (crosshair: Crosshair | null) =>
      dispatch({ type: 'SET_CROSSHAIR', crosshair }),
    toggleIndicator: (id: string) =>
      dispatch({ type: 'TOGGLE_INDICATOR', id }),
  }), []);

  return { state, actions };
};
```

---

## 6. Plano de Implementação

### Fase 1: Decomposição do ChartCanvas (2 semanas)

| Task | Prioridade |
|------|------------|
| Criar estrutura de diretórios | P1 |
| Extrair useChartState | P1 |
| Extrair useChartInteraction | P1 |
| Separar layers (Background, Candles, Indicators) | P1 |
| Mover renderers para novo local | P2 |
| Testar funcionalidade após refactor | P1 |

### Fase 2: Otimização de Performance (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar layer caching | P1 |
| Virtualized klines rendering | P1 |
| Optimized animation loop | P2 |
| Memory leak fixes | P1 |

### Fase 3: Migração de Cores (1 semana)

| Task | Prioridade |
|------|------------|
| Migrar cores de 30+ renderers | P1 |
| Criar getRendererColors helper | P1 |
| Testar dark/light mode | P1 |

### Fase 4: Melhorias de UX (1 semana)

| Task | Prioridade |
|------|------------|
| Smooth zoom/pan animations | P2 |
| Touch gestures optimization | P2 |
| Keyboard navigation | P3 |
| Accessibility improvements | P3 |

---

## 7. Critérios de Validação

### 7.1 Performance

- [ ] 60 fps consistente com 1000+ candles
- [ ] Initial render < 100ms
- [ ] Re-render on scroll < 16ms
- [ ] Memory usage < 50MB

### 7.2 Arquitetura

- [ ] ChartCanvas < 400 linhas
- [ ] Layers independentes
- [ ] Cada renderer < 200 linhas
- [ ] Zero memory leaks

### 7.3 Qualidade

- [ ] Todas cores do tema
- [ ] Dark/light mode funcional
- [ ] Touch gestures suaves
- [ ] Zero flickering

### 7.4 Testes

- [ ] Testes unitários para cada layer
- [ ] Testes de performance automatizados
- [ ] Visual regression tests

---

## 8. Arquivos a Modificar

### Criar

1. `components/Chart/ChartCanvas/index.tsx`
2. `components/Chart/ChartCanvas/useChartState.ts`
3. `components/Chart/ChartCanvas/useChartInteraction.ts`
4. `components/Chart/ChartCanvas/useChartRendering.ts`
5. `components/Chart/ChartCanvas/layers/*.tsx`

### Modificar

1. `components/Chart/ChartCanvas.tsx` → Decomposition
2. `hooks/chart-renderers/*.ts` → Migrar cores
3. `theme/index.ts` → Adicionar tokens de chart

### Remover

1. Código duplicado entre renderers
2. Event listeners não cleanup
3. Animation frames órfãos
