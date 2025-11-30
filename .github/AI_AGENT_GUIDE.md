# 🤖 AI Agent Development Guide - MarketMind

Comprehensive guide for AI agents (GitHub Copilot, Cursor, Cline, etc.) working on MarketMind monorepo.

## 🎯 Core Principles

### MANDATORY Rules (Zero Tolerance)

1. **🔴 ALL TESTS MUST PASS BEFORE COMMITTING**
   ```bash
   pnpm test  # Must show 100% pass rate
   ```
   - 1,920+ tests must pass
   - Frontend: 1,894+ tests (92.15% coverage)
   - Backend: 37+ tests (80% threshold)
   - **NEVER commit with failing tests**

2. **🔴 NO CODE COMMENTS**
   - Use self-documenting code
   - Extract complex logic to named functions
   - Document in README files, not inline

3. **🔴 NO MAGIC NUMBERS**
   - Extract all hardcoded values to constants
   - Use descriptive constant names
   - Group related constants

4. **🔴 NO `any` TYPES**
   - Use proper TypeScript types
   - Use `unknown` for truly unknown types
   - Use generics for flexible types

5. **🔴 FEATURE BRANCHES ONLY**
   - Never commit to `main` or `develop`
   - Always create feature/bugfix branches
   - Use conventional naming: `feature/`, `bugfix/`, `hotfix/`

## 📁 Monorepo Structure Navigation

```
marketmind/
├── apps/
│   ├── electron/                    # Frontend (React + Electron)
│   │   ├── src/
│   │   │   ├── main/               # Electron main process
│   │   │   ├── renderer/           # React app
│   │   │   │   ├── components/    # UI components
│   │   │   │   ├── hooks/         # React hooks (including backend hooks)
│   │   │   │   ├── services/      # Business logic
│   │   │   │   ├── store/         # Zustand stores
│   │   │   │   ├── theme/         # Chakra UI theme
│   │   │   │   └── utils/         # Utilities (including tRPC client)
│   │   │   └── shared/            # Frontend shared code
│   │   └── package.json
│   │
│   └── backend/                    # Backend (Fastify + tRPC)
│       ├── src/
│       │   ├── db/                # Database layer
│       │   │   ├── client.ts      # Drizzle client
│       │   │   ├── schema.ts      # Database schema
│       │   │   └── migrations/    # SQL migrations
│       │   ├── routers/           # tRPC routers
│       │   │   ├── health.ts      # Health check
│       │   │   ├── auth.ts        # Authentication
│       │   │   ├── wallet.ts      # Wallet management
│       │   │   ├── trading.ts     # Trading operations
│       │   │   └── kline.ts       # Kline data
│       │   ├── services/          # Business logic
│       │   │   ├── encryption.ts  # AES-256 encryption
│       │   │   ├── websocket.ts   # Socket.io server
│       │   │   ├── binance-kline-sync.ts  # Real-time klines
│       │   │   └── binance-historical.ts   # Historical data
│       │   ├── trpc/              # tRPC setup
│       │   │   ├── trpc.ts        # tRPC instance
│       │   │   ├── context.ts     # Request context
│       │   │   └── router.ts      # Root router
│       │   ├── __tests__/         # Backend tests
│       │   ├── env.ts             # Environment validation
│       │   └── index.ts           # Server entry point
│       └── package.json
│
├── packages/                       # Shared packages
│   ├── types/                     # Shared TypeScript types
│   │   └── src/index.ts          # All type exports
│   └── indicators/                # Technical analysis
│       └── src/                  # Indicator calculations
│
├── scripts/                       # Utility scripts
├── docs/                          # Documentation
└── .github/                       # GitHub config
    ├── copilot-instructions.md   # Main instructions
    └── AI_AGENT_GUIDE.md         # This file
```

## 🔄 Common Development Workflows

### Adding New Backend Endpoint

1. **Define types** in `packages/types/src/index.ts`
2. **Create router** in `apps/backend/src/routers/`
3. **Register router** in `apps/backend/src/trpc/router.ts`
4. **Write tests** in `apps/backend/src/__tests__/`
5. **Create hook** in `apps/electron/src/renderer/hooks/`
6. **Run tests**: `pnpm test`

### Adding New Frontend Component

1. **Create component** in `apps/electron/src/renderer/components/`
2. **Add tests** next to component file (`.test.tsx`)
3. **Update theme** if needed in `apps/electron/src/renderer/theme/`
4. **Add translations** in `apps/electron/src/renderer/locales/`
5. **Run tests**: `pnpm test`

### Adding Database Table

1. **Update schema** in `apps/backend/src/db/schema.ts`
2. **Generate migration**: `cd apps/backend && pnpm db:generate`
3. **Review migration** in `apps/backend/src/db/migrations/`
4. **Apply migration**: `pnpm db:migrate`
5. **Update types** in `packages/types/src/index.ts` if needed

