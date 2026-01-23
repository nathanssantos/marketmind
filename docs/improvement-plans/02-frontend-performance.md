# Plano 2: Performance do Frontend/Gráfico

**Status:** Planejado
**Prioridade:** 1 (Impacto imediato na UX)
**Risco:** Baixo
**Arquivos estimados:** ~5
**Testes novos:** ~10

---

## Objetivo

Eliminar re-renders desnecessários durante uso de régua, medição, arraste do gráfico e movimentação de ordens SL/TP.

---

## Problemas Identificados

### CRÍTICO - Measurement Area

**Arquivo:** `useChartInteraction.ts:341-373`

```typescript
// PROBLEMA: Chamado em CADA mousemove
if (isMeasuring && manager && measurementArea) {
  setMeasurementArea({         // ← STATE UPDATE #1
    ...measurementArea,
    endX: mouseX,
    endY: mouseY,
    endIndex: hoveredIndex,
  });
  manager.markDirty('overlays');

  setTooltipData({             // ← STATE UPDATE #2
    // ... calculations ...
  });
}
```

**Impacto:** 2 state updates por frame durante drag = múltiplos re-renders

---

### CRÍTICO - Order Drag SL/TP

**Arquivo:** `useOrderDragHandler.ts:65-98`

```typescript
// PROBLEMA: setPreviewPrice chamado em CADA mousemove
const handleMouseMove = useCallback((y: number): void => {
  if (!draggedOrder) return;
  const currentPrice = config.yToPrice(y);

  if (dragType === 'stopLoss' || dragType === 'takeProfit') {
    setPreviewPrice(currentPrice);  // ← STATE UPDATE a cada pixel
    return;
  }
  // ...
}, [draggedOrder, dragType, config]);
```

**Fluxo atual que causa travamento:**
1. Mouse move → `handleMouseMove(y)` chamado
2. `setPreviewPrice(currentPrice)` atualiza state
3. React re-renderiza componente inteiro
4. Canvas redesenha ordem na nova posição
5. Repete a cada pixel → "travamento" perceptível

---

### MÉDIO - Overlay Layer Sempre Re-renderiza

**Arquivo:** `OverlayLayer.ts:181-183`

```typescript
// PROBLEMA: Sempre retorna true
const shouldRerender = (): boolean => {
  return true;  // ← SEMPRE RE-RENDERIZA!
};
```

---

### MÉDIO - Dependency Array Grande

**Arquivo:** `ChartCanvas.tsx:896-955`

```typescript
// 54 dependências no useEffect de render
useEffect(() => {
  // render function
}, [
  manager, renderWatermark, renderGrid, renderVolume, renderKlines,
  // ... 49+ mais dependências ...
]);
```

**Impacto:** Qualquer mudança de referência de função causa re-render completo

---

### BAIXO - markDirty() Chamado Frequentemente

**Arquivo:** `useChartInteraction.ts`

Linhas: 354, 392, 408, 433, 436, 531

**Mitigação existente:** RAF throttling já implementado

---

## Padrões Positivos Existentes

| Padrão | Localização | Benefício |
|--------|-------------|-----------|
| Dirty flag system | CanvasManager | Smart change tracking |
| RAF scheduling | CanvasManager | 16ms throttle |
| Memoização tooltip | ChartTooltip | React.memo aplicado |
| Viewport throttle | useChartCanvas | 50ms para pan/zoom |
| MA cache | useChartBaseRenderers | Evita recálculo |

---

## Ações Planejadas

### 1. Throttle Measurement Updates

**Arquivo:** `useChartInteraction.ts`

```typescript
// ANTES
setMeasurementArea({ ...measurementArea, endX, endY, endIndex });

// DEPOIS
const throttledSetMeasurement = useThrottle(setMeasurementArea, 50);
// ...
throttledSetMeasurement({ ...measurementArea, endX, endY, endIndex });
```

---

### 2. Usar Ref para Order Drag Preview

**Arquivo:** `useOrderDragHandler.ts`

```typescript
// ANTES (causa re-render a cada pixel)
const [previewPrice, setPreviewPrice] = useState<number | null>(null);

const handleMouseMove = useCallback((y: number): void => {
  setPreviewPrice(config.yToPrice(y));  // ← RE-RENDER
}, [config]);

// DEPOIS (sem re-render, atualiza direto via ref)
const previewPriceRef = useRef<number | null>(null);

const handleMouseMove = useCallback((y: number): void => {
  if (!draggedOrder) return;
  previewPriceRef.current = config.yToPrice(y);
  config.markDirty?.('overlays');  // ← Apenas redesenha canvas
}, [draggedOrder, config]);

// Expor ref value para leitura
return {
  // ...
  previewPrice: previewPriceRef.current,
  getPreviewPrice: () => previewPriceRef.current,
};
```

