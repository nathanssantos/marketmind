# 🤖 AI Assistant Context - MarketMind Project

## 📋 Project Overview

**MarketMind** is an Electron-based desktop application that combines advanced financial chart visualization (candlesticks) with AI analysis to provide insights on cryptocurrencies, stocks, and other tradeable assets.

### Tech Stack
- **TypeScript** (end-to-end with unified typing)
- **Electron** (desktop framework)
- **React 18+** (UI framework)
- **Chakra UI** (component library with light/dark mode)
- **Canvas API** (high-performance chart rendering)
- **Vite** (build tool)

### Repository Info
- **Name:** nathanssantos/marketmind
- **Visibility:** Private
- **Main Branch:** `main` (production, protected)
- **Default Branch:** `develop` (development)

---

## 🎯 Development Guidelines

### Dependencies and Libraries

#### 1. **Always Use Latest Versions**
- ✅ Keep all dependencies updated to their latest stable/LTS versions
- ✅ Run `yarn upgrade --latest` regularly
- ✅ Check for major version updates and breaking changes
- ✅ Consult official documentation for migration guides

#### 2. **Consult Official Documentation**
- ✅ Always check official docs before implementing features
- ✅ Follow best practices recommended by library maintainers
- ✅ Use recommended patterns and APIs
- ✅ Stay updated with deprecation notices

#### 3. **Maintain Changelog**
- ✅ Update CHANGELOG.md with every significant change
- ✅ Follow Keep a Changelog format
- ✅ Categorize changes: Added, Changed, Deprecated, Removed, Fixed, Security
- ✅ Document breaking changes clearly
- ✅ Update version numbers following Semantic Versioning

### Code Quality Standards

#### 4. **No Comments in Code**
- ❌ Don't add inline comments
- ✅ Create and update README files in feature folders
- ✅ Use self-documenting code (clear variable/function names)

```typescript
// ❌ Bad
// Calculate the simple moving average
const sma = candles.reduce((sum, c) => sum + c.close, 0) / candles.length;

// ✅ Good
const calculateSimpleMovingAverage = (candles: Candle[]): number => {
  const sum = candles.reduce((total, candle) => total + candle.close, 0);
  return sum / candles.length;
};
```

#### 5. **Magic Numbers & Constants**
- ❌ Never hardcode values in logic
- ✅ Always extract to separate configuration files

```typescript
// ❌ Bad
if (volume > 1000000) {
  // ...
}

// ✅ Good - src/shared/constants/chartConfig.ts
export const CHART_CONFIG = {
  VOLUME_THRESHOLD: 1_000_000,
  DEFAULT_MA_PERIODS: [20, 50, 200],
  CANVAS_PADDING: 20,
} as const;

// Usage
if (volume > CHART_CONFIG.VOLUME_THRESHOLD) {
  // ...
}
```

#### 6. **TypeScript - No `any`**
- ❌ Never use `any`
- ✅ Use proper types, `unknown`, or generics

```typescript
// ❌ Bad
const parseData = (data: any) => { ... }

// ✅ Good
const parseData = <T>(data: unknown): T => {
  // Type guards and validation
}

// Or with specific type
const parseData = (data: unknown): CandleData => {
  if (!isCandleData(data)) {
    throw new Error('Invalid data');
  }
  return data;
}
```

#### 7. **Global Types**
- ✅ Use shared types from `src/shared/types/`
- ✅ Export and reuse types across main and renderer processes

```typescript
// ✅ src/shared/types/candle.ts
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Use in both main and renderer
import type { Candle } from '@shared/types';
```

#### 8. **Simplified Conditionals**
- ✅ One-line ifs when possible
- ✅ Use ternary operators for simple conditions

```typescript
// ❌ Bad
if (isDarkMode) {
  backgroundColor = '#1e222d';
} else {
  backgroundColor = '#ffffff';
}

// ✅ Good
const backgroundColor = isDarkMode ? '#1e222d' : '#ffffff';

// One-line if
if (candles.length === 0) return null;
```

#### 9. **Early Returns**
- ✅ Always prefer early returns over nested ifs
- ✅ Reduce indentation and improve readability

