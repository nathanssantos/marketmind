# 🤖 AI Assistant Context - MarketMind Project

## 📋 Project Overview

**MarketMind** is an Electron-based desktop application that combines advanced financial chart visualization (candlesticks) with AI analysis to provide insights on cryptocurrencies, stocks, and other tradeable assets.

### Tech Stack
- **TypeScript** (end-to-end with unified typing)
- **Electron** (desktop framework)
- **React 19** (UI framework)
- **Chakra UI** (component library with light/dark mode)
- **Canvas API** (high-performance chart rendering)
- **Vite** (build tool)

### Repository Info
- **Name:** nathanssantos/marketmind
- **Visibility:** Private
- **Main Branch:** `main` (production, protected)
- **Default Branch:** `develop` (development)
- **Branch Strategy:** Always create feature/bugfix branches for new work

---

## 🎯 Development Guidelines

### Core Rules
1. **Latest Versions:** Keep all dependencies updated, check official docs for breaking changes
2. **Official Documentation:** Always consult library docs before implementing features
3. **Changelog:** Update CHANGELOG.md with every significant change (Keep a Changelog format)
4. **No Comments:** Use self-documenting code and README files instead
5. **No Magic Numbers:** Extract all hardcoded values to constants files
6. **No `any` Types:** Use proper types, `unknown`, or generics
7. **Early Returns:** Prefer early returns over nested ifs for better readability
8. **One-Line Conditionals:** Use ternary operators for simple conditions
9. **Responsive Design:** Always consider mobile/tablet/desktop viewports
10. **English Only:** All commits, docs, and code in English
11. **Branch Workflow:** Create feature/bugfix branches, never commit directly to main/develop
12. **Implementation Plan:** Follow and evolve IMPLEMENTATION_PLAN.md as the project progresses

### Git Workflow

```bash
develop                # Never commit directly here
  ← feature/chart-rendering
  ← feature/ai-integration
  ← bugfix/canvas-resize
  ← hotfix/critical-bug

# Always create branches for new work
git checkout develop
git pull origin develop
git checkout -b feature/new-feature
# ... work and commits ...
git push origin feature/new-feature
# Open PR to develop
```

### Conventional Commits (English)
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code restructuring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

### Code Examples

```typescript
const calculateSMA = (candles: Candle[], period: number): number => {
  if (candles.length === 0) return 0;
  const sum = candles.reduce((total, c) => total + c.close, 0);
  return sum / candles.length;
};

const backgroundColor = isDarkMode ? '#1e222d' : '#ffffff';

export const CHART_CONFIG = {
  VOLUME_THRESHOLD: 1_000_000,
  DEFAULT_MA_PERIODS: [20, 50, 200],
  CANVAS_PADDING: 20,
} as const;

import type { Candle } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { calculateSMA } from './utils';
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
└── IMPLEMENTATION_PLAN.md         # Implementation roadmap
```

---

## 🚀 Starting a New Chat

When starting a new chat due to context limits, provide:

1. **This document** (`AI_CONTEXT.md`)
2. **Current phase** from `IMPLEMENTATION_PLAN.md`
3. **Current branch** and feature being worked on
4. **Files already created** (list main ones)
5. **Current task** or issue

Example:
```
Working on MarketMind following AI_CONTEXT.md.

Status:
- Phase: 3 (Chart Rendering)
- Branch: feature/chart-rendering
- Completed: Project setup, type system, Electron base
- Current: CandlestickRenderer component
- Next: Implement zoom/pan for chart canvas

Task: [specific request]
```

---

## 🎨 Project Patterns

### File Naming
- Components: PascalCase (`ChartCanvas.tsx`)
- Utilities: camelCase (`drawingUtils.ts`)
- Types: camelCase (`candle.ts`)
- Constants: camelCase (`chartConfig.ts`)

### Import Order
```typescript
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';
import type { Candle } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { calculateSMA } from './utils';
```

### Function Style
```typescript
const utils = (param: Type): ReturnType => { };

function Component({ prop }: Props) { }
```

### Error Handling
```typescript
const fetchData = async (id: string): Promise<Data> => {
  if (!id) throw new Error('ID is required');
  
  try {
    const response = await api.get(`/data/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw new Error(`Failed to fetch data for ${id}`);
  }
};
```

### React Hooks
```typescript
const useData = (id: string) => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchData(id);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);
  
  return { data, loading, error };
};
```

### Zustand Store
```typescript
import { create } from 'zustand';