## 🧪 Testing Strategy

### Test Locations

```
apps/electron/src/renderer/components/Chart/ChartCanvas.tsx
apps/electron/src/renderer/components/Chart/ChartCanvas.test.tsx  ← Test here

apps/backend/src/services/encryption.ts
apps/backend/src/__tests__/encryption.test.ts  ← Test here
```

### Test Patterns

**Frontend (React Component):**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Backend (Service/Router):**
```typescript
import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey } from '../services/encryption';

describe('Encryption Service', () => {
  it('should encrypt and decrypt correctly', () => {
    const original = 'secret-api-key';
    const encrypted = encryptApiKey(original);
    const decrypted = decryptApiKey(encrypted);
    
    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });
  
  it('should throw on invalid encrypted data', () => {
    expect(() => decryptApiKey('invalid')).toThrow();
  });
});
```

### Running Tests

```bash
# All tests (MUST pass before commit)
pnpm test

# Specific workspace
pnpm --filter @marketmind/electron test
pnpm --filter @marketmind/backend test

# Watch mode (dev only, NOT for commits)
pnpm test:watch

# With coverage
pnpm test:coverage
```

## 🎨 Code Style Guide

### TypeScript Patterns

**✅ GOOD:**
```typescript
// Constants extracted
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Early returns
const processData = (data: Data | null): Result | null => {
  if (!data) return null;
  if (!data.isValid) return null;
  
  return transform(data);
};

// Single-line conditionals
const status = isActive ? 'active' : 'inactive';
if (isEmpty) return [];

// Proper types
interface ApiResponse {
  data: UserData;
  error: Error | null;
}

// Self-documenting
const calculateMovingAverage = (prices: number[], period: number): number => {
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
};
```

**❌ BAD:**
```typescript
// Magic numbers
setTimeout(callback, 1000);

// Nested ifs
const processData = (data: any) => {
  if (data) {
    if (data.isValid) {
      return transform(data);
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// Comments
const calculate = (x: number) => {
  // Multiply by 2
  const result = x * 2;
  // Return the result
  return result;
};

// any types
const fetchData = async (id: any): Promise<any> => {
  return await api.get(id);
};
```

### Import Organization

```typescript
// 1. External dependencies (alphabetical)
import React, { useState, useEffect } from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal absolute imports (alphabetical)
import type { Kline, Setup } from '@marketmind/types';
import { calculateEMA, calculateRSI } from '@marketmind/indicators';

// 3. Relative imports (alphabetical)
import { ChartCanvas } from './components/ChartCanvas';
import { useChartStore } from './store/chartStore';
import { formatPrice } from './utils/formatters';
import type { ChartProps } from './types';
```

## 🔌 Backend Integration Patterns

### tRPC Client (Frontend)

```typescript
// apps/electron/src/renderer/utils/trpc.ts
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

### React Query Hook (Frontend)

```typescript
// apps/electron/src/renderer/hooks/useBackendWallets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../utils/trpc';

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

  return { wallets, createWallet };
};
```

### tRPC Router (Backend)

```typescript
// apps/backend/src/routers/wallet.ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db, wallets } from '../db';
import { eq } from 'drizzle-orm';

export const walletRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.wallets.findMany({
      where: eq(wallets.userId, ctx.session.userId),
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string(), exchange: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [wallet] = await db.insert(wallets)
        .values({ ...input, userId: ctx.session.userId })
        .returning();
      return wallet;
    }),
});
```

## 🗄️ Database Operations

### Query Examples

```typescript
import { db, wallets, orders } from '../db';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

// Find by ID
const wallet = await db.query.wallets.findFirst({
  where: eq(wallets.id, walletId),
});

// Find many with conditions
const userWallets = await db.query.wallets.findMany({
  where: eq(wallets.userId, userId),
  orderBy: [desc(wallets.createdAt)],
});

// Complex query
const recentOrders = await db.query.orders.findMany({
  where: and(
    eq(orders.walletId, walletId),
    gte(orders.createdAt, startDate),
    lte(orders.createdAt, endDate)
  ),
  limit: 100,
});

// Insert
const [newWallet] = await db.insert(wallets)
  .values({ name: 'My Wallet', userId })
  .returning();

// Update
const [updated] = await db.update(wallets)
  .set({ name: 'Updated Name' })
  .where(eq(wallets.id, walletId))
  .returning();

// Delete
await db.delete(wallets)
  .where(eq(wallets.id, walletId));
```

### Schema Updates

```typescript
// 1. Update schema in apps/backend/src/db/schema.ts
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Generate migration
// cd apps/backend
// pnpm db:generate

// 3. Review migration in src/db/migrations/

// 4. Apply migration
// pnpm db:migrate
```

## 🔐 Security Patterns

### API Key Encryption

```typescript
// Backend
import { encryptApiKey, decryptApiKey } from '../services/encryption';

