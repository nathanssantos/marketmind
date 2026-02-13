# 🤖 AI Assistant Context - MarketMind Project

## 📋 Project Overview

**MarketMind** is an Electron-based desktop application that combines advanced financial chart visualization (klines) with AI analysis to provide insights on cryptocurrencies, stocks, and other tradeable assets.

**🚀 QUICK START FOR NEW AGENTS:**
1. Read this file completely
2. Check `QUICK_START.md` for setup
3. Review `AI_AGENT_GUIDE.md` for workflow patterns
4. Run `pnpm test` to verify setup

### Tech Stack

**Frontend:**
- **TypeScript** (end-to-end with unified typing)
- **Electron** (desktop framework)
- **React 19** (UI framework)
- **Chakra UI** (component library with light/dark mode)
- **Canvas API** (high-performance chart rendering)
- **Vite** (build tool)

**Backend:**
- **Fastify 5.6.2** (high-performance HTTP server)
- **tRPC 11.7.2** (type-safe RPC framework)
- **Drizzle ORM 0.44.7** (TypeScript SQL ORM)
- **PostgreSQL 17** (relational database)
- **TimescaleDB 2.23.1** (time-series extension)
- **Argon2** (password hashing - OWASP compliant)
- **Binance SDK 3.1.5** (trading integration)

**Architecture:**
- **Monorepo** (pnpm workspaces)
- **Shared Packages** (@marketmind/types, @marketmind/indicators)
- **Real-time API** (tRPC endpoints with React Query)
- **Session Auth** (secure cookie-based authentication)
- **Encrypted Storage** (AES-256-CBC for API keys)

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
13. **No Watch Mode:** Never use watch mode commands (`npm test`, `vitest`, etc. without `--run`). Always use run-once commands (`npm test -- --run`, `npm run build`, etc.) to avoid blocking the terminal
14. **Single-Line Blocks:** Simplify code blocks with only one statement to single-line format when correct and compliant with linting rules (e.g., `if (condition) return value;` instead of multi-line blocks)
15. **🔴 CRITICAL - All Tests Must Pass:** NEVER commit code with failing tests. ALWAYS run `npm run test:run` before committing. If tests fail, FIX THEM FIRST. Breaking tests is NEVER acceptable. Zero tolerance for broken tests in commits.

### UI Component Standards

All frontend UI code must follow the standards defined in `docs/UI_STYLE_GUIDE.md` and `apps/electron/src/renderer/components/ui/README.md`. These documents are living references and must be updated whenever components are created, modified, or deprecated.

**Import rules:**
- Interactive/composite components (`Button`, `Input`, `Switch`, `Slider`, `Select`, `CollapsibleSection`, `Dialog`, `Tabs`, etc.) must come from `@/renderer/components/ui/` or `@renderer/components/ui/`
- Layout primitives (`Box`, `Flex`, `Stack`, `Text`, `Grid`, etc.) come from `@chakra-ui/react`
- Never import `Button`, `Input`, `Switch`, or other interactive components directly from `@chakra-ui/react`

**Style rules:**
- All colors via semantic tokens (never hardcoded)
- Use theme recipes for repeated patterns (badge variants, collapsible sections)
- Inline style props only for layout-specific context (spacing, dimensions)
- Consult `docs/UI_STYLE_GUIDE.md` for the full style hierarchy

**Documentation maintenance:**
- When adding/modifying UI components, update `docs/UI_STYLE_GUIDE.md` and `apps/electron/src/renderer/components/ui/README.md`
- When adding new recipes to the theme, document them in the Style Guide

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

# 🔴 MANDATORY: Run tests before EVERY commit
pnpm test                                      # ALL tests (frontend + backend)
pnpm --filter @marketmind/electron test        # Frontend tests
pnpm --filter @marketmind/backend test         # Backend tests (when available)