interface State {
  data: Data[];
  loading: boolean;
  setData: (data: Data[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<State>((set) => ({
  data: [],
  loading: false,
  setData: (data) => set({ data }),
  setLoading: (loading) => set({ loading }),
}));
```

---

## 🔧 Performance & Optimization

### Canvas Rendering
```typescript
const drawVisible = (ctx: CanvasRenderingContext2D) => {
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.ceil(viewport.end);
  const visible = candles.slice(visibleStart, visibleEnd);
  visible.forEach(drawCandle);
};

const animate = () => {
  if (!animationNeeded) return;
  requestAnimationFrame(animate);
  draw();
};

const debouncedResize = useMemo(() => debounce(handleResize, 150), []);
```

### Memory Cleanup
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  return () => {
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
- `IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `AI_CONTEXT.md` - This file
- `README.md` - Project overview

### Documentation
- `docs/GIT_COMMANDS.md` - Git and GitHub CLI reference
- `scripts/README.md` - Available scripts documentation

### Scripts
- `scripts/setup-github.sh` - GitHub repository setup
- `scripts/install-hooks.sh` - Git hooks installation

---

## 📊 Current Development Phase

Track progress in `IMPLEMENTATION_PLAN.md`. Update this section when starting new chats:

**Current Phase:** Phase 7 - Settings System (COMPLETED)
**Overall Progress:** 78% (7/13 phases complete)
**Current Tasks:** Ready to start Phase 8 (News Integration)
**Recent Completion:** Secure API key storage with platform-native encryption
**Blockers:** None

### Phase 7 Highlights
- Implemented electron-store for persistent storage
- Platform-native encryption (Keychain/DPAPI/libsecret)
- Multi-provider support (OpenAI, Anthropic, Gemini)
- Automatic migration from localStorage
- 7 IPC handlers for secure operations
- useSecureStorage React hook
- Updated AIConfigTab with encrypted inputs

---

## 🔒 Security Best Practices

### API Key Management
```typescript
// ✅ NEVER store API keys in code or localStorage directly
// ✅ Use Electron's secure storage with platform-native encryption

// Main Process - StorageService.ts
import { safeStorage } from 'electron';
import Store from 'electron-store';

class StorageService {
  private store: Store;
  
  setApiKey(provider: AIProvider, key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }
    const encrypted = safeStorage.encryptString(key);
    this.store.set(`apiKeys.${provider}`, encrypted.toString('base64'));
  }
  
  getApiKey(provider: AIProvider): string | null {
    const encryptedBase64 = this.store.get(`apiKeys.${provider}`) as string;
    if (!encryptedBase64) return null;
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  }
}
```

### IPC Communication Pattern
```typescript
// Preload Script - Secure API exposure
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  secureStorage: {
    setApiKey: (provider: AIProvider, key: string) => 
      ipcRenderer.invoke('storage:setApiKey', provider, key),
    getApiKey: (provider: AIProvider) => 
      ipcRenderer.invoke('storage:getApiKey', provider),
  }
});

// Main Process - IPC handlers
ipcMain.handle('storage:setApiKey', async (_, provider, key) => {
  try {
    storageService.setApiKey(provider, key);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Renderer Process - React Hook
const useSecureStorage = () => {
  const setApiKey = async (provider: AIProvider, key: string) => {
    const result = await window.electron.secureStorage.setApiKey(provider, key);
    if (!result.success) throw new Error(result.error);
  };
  
  return { setApiKey, getApiKey, /* ... */ };
};
```

### Migration Pattern
```typescript
// ✅ Migrate legacy data to secure storage on startup
const migrateApiKeys = async () => {
  const legacy = localStorage.getItem('marketmind-ai-storage');
  if (!legacy) return;
  
  try {
    const data = JSON.parse(legacy);
    
    // Migrate each provider's key
    if (data.openaiKey) {
      await window.electron.secureStorage.setApiKey('openai', data.openaiKey);
    }
    if (data.anthropicKey) {
      await window.electron.secureStorage.setApiKey('anthropic', data.anthropicKey);
    }
    
    // Remove legacy storage
    localStorage.removeItem('marketmind-ai-storage');
    
    // Mark migration complete
    localStorage.setItem('migration-status', JSON.stringify({
      version: '0.8.0',
      migratedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Run migration on app startup
useEffect(() => {
  const runMigrations = async () => {
    const status = localStorage.getItem('migration-status');
    if (!status) await migrateApiKeys();
  };
  runMigrations();
}, []);
```

### Environment Variables
```typescript
// ✅ Use environment variables for development only
// ✅ NEVER commit .env files to git

// .env (gitignored)
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_GEMINI_API_KEY=...

// Access in renderer
const envKey = import.meta.env.VITE_OPENAI_API_KEY;

// Auto-fill for development convenience
useEffect(() => {
  const savedKey = await getApiKey('openai');
  if (!savedKey && envKey) {
    setApiKey('openai', envKey); // Store securely
  }
}, []);
```

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
- [ ] Created feature/bugfix branch (never commit to main/develop)
- [ ] Using latest library versions
- [ ] Consulted official documentation
- [ ] Updated CHANGELOG.md
- [ ] Updated IMPLEMENTATION_PLAN.md progress if applicable
- [ ] No `any` types
- [ ] No magic numbers (extracted to constants)
- [ ] No inline comments (README instead)
- [ ] Early returns where applicable
- [ ] One-line conditionals where possible
- [ ] Responsive design
- [ ] Commit message in English (conventional format)

---

**Last Updated:** December 2024
**Version:** 1.3
**Project Version:** 0.8.0