// Encrypt before storing
const encrypted = encryptApiKey(apiKey);
await db.insert(wallets).values({ apiKey: encrypted });

// Decrypt when using
const wallet = await db.query.wallets.findFirst({ where: eq(wallets.id, id) });
const apiKey = decryptApiKey(wallet.apiKey);
```

### Password Hashing

```typescript
import { hash, verify } from '@node-rs/argon2';

// Hash password (registration)
const hashedPassword = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
});

// Verify password (login)
const isValid = await verify(user.password, inputPassword);
```

## 📝 Git Workflow

### Creating Feature Branch

```bash
# Update develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/new-feature

# Make changes...

# Run tests (MANDATORY)
pnpm test

# Commit with conventional format
git add .
git commit -m "feat: add new feature description"

# Push
git push origin feature/new-feature

# Create PR to develop on GitHub
```

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `perf:` - Performance
- `test:` - Tests
- `chore:` - Maintenance

**Examples:**
```bash
feat: add real-time kline synchronization
fix: resolve WebSocket reconnection issue
docs: update API documentation
refactor: simplify authentication flow
perf: optimize chart rendering
test: add kline sync integration tests
chore: update dependencies
```

## 🚨 Common Pitfalls

### 1. Forgetting to Run Tests

```bash
# ❌ DON'T commit without testing
git commit -m "feat: new feature"

# ✅ DO run tests first
pnpm test
git commit -m "feat: new feature"
```

### 2. Using Comments Instead of Self-Documenting Code

```typescript
// ❌ DON'T
const calculate = (x: number) => {
  // Check if positive
  if (x > 0) {
    // Multiply by 2
    return x * 2;
  }
  return 0;
};

// ✅ DO
const isPositive = (value: number): boolean => value > 0;
const doubleValue = (value: number): number => value * 2;

const calculate = (value: number): number => {
  if (!isPositive(value)) return 0;
  return doubleValue(value);
};
```

### 3. Magic Numbers

```typescript
// ❌ DON'T
setTimeout(callback, 5000);
if (attempts > 3) throw new Error();

// ✅ DO
const RETRY_DELAY = 5000;
const MAX_ATTEMPTS = 3;

setTimeout(callback, RETRY_DELAY);
if (attempts > MAX_ATTEMPTS) throw new Error();
```

### 4. Type Any

```typescript
// ❌ DON'T
const fetchData = async (id: any): Promise<any> => {
  return await api.get(id);
};

// ✅ DO
interface ApiResponse {
  data: UserData;
  error: Error | null;
}

const fetchData = async (id: string): Promise<ApiResponse> => {
  return await api.get<ApiResponse>(id);
};
```

## 🎯 Quick Reference

### File Locations

| What | Where |
|------|-------|
| Backend router | `apps/backend/src/routers/` |
| Backend service | `apps/backend/src/services/` |
| Backend test | `apps/backend/src/__tests__/` |
| Frontend component | `apps/electron/src/renderer/components/` |
| Frontend hook | `apps/electron/src/renderer/hooks/` |
| Frontend store | `apps/electron/src/renderer/store/` |
| Shared types | `packages/types/src/` |
| Indicators | `packages/indicators/src/` |
| Database schema | `apps/backend/src/db/schema.ts` |
| Environment vars | `apps/backend/.env` |

### Commands

```bash
# Development
pnpm dev:backend        # Start backend
pnpm dev:electron       # Start frontend

# Testing
pnpm test              # All tests (MANDATORY before commit)
pnpm test:watch        # Watch mode (dev only)

# Database
cd apps/backend
pnpm db:generate       # Generate migration
pnpm db:migrate        # Apply migrations
pnpm db:studio         # Open GUI

# Utilities
pnpm lint              # Lint code
pnpm type-check        # Check types
pnpm clean             # Clean builds
```

### Environment Variables

```bash
# apps/backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/marketmind
SESSION_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-byte-hex-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## 📚 Documentation References

- **Main Instructions**: `.github/copilot-instructions.md`
- **Backend Status**: `docs/BACKEND_INTEGRATION_STATUS.md`
- **Implementation Plan**: `docs/IMPLEMENTATION_PLAN.md`
- **Git Guide**: `docs/GIT_COMMANDS.md`
- **Storage Guide**: `docs/STORAGE_GUIDE.md`

## ✅ Pre-Commit Checklist

Before every commit:

- [ ] All tests pass (`pnpm test`)
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] No linting errors (`pnpm lint`)
- [ ] No code comments
- [ ] No magic numbers
- [ ] No `any` types
- [ ] Tests cover new code
- [ ] CHANGELOG.md updated (if applicable)
- [ ] Feature branch (not main/develop)

---

**Last Updated:** November 30, 2025  
**For:** AI Agents (Copilot, Cursor, Cline, etc.)  
**Project:** MarketMind Monorepo