# Only commit if all tests pass
git add .
git commit -m "feat: description"
git push origin feature/new-feature
# Open PR to develop
```

### 🔴 Pre-Commit Checklist (MANDATORY)
- [ ] `pnpm test` - ALL tests passing (frontend + backend)
- [ ] `pnpm --filter @marketmind/electron type-check` - No TypeScript errors (frontend)
- [ ] `pnpm --filter @marketmind/backend type-check` - No TypeScript errors (backend)
- [ ] `pnpm --filter @marketmind/electron lint` - No linting errors
- [ ] Tests cover new/changed code
- [ ] No console.log or debugging code left
- [ ] No comments in code (use README files instead)
- [ ] All user-facing text internationalized (no hardcoded strings)
- [ ] Code reviewed for DRY principles (no duplication)
- [ ] Code reviewed for testability (pure functions, dependency injection)
- [ ] Code reviewed for performance (no unnecessary re-renders, memoization where needed)
- [ ] CHANGELOG.md updated (if applicable)
- [ ] NEVER push/commit to main branch - ALWAYS create PR from feature/bugfix branch

**NEVER skip this checklist. Broken tests = DO NOT COMMIT. Code comments = DO NOT COMMIT. Hardcoded text = DO NOT COMMIT. Main branch commits = FORBIDDEN.**

### Conventional Commits (English)
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code restructuring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

### Code Examples

```typescript
const calculateSMA = (klines: Kline[], period: number): number => {
  if (klines.length === 0) return 0;
  const sum = klines.reduce((total, c) => total + c.close, 0);
  return sum / klines.length;
};

const backgroundColor = isDarkMode ? '#1e222d' : '#ffffff';

export const CHART_CONFIG = {
  VOLUME_THRESHOLD: 1_000_000,
  DEFAULT_MA_PERIODS: [20, 50, 200],
  CANVAS_PADDING: 20,
} as const;

import type { Kline } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { calculateSMA } from './utils';
```

---

## 📁 Project Structure

```
marketmind/                        # Monorepo root
├── apps/
│   ├── electron/                  # Electron desktop app
│   │   ├── src/
│   │   │   ├── main/             # Electron main process
│   │   │   ├── renderer/         # React app
│   │   │   │   ├── components/
│   │   │   │   ├── services/
│   │   │   │   ├── hooks/       # Including backend hooks
│   │   │   │   ├── store/
│   │   │   │   └── theme/
│   │   │   └── shared/          # Frontend shared code
│   │   └── package.json
│   │
│   └── backend/                  # Backend server
│       ├── src/
│       │   ├── db/              # Database (schema, migrations)
│       │   ├── routers/         # tRPC routers (health, auth, wallet, trading)
│       │   ├── services/        # Business logic (auth, encryption)
│       │   └── trpc/            # tRPC setup (context, router)
│       └── package.json
│
├── packages/                     # Shared packages
│   ├── types/                   # Shared TypeScript types
│   └── indicators/              # Technical analysis utilities
│
├── scripts/                     # Build and utility scripts
├── docs/                        # Documentation
│   ├── BACKEND_QUICKSTART.md   # Backend developer guide
│   ├── COMPONENT_MIGRATION.md  # Component migration guide
│   └── IMPLEMENTATION_PLAN.md  # Implementation roadmap
├── pnpm-workspace.yaml         # Monorepo configuration
└── package.json                # Root package
```

---

## 🚀 Starting a New Chat

When starting a new chat due to context limits, provide:

1. **This document** (`copilot-instructions.md`)
2. **Current phase** from `IMPLEMENTATION_PLAN.md`
3. **Current branch** and feature being worked on
4. **Files already created** (list main ones)
5. **Current task** or issue

Example:
```
Working on MarketMind following copilot-instructions.md.

Status:
- Phase: 3 (Chart Rendering)
- Branch: feature/chart-rendering
- Completed: Project setup, type system, Electron base
- Current: KlineRenderer component
- Next: Implement zoom/pan for chart canvas

Task: [specific request]
```

---

## 🎨 Project Patterns

### File Naming
- Components: PascalCase (`ChartCanvas.tsx`)
- Utilities: camelCase (`drawingUtils.ts`)
- Types: camelCase (`kline.ts`)
- Constants: camelCase (`chartConfig.ts`)

### Import Order
```typescript
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';
import type { Kline } from '@shared/types';
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
  const visible = klines.slice(visibleStart, visibleEnd);
  visible.forEach(drawKline);
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
import type { Kline } from '@shared/types';

