# 🎨 MarketMind - Theme Colors System

> **Last Updated:** November 16, 2025  
> **Status:** Complete Integration ✅

---

## 📋 Overview

MarketMind uses a comprehensive theme color system built on **Chakra UI v3 semantic tokens**. All colors in the application (UI components and chart elements) are sourced from the theme configuration, ensuring consistent theming across light and dark modes.

### Key Features

- **Single Source of Truth**: All colors defined in `src/renderer/theme/index.ts`
- **Semantic Tokens**: 24+ chart-specific semantic tokens with light/dark variants
- **Reactive Theming**: Chart automatically responds to theme changes
- **Type Safety**: Full TypeScript support with `ChartThemeColors` interface
- **No Hardcoded Colors**: Zero hardcoded color values in components

---

## 🏗 Architecture

### Theme Configuration

**Location:** `src/renderer/theme/index.ts`

```typescript
export const customConfig = createSystem(defaultConfig, {
  theme: {
    semanticTokens: {
      colors: {
        // Chart background
        'chart.background': { 
          value: { base: '#ffffff', _dark: '#1e222d' } 
        },
        
        // Candlestick colors
        'chart.bullish': { 
          value: { base: '#16a34a', _dark: '#26a69a' } 
        },
        'chart.bearish': { 
          value: { base: '#dc2626', _dark: '#ef5350' } 
        },
        
        // Volume colors
        'chart.volume': { 
          value: { base: 'rgba(107, 114, 128, 0.3)', _dark: 'rgba(148, 163, 184, 0.3)' } 
        },
        
        // Grid and axes
        'chart.grid': { 
          value: { base: 'rgba(107, 114, 128, 0.2)', _dark: 'rgba(148, 163, 184, 0.2)' } 
        },
        'chart.axis.label': { 
          value: { base: '#374151', _dark: '#cbd5e1' } 
        },
        'chart.axis.line': { 
          value: { base: 'rgba(107, 114, 128, 0.3)', _dark: 'rgba(148, 163, 184, 0.3)' } 
        },
        
        // Current price line
        'chart.currentPrice.label.bg': { 
          value: { base: '#3b82f6', _dark: '#3b82f6' } 
        },
        'chart.currentPrice.label.text': { 
          value: { base: '#ffffff', _dark: '#ffffff' } 
        },
        'chart.line.default': { 
          value: { base: '#3b82f6', _dark: '#3b82f6' } 
        },
        
        // Moving averages
        'chart.ma.1': { 
          value: { base: '#f59e0b', _dark: '#fbbf24' } 
        },
        'chart.ma.2': { 
          value: { base: '#8b5cf6', _dark: '#a78bfa' } 
        },
        'chart.ma.3': { 
          value: { base: '#ec4899', _dark: '#f472b6' } 
        },
        
        // AI Patterns (8 types)
        'chart.aiPattern.support': { 
          value: { base: '#16a34a', _dark: '#22c55e' } 
        },
        'chart.aiPattern.resistance': { 
          value: { base: '#dc2626', _dark: '#ef4444' } 
        },
        'chart.aiPattern.trendLine': { 
          value: { base: '#3b82f6', _dark: '#60a5fa' } 
        },
        'chart.aiPattern.fibonacci': { 
          value: { base: '#f59e0b', _dark: '#fbbf24' } 
        },
        'chart.aiPattern.pattern': { 
          value: { base: '#8b5cf6', _dark: '#a78bfa' } 
        },
        'chart.aiPattern.priceTarget': { 
          value: { base: '#ec4899', _dark: '#f472b6' } 
        },
        'chart.aiPattern.annotation': { 
          value: { base: '#6b7280', _dark: '#9ca3af' } 
        },
        'chart.aiPattern.zone': { 
          value: { base: 'rgba(59, 130, 246, 0.1)', _dark: 'rgba(96, 165, 250, 0.1)' } 
        },
      },
    },
  },
});
```

### Color Helper Function

The `getChartColors()` helper extracts actual color values from semantic tokens:

```typescript
export const getChartColors = (colorMode: 'light' | 'dark'): ChartColors => {
  const tokens = customConfig.theme?.semanticTokens?.colors || {};
  
  const resolveValue = (token: any): string => {
    if (!token?.value) return '';
    if (typeof token.value === 'string') return token.value;
    return colorMode === 'dark' 
      ? (token.value._dark || token.value.base) 
      : token.value.base;
  };

  return {
    background: resolveValue(tokens['chart.background']),
    bullish: resolveValue(tokens['chart.bullish']),
    bearish: resolveValue(tokens['chart.bearish']),
    // ... all other colors
  };
};
```

**Why this approach?**
- Chakra UI v3 semantic tokens are NOT auto-converted to CSS custom properties
- Canvas API requires actual color values (hex, rgba), not token references
- Direct theme access ensures single source of truth

### React Hook

**Location:** `src/renderer/hooks/useChartColors.tsx`