---

### 3. RAF para Order Drag Rendering

**Arquivo:** `useOrderDragHandler.ts`

```typescript
const rafRef = useRef<number | null>(null);

const handleMouseMove = useCallback((y: number): void => {
  if (!draggedOrder) return;

  // Cancel pending RAF
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
  }

  // Schedule update for next frame
  rafRef.current = requestAnimationFrame(() => {
    previewPriceRef.current = config.yToPrice(y);
    config.markDirty?.('overlays');
    rafRef.current = null;
  });
}, [draggedOrder, config]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };
}, []);
```

---

### 4. Otimizar OverlayLayer.shouldRerender()

**Arquivo:** `OverlayLayer.ts`

```typescript
// ANTES
const shouldRerender = (): boolean => {
  return true;
};

// DEPOIS
private lastMeasurementHash: string | null = null;
private lastOrdersHash: string | null = null;

const shouldRerender = (): boolean => {
  const measurementHash = this.getMeasurementHash();
  const ordersHash = this.getOrdersHash();

  const measurementChanged = measurementHash !== this.lastMeasurementHash;
  const ordersChanged = ordersHash !== this.lastOrdersHash;

  this.lastMeasurementHash = measurementHash;
  this.lastOrdersHash = ordersHash;

  return measurementChanged || ordersChanged;
};

private getMeasurementHash(): string | null {
  if (!this.measurementArea) return null;
  const { startX, startY, endX, endY } = this.measurementArea;
  return `${startX},${startY},${endX},${endY}`;
};
```

---

### 5. Separar Render Effects

**Arquivo:** `ChartCanvas.tsx`

```typescript
// ANTES: 1 effect com 54 deps
useEffect(() => { /* tudo */ }, [/* 54 deps */]);

// DEPOIS: Effects separados por frequência de mudança

// Effect 1: Setup inicial (roda uma vez)
useEffect(() => {
  if (!manager) return;
  // Initial setup
}, [manager]);

// Effect 2: Klines (muda com dados)
useEffect(() => {
  if (!manager) return;
  renderKlines();
}, [manager, klines, renderKlines]);

// Effect 3: Overlays (muda frequentemente)
useEffect(() => {
  if (!manager) return;
  renderOverlays();
}, [manager, measurementArea, orders, renderOverlays]);

// Effect 4: Grid/Watermark (muda raramente)
useEffect(() => {
  if (!manager) return;
  renderGrid();
  renderWatermark();
}, [manager, theme, renderGrid, renderWatermark]);
```

---

### 6. Adicionar markDirty ao OrderDragHandler Config

**Arquivo:** `ChartCanvas.tsx`

```typescript
const orderDragHandler = useOrderDragHandler({
  orders,
  updateOrder,
  priceToY: manager?.priceToY ?? (() => 0),
  yToPrice: manager?.yToPrice ?? (() => 0),
  enabled: true,
  getOrderAtPosition,
  markDirty: (layer) => manager?.markDirty(layer),  // ← NOVO
});
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `useOrderDragHandler.ts` | Trocar useState por useRef, adicionar RAF |
| `useChartInteraction.ts` | Throttle measurement updates |
| `OverlayLayer.ts` | Implementar shouldRerender() com hash comparison |
| `ChartCanvas.tsx` | Separar effects, passar markDirty ao drag handler |

---

## Verificação

### Testes de Performance

- [ ] Profile com React DevTools - verificar re-renders
- [ ] Chrome Performance tab - medir FPS durante:
  - [ ] Drag de measurement area
  - [ ] Drag de ordem SL/TP
  - [ ] Arraste rápido para candles antigos
- [ ] Comparar métricas antes/depois

### Métricas Esperadas

| Cenário | Antes | Depois |
|---------|-------|--------|
| FPS durante measurement drag | ~30 | ~60 |
| FPS durante order drag | ~20-30 | ~60 |
| Re-renders por segundo (drag) | ~60+ | ~1-2 |

### Testes Funcionais

- [ ] Measurement area ainda funciona corretamente
- [ ] Order drag SL/TP salva valores corretos
- [ ] Tooltip mostra informações corretas
- [ ] Sem regressões visuais

---

## Dependências

- Nenhuma dependência de outros planos
- Pode ser implementado primeiro

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Ref não atualiza UI | Baixa | Médio | Garantir markDirty() chamado |
| Race conditions com RAF | Baixa | Baixo | Cancelar RAF pendente antes de novo |
| Hash collision em shouldRerender | Muito baixa | Baixo | Usar hash adequado |