interface ChartState {
  klines: Kline[];
  loading: boolean;
  error: Error | null;
  
  // Actions
  setKlines: (klines: Kline[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useChartStore = create<ChartState>((set) => ({
  klines: [],
  loading: false,
  error: null,
  
  setKlines: (klines) => set({ klines }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

---

## 🧪 Testing Approach

### Unit Tests (Frontend)

```typescript
// ✅ Test utilities and calculations
describe('calculateSMA', () => {
  it('should calculate simple moving average correctly', () => {
    const klines: Kline[] = [
      { close: 100, /* ... */ },
      { close: 110, /* ... */ },
      { close: 120, /* ... */ },
    ];

    const result = calculateSMA(klines, 3);
    expect(result).toBe(110);
  });

  it('should return 0 for empty array', () => {
    const result = calculateSMA([], 20);
    expect(result).toBe(0);
  });
});
```

### Integration Tests (Backend)

Backend integration tests use **testcontainers** with PostgreSQL + TimescaleDB for real database testing.

**Test Helpers Structure:**
```
apps/backend/src/__tests__/
├── helpers/
│   ├── test-db.ts           # PostgreSQL + TimescaleDB container management
│   ├── test-context.ts      # tRPC context factory for tests
│   ├── test-fixtures.ts     # Data factories (users, wallets, profiles)
│   └── test-caller.ts       # tRPC caller for router tests
└── routers/
    ├── auth.router.test.ts
    ├── wallet.router.test.ts
    ├── trading-profiles.router.test.ts
    └── ...
```

**Test Database Setup:**
```typescript
// ✅ apps/backend/src/__tests__/helpers/test-db.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

export const setupTestDatabase = async () => {
  container = await new PostgreSqlContainer('timescale/timescaledb:latest-pg17')
    .withDatabase('marketmind_test')
    .start();
  // Run migrations and return db instance
};

export const teardownTestDatabase = async () => {
  await container?.stop();
};
```

**Test Fixtures Pattern:**
```typescript
// ✅ apps/backend/src/__tests__/helpers/test-fixtures.ts
export const createAuthenticatedUser = async (options = {}) => {
  const { user, password } = await createTestUser(options);
  const session = await createTestSession({ userId: user.id });
  return { user, password, session };
};

export const createTestWallet = async (options: CreateWalletOptions) => {
  // Creates wallet in test database with defaults
};
```

**Router Test Example:**
```typescript
// ✅ apps/backend/src/__tests__/routers/wallet.router.test.ts
describe('Wallet Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  it('should return only wallets belonging to the user', async () => {
    const { user, session } = await createAuthenticatedUser();
    const caller = createAuthenticatedCaller(user, session);

    await caller.wallet.createPaper({ name: 'Test Wallet' });
    const result = await caller.wallet.list();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Test Wallet');
  });

  it('should throw NOT_FOUND when wallet belongs to another user', async () => {
    const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
    const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

    const caller1 = createAuthenticatedCaller(user1, session1);
    const caller2 = createAuthenticatedCaller(user2, session2);

    const wallet = await caller1.wallet.createPaper({ name: 'User1 Wallet' });

    await expect(caller2.wallet.getById({ id: wallet.id })).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });
});
```

---

## 📚 Key Files Reference

### Configuration
- `IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `copilot-instructions.md` - This file
- `README.md` - Project overview
- `apps/backend/.env` - Backend environment variables (gitignored)

### Documentation
- `docs/GIT_COMMANDS.md` - Git and GitHub CLI reference
- `docs/BACKEND_QUICKSTART.md` - Backend developer guide
- `docs/COMPONENT_MIGRATION.md` - Component migration guide
- `docs/BACKEND_INTEGRATION_STATUS.md` - Backend progress tracker
- `scripts/README.md` - Available scripts documentation

### Scripts
- `scripts/setup-github.sh` - GitHub repository setup
- `scripts/install-hooks.sh` - Git hooks installation
- `apps/backend/test-integration.mjs` - Backend integration tests

---

## 📊 Current Development Phase

Track progress in `IMPLEMENTATION_PLAN.md`. Update this section when starting new chats:

**Current Phase:** Backend Integration (Phase 5)
**Overall Progress:** 75% (Backend infrastructure complete, integration tests complete, component migration in progress)
**Current Tasks:** Migrating components from localStorage to backend API
**Recent Updates:** Integration tests with testcontainers, backend utilities refactored
**Blockers:** None

### Backend Integration Status (v0.38.0+)
- **✅ Backend Infrastructure**: Fastify 5.6.2 + tRPC 11.7.2 operational
- **✅ Database**: PostgreSQL 17 + TimescaleDB 2.23.1 with 9 tables
- **✅ Authentication**: Argon2 password hashing + session management
- **✅ API Routers**: health, auth, wallet, trading, auto-trading, analytics, fees endpoints
- **✅ Frontend Hooks**: useBackendWallets, useBackendOrders created
- **✅ Futures Auto-Trading**: User stream, liquidation monitoring, margin manager, max drawdown
- **✅ Risk Management**: Real-time alerts, margin top-up, position sizing
- **✅ Integration Tests**: testcontainers with PostgreSQL + TimescaleDB
- **✅ Backend Utilities**: walletQueries, profile-transformers, kline-mapper
- **✅ Security Fixes**: Cookie secure in production, type safety improvements
- **🟡 Component Migration**: In progress (TradingSidebar, WalletManager pending)

### Backend Testing Status
- **885 tests passing** (49 test files)
- **Integration tests**: auth, wallet, trading-profiles routers
- **Test infrastructure**: testcontainers, test-db, test-fixtures, test-caller
- **Code patterns**: Consistent use of walletQueries across all routers

### Frontend Status (Production Ready)
- **8 Trading Setups**: Complete Larry Williams suite (9.1, 9.2, 9.3, 9.4) + 4 pattern-based setups
- **Setup 9.2 (EMA9 Pullback)**: Single kline pullback with 14 tests
- **Setup 9.3 (EMA9 Double Pullback)**: Conservative 2-close confirmation with 14 tests
- **Setup 9.4 (EMA9 Continuation)**: Temporary EMA9 failure pattern with 16 tests
- **44 New Tests**: All 3 new detectors with 100% pass rate
- **Translations**: Complete EN/PT/ES/FR support for all setups
- **UI Updates**: 13 total setups in configuration and toggle popover

### Overall Project Status
- 1,864 passing tests (100% pass rate)
- 92.15% code coverage (exceeded 80% target!)
- Backend + Frontend integration complete
- Complete multi-language support (EN, PT, ES, FR)
- Production-ready builds (macOS, Windows)
- Auto-update system functional
- Performance optimized
- Accessibility compliant
- Clean, maintainable codebase

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

## 🔌 Backend Integration

### tRPC Client Setup

```typescript
// ✅ apps/electron/src/renderer/services/trpc.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@marketmind/backend';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
      credentials: 'include',
    }),
  ],
});
```

### Backend Hooks Pattern

```typescript
// ✅ apps/electron/src/renderer/hooks/useBackendWallets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';
import type { CreateWalletInput, UpdateWalletInput } from '@marketmind/types';

export const useBackendWallets = () => {
  const queryClient = useQueryClient();

  const wallets = useQuery({
    queryKey: ['wallets'],
    queryFn: () => trpc.wallet.list.query(),
  });

  const createWallet = useMutation({
    mutationFn: (data: CreateWalletInput) => trpc.wallet.create.mutate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });

  const updateWallet = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWalletInput }) =>
      trpc.wallet.update.mutate({ id, ...data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });

  return { wallets, createWallet, updateWallet };
};
```

### Component Migration Example

```typescript
// ❌ OLD: Using localStorage directly
const [wallets, setWallets] = useState<Wallet[]>([]);

useEffect(() => {
  const stored = localStorage.getItem('wallets');
  if (stored) setWallets(JSON.parse(stored));
}, []);

const addWallet = (wallet: Wallet) => {
  const updated = [...wallets, wallet];
  setWallets(updated);
  localStorage.setItem('wallets', JSON.stringify(updated));
};

// ✅ NEW: Using backend hooks
const { wallets, createWallet } = useBackendWallets();

const addWallet = async (wallet: CreateWalletInput) => {
  await createWallet.mutateAsync(wallet);
};
```

### tRPC Router Pattern

```typescript
// ✅ apps/backend/src/routers/wallet.ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { createWalletSchema, updateWalletSchema } from '@marketmind/types';

export const walletRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.wallets.findMany({
      where: eq(wallets.userId, ctx.session.userId),
    });
  }),

  create: protectedProcedure
    .input(createWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const encryptedApiKey = encrypt(input.apiKey);
      const encryptedSecret = encrypt(input.apiSecret);

      const [wallet] = await ctx.db.insert(wallets).values({
        userId: ctx.session.userId,
        name: input.name,
        exchange: input.exchange,
        apiKey: encryptedApiKey,
        apiSecret: encryptedSecret,
      }).returning();

      return wallet;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...updateWalletSchema.shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      const [wallet] = await ctx.db
        .update(wallets)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(wallets.id, id), eq(wallets.userId, ctx.session.userId)))
        .returning();

      if (!wallet) throw new Error('Wallet not found');
      return wallet;
    }),
});
```

### Database Queries with Drizzle

```typescript
// ✅ apps/backend/src/db/schema.ts
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  exchange: text('exchange').notNull(),
  apiKey: text('api_key').notNull(),
  apiSecret: text('api_secret').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ✅ Query examples