```typescript
// ❌ Bad
const processCandle = (candle: Candle | null) => {
  if (candle) {
    if (candle.volume > 0) {
      if (candle.close > candle.open) {
        return 'bullish';
      }
    }
  }
  return 'unknown';
}

// ✅ Good
const processCandle = (candle: Candle | null): string => {
  if (!candle) return 'unknown';
  if (candle.volume === 0) return 'unknown';
  if (candle.close <= candle.open) return 'unknown';
  
  return 'bullish';
}
```

#### 10. **Responsive Design**
- ✅ Always consider responsiveness
- ✅ Use Chakra UI responsive props
- ✅ Canvas should adapt to window resize

```typescript
// ✅ Chakra UI responsive
<Box
  width={{ base: '100%', md: '80%', lg: '60%' }}
  padding={{ base: 2, md: 4, lg: 6 }}
>
  {content}
</Box>

// ✅ Canvas resize handling
useEffect(() => {
  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    redraw();
  };
  
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Git Workflow

#### Commit Messages (Always in English)
```bash
# ✅ Good
git commit -m "feat: add candlestick rendering"
git commit -m "fix: correct moving average calculation"
git commit -m "docs: update chart component README"
git commit -m "refactor: simplify canvas drawing logic"
git commit -m "perf: optimize chart rendering performance"

# ❌ Bad
git commit -m "adiciona renderização"
git commit -m "corrige bug"
```

#### Conventional Commits
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code formatting (not UI)
- `refactor:` - Code restructuring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes
- `build:` - Build system changes

#### Branch Strategy
```bash
main              # Production (protected)
  ← develop       # Development (default)
      ← feature/chart-rendering
      ← feature/ai-integration
      ← bugfix/canvas-resize
      ← hotfix/critical-bug
```

### Documentation (Always in English)

#### README Structure for Features
```markdown
# Feature Name

## Overview
Brief description of what this feature does.

## Architecture
How it's structured and integrated.

## Components
List of main components/files.

## Usage
Code examples.

## API Reference
If applicable.

## Performance Considerations
Any optimizations or concerns.
```

---

## 📁 Project Structure

```
marketmind/
├── src/
│   ├── main/                      # Electron main process
│   ├── renderer/                  # React app
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── theme/
│   └── shared/                    # Shared code (types, constants)
│       ├── types/
│       └── constants/
├── scripts/                       # Build and utility scripts
├── docs/                          # Documentation
└── PLANO_IMPLEMENTACAO.md        # Implementation roadmap
```

---

## 🚀 Starting a New Chat

### Context to Provide

When starting a new chat due to context limits, provide:

1. **This document** (`AI_CONTEXT.md`)
2. **Current phase** from `PLANO_IMPLEMENTACAO.md`
3. **Files already created** (list main ones)
4. **Current task** or issue

### Example Prompt

```
I'm working on MarketMind following AI_CONTEXT.md guidelines.

Key Guidelines:
- Always use latest versions of libraries
- Consult official documentation for best practices
- Update CHANGELOG.md with every significant change
- No comments in code (use READMEs)
- No magic numbers (extract to constants)
- No `any` types
- Early returns over nested ifs
- One-line conditionals when possible
- Responsive design
- Commits in English
- Documentation in English

Current Status:
- Phase: 3 (Chart Rendering System)
- Completed: Project setup, type system
- Current Branch: feature/chart-rendering
- Working on: CandlestickRenderer component

Next Task: Implement zoom and pan functionality for the chart canvas.

Please help with [specific request].
```

---

## 🎨 Code Style Patterns

### Function Declarations

```typescript
// ✅ Prefer arrow functions for consistency
const calculateSMA = (candles: Candle[], period: number): number => {
  // Implementation
};