```typescript
export const useChartColors = (): ChartThemeColors => {
  const { colorMode } = useColorMode();
  
  const colors = useMemo(() => {
    const themeColors = getChartColors(colorMode);
    return themeColors as ChartThemeColors;
  }, [colorMode]);

  return colors;
};
```

**Features:**
- Reactive to theme changes via `colorMode` dependency
- Memoized for performance (only recomputes when theme changes)
- Returns `ChartThemeColors` type for Canvas rendering

---

## 🎨 Color Palettes

### Light Theme

| Element | Color | Hex Value |
|---------|-------|-----------|
| Background | White | `#ffffff` |
| Bullish Candle | Green | `#16a34a` |
| Bearish Candle | Red | `#dc2626` |
| Volume | Gray (30% opacity) | `rgba(107, 114, 128, 0.3)` |
| Grid Lines | Gray (20% opacity) | `rgba(107, 114, 128, 0.2)` |
| Axis Labels | Dark Gray | `#374151` |
| Current Price | Blue | `#3b82f6` |
| MA 1 (9-period) | Amber | `#f59e0b` |
| MA 2 (20-period) | Purple | `#8b5cf6` |
| MA 3 (50-period) | Pink | `#ec4899` |

### Dark Theme

| Element | Color | Hex Value |
|---------|-------|-----------|
| Background | Dark Blue | `#1e222d` |
| Bullish Candle | Teal | `#26a69a` |
| Bearish Candle | Red | `#ef5350` |
| Volume | Slate (30% opacity) | `rgba(148, 163, 184, 0.3)` |
| Grid Lines | Slate (20% opacity) | `rgba(148, 163, 184, 0.2)` |
| Axis Labels | Light Gray | `#cbd5e1` |
| Current Price | Blue | `#3b82f6` |
| MA 1 (9-period) | Amber | `#fbbf24` |
| MA 2 (20-period) | Purple | `#a78bfa` |
| MA 3 (50-period) | Pink | `#f472b6` |

### AI pattern Colors

| pattern Type | Light | Dark |
|------------|-------|------|
| Support | `#16a34a` | `#22c55e` |
| Resistance | `#dc2626` | `#ef4444` |
| Trend Line | `#3b82f6` | `#60a5fa` |
| Fibonacci | `#f59e0b` | `#fbbf24` |
| Pattern | `#8b5cf6` | `#a78bfa` |
| Price Target | `#ec4899` | `#f472b6` |
| Annotation | `#6b7280` | `#9ca3af` |
| Zone | `rgba(59, 130, 246, 0.1)` | `rgba(96, 165, 250, 0.1)` |

---

## 🔧 Usage

### Chart Components

All chart renderers receive colors via the `useChartColors()` hook:

```typescript
// ChartCanvas.tsx
const colors = useChartColors();

<Box bg={colors.background}>
  {/* Chart canvas */}
</Box>

// Pass to renderers
useCandlestickRenderer({ colors, /* ... */ });
useVolumeRenderer({ colors, /* ... */ });
useGridRenderer({ colors, /* ... */ });
```

### Renderer Hooks

```typescript
// useCandlestickRenderer.ts
export const useCandlestickRenderer = ({
  colors, // type: ChartThemeColors
  // ... other params
}: UseCandlestickRendererParams) => {
  // Use colors.bullish, colors.bearish
};
```

### AI pattern Renderer

```typescript
// AIPatternRenderer.tsx
const colors = useChartColors();

const getPatternColor = (type: AIPattern['type']): string => {
  const { aiPattern} = colors;
  const colorMap: Record<AIPattern['type'], string> = {
    'support': aiPattern.support,
    'resistance': aiPattern.resistance,
    'trendLine': aiPattern.trendLine,
    // ... all 8 types
  };
  return colorMap[type];
};
```

### UI Components

UI components use Chakra's semantic tokens directly:

```typescript
// ChartTooltip.tsx
<Box
  bg="bg.muted"
  color="fg"
  borderColor="border"
  borderWidth={1}
>
  <Text color="fg.muted">Label</Text>
  <Text color={isPositive ? 'green.500' : 'red.500'}>Value</Text>
</Box>
```

---

## 📊 Type System

### ChartColors Interface

```typescript
export interface ChartColors {
  background: string;
  bullish: string;
  bearish: string;
  volume: string;
  grid: string;
  axis: {
    label: string;
    line: string;
  };
  currentPrice: {
    label: {
      bg: string;
      text: string;
    };
  };
  line: {
    default: string;
  };
  ma: {
    1: string;
    2: string;
    3: string;
  };
  aiPattern: {
    support: string;
    resistance: string;
    trendLine: string;
    fibonacci: string;
    pattern: string;
    priceTarget: string;
    annotation: string;
    zone: string;
  };
}
```

### ChartThemeColors Type

```typescript
export type ChartThemeColors = ChartColors;
```

Used by all chart renderers to ensure type safety when accessing theme colors.

---