import { eq, and, desc } from 'drizzle-orm';

// Find all wallets for a user
const userWallets = await db.query.wallets.findMany({
  where: eq(wallets.userId, userId),
  orderBy: [desc(wallets.createdAt)],
});

// Find specific wallet
const wallet = await db.query.wallets.findFirst({
  where: and(eq(wallets.id, id), eq(wallets.userId, userId)),
});

// Update wallet
const [updated] = await db
  .update(wallets)
  .set({ name: 'New Name', updatedAt: new Date() })
  .where(eq(wallets.id, id))
  .returning();
```

### Authentication Flow

```typescript
// ✅ apps/backend/src/routers/auth.ts
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await hash(input.password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      const [user] = await ctx.db.insert(users).values({
        email: input.email,
        password: hashedPassword,
      }).returning({ id: users.id, email: users.email });

      const sessionToken = generateToken();
      await ctx.db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      ctx.res.setCookie('session', sessionToken, { httpOnly: true, secure: true });
      return user;
    }),

  login: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (!user || !(await verify(user.password, input.password))) {
        throw new Error('Invalid credentials');
      }

      const sessionToken = generateToken();
      await ctx.db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      ctx.res.setCookie('session', sessionToken, { httpOnly: true, secure: true });
      return { id: user.id, email: user.email };
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(sessions).where(eq(sessions.token, ctx.session.token));
    ctx.res.clearCookie('session');
  }),
});
```

### Backend Utilities

The backend uses reusable utility modules to avoid code duplication and ensure consistency.

**walletQueries - Database Query Utility:**
```typescript
// ✅ apps/backend/src/services/database/walletQueries.ts
export const walletQueries = {
  // Returns wallet or throws NOT_FOUND
  async getByIdAndUser(walletId: string, userId: string): Promise<WalletRecord> {
    const wallet = await this.findByIdAndUser(walletId, userId, { throwIfNotFound: true });
    return wallet!;
  },

  // Returns wallet by ID only (no user check) - use for internal operations
  async getById(walletId: string): Promise<WalletRecord> {
    const wallet = await this.findById(walletId, { throwIfNotFound: true });
    return wallet!;
  },

  // Returns wallet or null - use when you need to handle not found yourself
  async findByIdAndUser(walletId: string, userId: string, options = {}): Promise<WalletRecord | null>,

  // List helpers
  async listByUser(userId: string): Promise<WalletRecord[]>,
  async listActiveByUser(userId: string): Promise<WalletRecord[]>,
};

// Usage in routers:
import { walletQueries } from '../services/database/walletQueries';

// Instead of manual query + throw:
const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
```

**profile-transformers - JSON/Type Transformations:**
```typescript
// ✅ apps/backend/src/utils/profile-transformers.ts
export const parseEnabledSetupTypes = (json: string): string[] => JSON.parse(json);
export const stringifyEnabledSetupTypes = (types: string[]): string => JSON.stringify(types);