// ✅ Use function keyword for React components (better stack traces)
function ChartCanvas({ data }: ChartCanvasProps) {
  // Component
}
```

### Error Handling

```typescript
// ✅ Early validation with descriptive errors
const processData = (data: unknown): ProcessedData => {
  if (!data) {
    throw new Error('Data is required');
  }
  
  if (!isValidData(data)) {
    throw new Error('Invalid data format');
  }
  
  return transformData(data);
};
```

### Async/Await

```typescript
// ✅ Always use try/catch with async
const fetchCandles = async (symbol: string): Promise<Candle[]> => {
  try {
    const response = await api.get(`/candles/${symbol}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch candles:', error);
    throw new Error(`Failed to fetch candles for ${symbol}`);
  }
};
```

### React Hooks

```typescript
// ✅ Custom hooks for reusable logic
const useChartData = (symbol: string) => {
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const candles = await fetchCandles(symbol);
        setData(candles);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [symbol]);
  
  return { data, loading, error };
};
```

---

## 🔧 Performance Guidelines

### Canvas Optimization

```typescript
// ✅ Only redraw visible area
const drawVisibleCandles = (ctx: CanvasRenderingContext2D) => {
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.ceil(viewport.end);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);
  
  visibleCandles.forEach(drawCandle);
};

// ✅ Use requestAnimationFrame for smooth animations
const animate = () => {
  if (!animationNeeded) return;
  
  requestAnimationFrame(animate);
  draw();
};

// ✅ Debounce expensive operations
const debouncedResize = useMemo(
  () => debounce(handleResize, 150),
  []
);
```

### Memory Management

```typescript
// ✅ Clean up resources
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  return () => {
    // Cleanup
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };
}, []);
```

---

## 📊 State Management

### Zustand Store Pattern

```typescript
// ✅ src/renderer/store/chartStore.ts
import { create } from 'zustand';
import type { Candle } from '@shared/types';

interface ChartState {
  candles: Candle[];
  loading: boolean;
  error: Error | null;
  
  // Actions
  setCandles: (candles: Candle[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useChartStore = create<ChartState>((set) => ({
  candles: [],
  loading: false,
  error: null,
  
  setCandles: (candles) => set({ candles }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

---

## 🧪 Testing Approach

```typescript
// ✅ Test utilities and calculations
describe('calculateSMA', () => {
  it('should calculate simple moving average correctly', () => {
    const candles: Candle[] = [
      { close: 100, /* ... */ },
      { close: 110, /* ... */ },
      { close: 120, /* ... */ },
    ];
    
    const result = calculateSMA(candles, 3);
    expect(result).toBe(110);
  });
  
  it('should return 0 for empty array', () => {
    const result = calculateSMA([], 20);
    expect(result).toBe(0);
  });
});
```

---

## 📚 Key Files Reference

### Configuration
- `PLANO_IMPLEMENTACAO.md` - Full implementation roadmap
- `AI_CONTEXT.md` - This file
- `README.md` - Project overview

### Documentation
- `docs/GIT_COMMANDS.md` - Git and GitHub CLI reference
- `scripts/README.md` - Available scripts documentation

### Scripts
- `scripts/setup-github.sh` - GitHub repository setup
- `scripts/install-hooks.sh` - Git hooks installation

---

## 🎯 Current Development Phase

Track progress in `PLANO_IMPLEMENTACAO.md`. Update this section when starting new chats:

**Current Phase:** [To be updated]
**Current Tasks:** [To be updated]
**Blockers:** [To be updated]

---

## 💡 Quick Reference

### File Naming
- Components: PascalCase (`ChartCanvas.tsx`)
- Utilities: camelCase (`drawingUtils.ts`)
- Types: camelCase (`candle.ts`)
- Constants: camelCase (`chartConfig.ts`)

### Import Order
```typescript
// 1. External dependencies
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';

// 2. Internal absolute imports
import type { Candle } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';

// 3. Relative imports
import { calculateSMA } from './utils';
import type { ChartProps } from './types';
```

### Type Exports
```typescript
// ✅ Use 'import type' for type-only imports
import type { Candle } from '@shared/types';

// ✅ Export types alongside implementation
export interface ChartProps {
  data: Candle[];
}

export const Chart = (props: ChartProps) => {
  // Implementation
};
```

---

## 🔄 Workflow Checklist

Before committing:
- [ ] Using latest library versions
- [ ] Consulted official documentation
- [ ] Updated CHANGELOG.md with changes
- [ ] No `any` types used
- [ ] No magic numbers (extracted to constants)
- [ ] No inline comments (updated README instead)
- [ ] Early returns used where applicable
- [ ] One-line conditionals where possible
- [ ] Responsive design considered
- [ ] Commit message in English
- [ ] Code follows patterns above

---

**Last Updated:** November 14, 2025
**Version:** 1.0
