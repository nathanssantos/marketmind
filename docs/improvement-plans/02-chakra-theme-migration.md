# Plano de Melhoria: Migração de Cores para Tema Chakra

## 1. Estado Atual

### 1.1 Auditoria de Cores Hardcoded

**Total: 158 ocorrências em 38 arquivos**

| Categoria | Ocorrências | Arquivos |
|-----------|-------------|----------|
| Hex (#xxx) | 80 | 38 |
| RGBA/RGB | 74 | 14 |
| Inline Styles | 4 | 2 |

### 1.2 Arquivos Permitidos (Exceções)

- `theme/index.ts` - Definição dos tokens
- `constants/preReactColors.ts` - Cores antes do React carregar
- `constants/defaults.ts` - Fallbacks de cores

### 1.3 Tokens Semânticos Existentes

```typescript
// Background
'bg.panel', 'bg.surface', 'bg.muted'

// Foreground
'fg', 'fg.muted'

// Chart (50+ tokens)
'chart.bullish', 'chart.bearish', 'chart.volume'
'chart.ma.1-8', 'chart.rsi.*', 'chart.macd.*', etc.
```

### 1.4 Tokens Criados nesta Revisão

```typescript
// Trading
'trading.profit', 'trading.loss', 'trading.neutral'
'trading.warning', 'trading.info', 'trading.long', 'trading.short'

// UI States
'bg.loading', 'bg.error', 'bg.success', 'bg.warning'
'overlay.dark', 'overlay.light'

// Canvas
'canvas.text', 'canvas.priceTag.bullish', 'canvas.priceTag.bearish'
'canvas.priceTag.info', 'canvas.priceTag.neutral'
```

---

## 2. Análise Acadêmica

### 2.1 Design Tokens - Teoria

**Referências:**
- "Design Tokens: A Complete Guide" (Jina Anne, Salesforce)
- "Theming with Design Tokens" (Nathan Curtis, EightShapes)
- W3C Design Tokens Community Group Specification

**Benefícios de Design Tokens:**

1. **Consistência Visual**
   - Cores consistentes em todo o app
   - Fácil manutenção de marca

2. **Theming**
   - Dark/Light mode automático
   - Temas customizados

3. **Acessibilidade**
   - Contraste garantido por token
   - WCAG compliance

4. **Performance**
   - CSS Variables nativas
   - Sem recálculo de estilos

### 2.2 Color Theory para Trading

**Referências:**
- "The Psychology of Color in Marketing" (Neil Patel)
- "Color in Financial Visualization" (Stephen Few)
- "Designing Data Visualizations" (O'Reilly)

**Convenções de Mercado:**

| Cor | Significado | Hex Light | Hex Dark |
|-----|-------------|-----------|----------|
| Verde | Bullish/Profit | #16a34a | #22c55e |
| Vermelho | Bearish/Loss | #dc2626 | #ef4444 |
| Azul | Info/Neutral | #2563eb | #3b82f6 |
| Amarelo | Warning | #f59e0b | #fbbf24 |
| Cinza | Neutral | #64748b | #94a3b8 |

**Acessibilidade:**
- Contraste mínimo 4.5:1 para texto (WCAG AA)
- Contraste mínimo 3:1 para elementos gráficos
- Não depender apenas de cor para significado

---

## 3. Benchmarking de Mercado

### 3.1 TradingView Color System

- Palette limitada e consistente
- Cores semânticas para ações
- Suporte a temas escuros/claros
- Cores de indicadores customizáveis

### 3.2 Bloomberg Terminal

- Esquema de cores icônico (verde/amber)
- Alto contraste para legibilidade
- Cores funcionais sobre estéticas

### 3.3 Figma Design Tokens

- Tokens em 3 níveis: primitivo, semântico, componente
- Alias tokens para context-awareness
- Suporte a múltiplos temas

---

## 4. Problemas Identificados

### 4.1 Cores Hardcoded em Renderers

**34 arquivos de renderer com cores hardcoded:**

```
useADXRenderer.ts, useAORenderer.ts, useATRRenderer.ts,
useAroonRenderer.ts, useCCIRenderer.ts, useCMFRenderer.ts,
useCMORenderer.ts, useDEMARenderer.ts, useDonchianRenderer.ts,
useElderRayRenderer.ts, useHMARenderer.ts, useIchimokuRenderer.ts,
useKeltnerRenderer.ts, useKlineRenderer.ts, useKlingerRenderer.ts,
useLineRenderer.ts, useMFIRenderer.ts, useOBVRenderer.ts,
useOrderLinesRenderer.ts, usePPORenderer.ts, useParabolicSARRenderer.ts,
useROCRenderer.ts, useSupertrendRenderer.ts, useTEMARenderer.ts,
useTSIRenderer.ts, useUltimateOscRenderer.ts, useVWAPRenderer.ts,
useVortexRenderer.ts, useWMARenderer.ts, useWilliamsRRenderer.ts
```

### 4.2 Padrões Inconsistentes

1. **Alguns renderers usam `getChartColors`**, outros não
2. **Mistura de hex e rgba** no mesmo arquivo
3. **Cores duplicadas** entre renderers similares

### 4.3 Canvas vs React

- Canvas não tem acesso direto aos tokens Chakra
- Precisa de função bridge (`getChartColors`)
- Cores precisam ser resolvidas em runtime

---

## 5. Melhorias Propostas

### 5.1 Estrutura de Tokens

```typescript
// theme/tokens.ts
export const tokens = {
  // Primitives (raw colors)
  colors: {
    green: { 50: '...', 100: '...', ..., 900: '...' },
    red: { 50: '...', 100: '...', ..., 900: '...' },
    // ...
  },

  // Semantic (context-aware)
  semantic: {
    trading: {
      profit: { light: 'green.600', dark: 'green.500' },
      loss: { light: 'red.600', dark: 'red.500' },
      // ...
    },
    chart: {
      bullish: { light: 'green.600', dark: 'green.400' },
      bearish: { light: 'red.600', dark: 'red.400' },
      // ...
    },
  },

  // Component-specific
  components: {
    priceTag: {
      bullish: { bg: 'trading.profit', text: 'white' },
      bearish: { bg: 'trading.loss', text: 'white' },
    },
  },
};
```

### 5.2 Helper Functions

```typescript
// theme/helpers.ts

// Para canvas
export const getChartColors = (colorMode: 'light' | 'dark') => ({
  bullish: colorMode === 'dark' ? '#22c55e' : '#16a34a',
  bearish: colorMode === 'dark' ? '#ef4444' : '#dc2626',
  // ...
});

// Para componentes React
export const useChartColors = () => {
  const { colorMode } = useColorMode();
  return useMemo(() => getChartColors(colorMode), [colorMode]);
};

// Para PnL
export const getPnLColor = (value: number, colorMode: 'light' | 'dark') => {
  if (value > 0) return colorMode === 'dark' ? '#22c55e' : '#16a34a';
  if (value < 0) return colorMode === 'dark' ? '#ef4444' : '#dc2626';
  return colorMode === 'dark' ? '#94a3b8' : '#64748b';
};
```

### 5.3 Migração de Renderers

**Padrão atual (ruim):**
```typescript
export const useADXRenderer = () => {
  const render = (ctx, data) => {
    ctx.strokeStyle = '#f59e0b'; // hardcoded
    // ...
  };
};
```

**Padrão proposto (bom):**
```typescript
export const useADXRenderer = (colors: ChartColors) => {
  const render = (ctx, data) => {
    ctx.strokeStyle = colors.adx.adxLine;
    // ...
  };
};
```

---

## 6. Plano de Implementação

### Fase 1: Infraestrutura (Concluída)

- [x] Adicionar tokens semânticos ao tema
- [x] Criar `getTradingColors()`
- [x] Criar `getCanvasColors()`
- [x] Criar `getPnLColor()`
- [x] Criar `getSideColor()`

### Fase 2: Utilitários Canvas (1 semana)

| Arquivo | Ação |
|---------|------|
| `priceTagUtils.ts` | Usar `getCanvasColors` |
| `drawingUtils.ts` | Usar `getCanvasColors` |
| `panelUtils.ts` | Usar `getChartColors` |

### Fase 3: Renderers de Indicadores (2 semanas)

**Batch 1 - Indicadores com cores no tema:**
- useKlineRenderer, useVolumeRenderer
- useBollingerBandsRenderer, useKeltnerRenderer
- useDonchianRenderer, useIchimokuRenderer

**Batch 2 - Oscillators:**
- useRSIRenderer, useStochasticRenderer
- useCCIRenderer, useWilliamsRRenderer
- useMACDRenderer, useADXRenderer

**Batch 3 - Trend/MA:**
- useSupertrendRenderer, useParabolicSARRenderer
- useDEMARenderer, useTEMARenderer, useHMARenderer, useWMARenderer

**Batch 4 - Volume/Momentum:**
- useOBVRenderer, useCMFRenderer, useMFIRenderer
- useAORenderer, usePPORenderer, useROCRenderer

**Batch 5 - Misc:**
- useFibonacciRenderer, useFibonacciProjectionRenderer
- useFVGRenderer, useLiquidityLevelsRenderer
- usePivotPointsRenderer, useOrderLinesRenderer

### Fase 4: Validação (1 semana)

- Executar script de auditoria
- Verificar todos os temas (light/dark)
- Testar acessibilidade (contraste)

---

## 7. Critérios de Validação

### 7.1 Auditoria

```bash
# Deve retornar 0
./scripts/audit-hardcoded-colors.sh
# Total de cores hardcoded: 0
```

### 7.2 Temas

- [ ] Light mode renderiza corretamente
- [ ] Dark mode renderiza corretamente
- [ ] Transição suave entre temas
- [ ] Gráficos respeitam tema

### 7.3 Acessibilidade

- [ ] Contraste AA (4.5:1) para texto
- [ ] Contraste 3:1 para elementos gráficos
- [ ] Sem dependência apenas de cor

### 7.4 Performance

- [ ] Sem flicker na troca de tema
- [ ] CSS Variables em vez de JS
- [ ] Memoização de cores resolvidas

---

## 8. Arquivos a Modificar

### Alta Prioridade

1. `utils/canvas/priceTagUtils.ts`
2. `utils/canvas/drawingUtils.ts`
3. `components/Chart/indicators/panelUtils.ts`
4. `components/Trading/BacktestChart.tsx`

### Média Prioridade (34 renderers)

Ver lista completa na seção 4.1

### Baixa Prioridade

1. `components/Chart/ChartCanvas.tsx` (após decomposição)
2. `components/Chart/layers/*.ts`