export const transformTradingProfile = (profile: RawProfile) => ({
  ...profile,
  enabledSetupTypes: parseEnabledSetupTypes(profile.enabledSetupTypes),
  maxPositionSize: profile.maxPositionSize ? parseFloat(profile.maxPositionSize) : null,
});

export const transformAutoTradingConfig = (config: RawConfig) => ({
  ...config,
  enabledSetupTypes: parseEnabledSetupTypes(config.enabledSetupTypes),
  // ... other transformations
});
```

**kline-mapper - Database to API Transformation:**
```typescript
// ✅ apps/backend/src/utils/kline-mapper.ts
import type { Kline } from '@marketmind/types';

export const mapDbKlinesToApi = (dbKlines: DbKline[]): Kline[] =>
  dbKlines.map((k) => ({
    symbol: k.symbol,
    interval: k.interval,
    openTime: k.openTime.getTime(),
    closeTime: k.closeTime.getTime(),
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
    volume: parseFloat(k.volume),
    quoteVolume: parseFloat(k.quoteVolume),
    trades: k.trades,
    takerBuyBaseVolume: parseFloat(k.takerBuyBaseVolume),
    takerBuyQuoteVolume: parseFloat(k.takerBuyQuoteVolume),
  }));
```

### Development Commands

```bash
# Start backend server (development with auto-reload)
cd apps/backend
pnpm dev

# Start frontend (separate terminal)
cd apps/electron
pnpm dev

# Run all tests (monorepo root)
pnpm test

# Run frontend tests only
pnpm --filter @marketmind/electron test

# Run backend tests only (when available)
pnpm --filter @marketmind/backend test

# Database migrations
cd apps/backend
pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Apply migrations
pnpm db:push        # Push schema to DB (dev only)
pnpm db:studio      # Open Drizzle Studio GUI

# Type checking
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/backend type-check

# Install dependencies (from monorepo root)
pnpm install

# Add dependency to specific workspace
pnpm --filter @marketmind/backend add fastify
pnpm --filter @marketmind/electron add react-query

# Clean and rebuild
pnpm clean          # Clean all build artifacts
pnpm build          # Build all packages
```

### Backend Environment Setup

```bash
# .env (apps/backend/.env) - NEVER commit to git
DATABASE_URL=postgresql://user:password@localhost:5432/marketmind
NODE_ENV=development
ENCRYPTION_KEY=your-32-byte-hex-key

# PostgreSQL with TimescaleDB (Docker)
docker run -d \
  --name marketmind-postgres \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_DB=marketmind \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg17

# Or using PostgreSQL 17 directly
brew install postgresql@17
brew services start postgresql@17
psql postgres -c "CREATE DATABASE marketmind;"
psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

---

## 💡 Quick Reference

### File Naming
- Components: PascalCase (`ChartCanvas.tsx`)
- Utilities: camelCase (`drawingUtils.ts`)
- Types: camelCase (`kline.ts`)
- Constants: camelCase (`chartConfig.ts`)

### Import Order
```typescript
// 1. External dependencies
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';

// 2. Internal absolute imports
import type { Kline } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';

// 3. Relative imports
import { calculateSMA } from './utils';
import type { ChartProps } from './types';
```

### Type Exports
```typescript
// ✅ Use 'import type' for type-only imports
import type { Kline } from '@shared/types';

// ✅ Export types alongside implementation
export interface ChartProps {
  data: Kline[];
}

export const Chart = (props: ChartProps) => {
  // Implementation
};
```

---

## 🔄 Workflow Checklist

Before committing:
- [ ] 🔴 **ALL TESTS PASSING** (`npm run test:run` + `npm run test:browser:run`)
- [ ] 🔴 **No TypeScript errors** (`npm run type-check`)
- [ ] 🔴 **No linting errors** (`npm run lint`)
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

**🔴 STOP: If ANY test fails, debug and fix BEFORE committing. No exceptions.**

---

**Last Updated:** November 2025
**Version:** 1.4
**Project Version:** 0.28.0