## 🔄 Migration from Hardcoded Colors

### Before (Hardcoded)

```typescript
// chartConfig.ts
export const CHART_COLORS_DARK = {
  background: '#1e222d',
  bullish: '#26a69a',
  bearish: '#ef5350',
  // ...
};

export const CHART_COLORS_LIGHT = {
  background: '#ffffff',
  bullish: '#16a34a',
  bearish: '#dc2626',
  // ...
};

// Component
const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
```

### After (Theme Integration)

```typescript
// theme/index.ts
semanticTokens: {
  colors: {
    'chart.background': { value: { base: '#ffffff', _dark: '#1e222d' } },
    'chart.bullish': { value: { base: '#16a34a', _dark: '#26a69a' } },
    'chart.bearish': { value: { base: '#dc2626', _dark: '#ef5350' } },
  }
}

// Component
const colors = useChartColors(); // Reactive to theme changes
```

### Files Modified

**Removed Constants:**
- `src/shared/constants/chartConfig.ts` - Removed `CHART_COLORS_DARK`, `CHART_COLORS_LIGHT`, `MA_COLORS`
- `src/shared/types/aiPattern.ts` - Removed `AI_PATTERN_COLORS` export

**Updated Components:**
- `src/renderer/components/Chart/ChartCanvas.tsx` - Uses `useChartColors()`
- `src/renderer/components/Chart/ChartTooltip.tsx` - Uses semantic tokens
- `src/renderer/components/Chart/ChartControls.tsx` - Uses semantic tokens
- `src/renderer/components/Chart/ControlPanel.tsx` - Uses semantic tokens
- `src/renderer/components/Chart/AIPatternRenderer.tsx` - Uses `useChartColors()`

**Updated Renderers (8 files):**
- `useCandlestickRenderer.ts`
- `useVolumeRenderer.ts`
- `useGridRenderer.ts`
- `useLineChartRenderer.ts`
- `useCurrentPriceLineRenderer.ts`
- `useMovingAverageRenderer.ts`
- `useLineRenderer.ts`
- `useMovingAverageWorker.ts`

All changed from `ChartColors` to `ChartThemeColors` type parameter.

---

## 🎯 Best Practices

### Adding New Chart Colors

1. **Add Semantic Token** in `theme/index.ts`:
```typescript
'chart.newElement': { 
  value: { base: '#lightColor', _dark: '#darkColor' } 
}
```

2. **Update `getChartColors()`**:
```typescript
return {
  // ... existing colors
  newElement: resolveValue(tokens['chart.newElement']),
};
```

3. **Update `ChartColors` Interface** in `src/shared/types/chart.ts`:
```typescript
export interface ChartColors {
  // ... existing properties
  newElement: string;
}
```

4. **Use in Components**:
```typescript
const colors = useChartColors();
ctx.fillStyle = colors.newElement;
```

### Adding New UI Colors

For UI components (non-canvas), add directly to Chakra's semantic tokens:

```typescript
semanticTokens: {
  colors: {
    'ui.special': { value: { base: '#lightColor', _dark: '#darkColor' } }
  }
}
```

Use in components:
```tsx
<Box bg="ui.special">Content</Box>
```

### Color Naming Convention

- **Chart elements**: `chart.*` prefix
- **UI elements**: Chakra's built-in tokens (`bg.*`, `fg.*`, `border`)
- **Nested properties**: Dot notation (`chart.axis.label`)
- **Variants**: Numbered suffix (`chart.ma.1`, `chart.ma.2`)

---

## 🐛 Troubleshooting

### Colors Not Updating

**Problem:** Chart colors don't change when switching themes

**Solution:** Ensure `colorMode` is a dependency in `useMemo`:
```typescript
const colors = useMemo(() => {
  return getChartColors(colorMode);
}, [colorMode]); // Must include colorMode!
```

### Canvas Shows Black Colors

**Problem:** Canvas elements render as black

**Cause:** Trying to use token references (e.g., `"var(--chakra-colors-chart-background)"`) instead of actual values

**Solution:** Use `getChartColors()` helper which extracts actual hex/rgba values:
```typescript
const colors = useChartColors(); // Returns actual values
ctx.fillStyle = colors.background; // '#ffffff' or '#1e222d'
```

### TypeScript Errors

**Problem:** Type mismatch between `ChartColors` and `ChartThemeColors`

**Solution:** Ensure all renderers use `ChartThemeColors`:
```typescript
// ✅ Correct
interface Params {
  colors: ChartThemeColors;
}

// ❌ Wrong
interface Params {
  colors: ChartColors;
}
```

---

## 📚 References

- [Chakra UI v3 Semantic Tokens](https://chakra-ui.com/docs/styled-system/semantic-tokens)
- [Chakra UI Color Mode](https://chakra-ui.com/docs/styled-system/color-mode)
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

**Last Updated:** November 16, 2025  
**Maintained by:** Nathan Santos  
**Status:** ✅ Complete & Production Ready
