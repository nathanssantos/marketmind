# 🤖 AI Assistant Context — MarketMind

## 📋 Project Overview

**MarketMind** is an Electron-based desktop application for trading cryptocurrencies, stocks, and other tradeable assets, combining advanced financial chart visualization (klines) with strategy-driven setup detection, backtesting, and auto-trading.

**🚀 Quick start for new agents:** read this file → check `QUICK_START.md` → run `pnpm test`.

### Tech Stack
- **Frontend:** TypeScript, Electron 39.2.6, React 19, Chakra UI, Canvas API, Vite 7.2.7
- **Backend:** Fastify 5.6.2, tRPC 11.7.2, Drizzle ORM 0.45.1, PostgreSQL 17 + TimescaleDB 2.23.1, Argon2 (OWASP), Binance SDK 3.1.5, TypeScript 5.9.3
- **Architecture:** pnpm monorepo, 7 shared packages (`@marketmind/types`, `chart-studies`, `fibonacci`, `logger`, `trading-core`, `risk`, `utils`); exchange abstraction over Binance (crypto) + Interactive Brokers (US stocks via `@stoqey/ib`); session auth (HTTP-only cookies); AES-256-CBC for API keys; 105 builtin strategies in `apps/backend/strategies/builtin/`

### Repository Info
- **Repo:** `nathanssantos/marketmind` (private)
- **Branches:** `main` = production (protected, every release tag cuts from here); `develop` = integration. Always create `feature/*` or `bugfix/*` branches — never commit directly to either.

---

## 🎯 Development Guidelines

### Core Rules
1. **Latest versions** — keep deps updated, check official docs for breaking changes
2. **Official documentation** — consult library docs before implementing
3. **Changelog** — update `CHANGELOG.md` with every significant change (Keep a Changelog format)
4. **No comments** — self-documenting code + READMEs instead
5. **No magic numbers** — extract to constants files
6. **No `any` types** — use proper types, `unknown`, or generics
7. **Early returns** — prefer over nested ifs
8. **One-line conditionals** — ternaries / `if (x) return y;` for simple cases
9. **Responsive design** — mobile/tablet/desktop viewports
10. **English only** — commits, docs, code
11. **Branch workflow** — feature/bugfix branches; never commit to main/develop directly
12. **Implementation plan** — follow & evolve the active version plan in `docs/V1_X_PLAN.md`
13. **No watch mode** — always run-once (`pnpm test`, `npm test -- --run`); never `vitest` without `--run`
14. **Single-line blocks** — `if (cond) return val;` when lint-compliant
15. **🔴 All tests must pass** — never commit with failing tests. Run `pnpm test` first. Zero tolerance.
16. **Handler object over switch** — switch statements mapping >3 enum/type cases to handlers should become `Record<Type, Handler>` objects (real examples: `IndicatorEngine.indicatorComputeHandlers`, `AnnotationLayer.markerStyleHandlers`, `AIService.providerFactories`)
17. **🔴 No flaky tests** — a test that "sometimes passes" is broken. If a test fails on CI but passes locally (or vice-versa), or fails intermittently when re-run, the test is **wrong** — not the code under test. Diagnose the root cause (test pollution between runs, leaked global state, missing cleanup, race conditions, time-dependent assertions, network/IO without isolation, hard-coded ports/dates) and fix the test so it is deterministic. **Do not** retry, mark `.skip`, add `--retry`, raise timeouts, or paper over with `setTimeout` until "it passes." Re-running until green hides real bugs and trains the team to ignore CI red. If the underlying behavior is genuinely non-deterministic (websocket timing, animation frames), the test must wait on the deterministic signal that proves the work happened (event, store value, DOM mutation), not on a wall clock.

### UI Component Standards (`@renderer/components/ui`)

`apps/electron/src/renderer/components/ui/` is the **single source of truth** for reusable UI components, designed for future extraction into a standalone `@marketmind/ui` package.

**🔴 Before creating ANY new UI component:**
1. Check `apps/electron/src/renderer/components/ui/index.ts` — it may already exist
2. Check `docs/UI_STYLE_GUIDE.md` for the full catalog
3. If missing, create the wrapper in `ui/` first, then use it

**Import rules (single canonical path):**
```tsx
import { Button, IconButton, Switch, Badge, Tabs } from '@renderer/components/ui';
```
- **All** interactive/visual components come from `@renderer/components/ui` via barrel export. Includes: `Button`, `IconButton`, `ToggleIconButton`, `Input`, `NumberInput`, `PasswordInput`, `Textarea`, `Select`, `Slider`, `Switch`, `Checkbox`, `Radio`, `RadioGroup`, `Field`, `Badge`, `Alert`, `Callout`, `Skeleton`, `Link`, `CloseButton`, `Image`, `Menu`, `Separator`, `Progress`, `Tabs`, `Table`, `Card`, `Stat`, `Dialog`, `FormDialog`, `ConfirmationDialog`, `FormSection`, `FormRow`, `PanelHeader`, `CollapsibleSection`, `Popover`, `TooltipWrapper`, `EmptyState`, `ErrorMessage`, `LoadingSpinner`, `CryptoIcon`, `MetricCard`, `PnLDisplay`, `PageTitle`, `SectionTitle`, `SubsectionTitle`, `SectionDescription`, `FieldHint`, `MetaText`
- **Only layout primitives** come directly from `@chakra-ui/react`: `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`, `GridItem`, `Text`, `Heading`, `Spinner`, `Portal`, `Group`
- **Never** import `Button`, `IconButton`, `Badge`, `Tabs`, `Table`, `Menu`, `Input`, `Switch`, or any interactive component directly from `@chakra-ui/react` — only the `ui/` wrappers may do so internally

**Section / row composition (added in v1.0.0+):**
- `<FormSection title="..." description="..." action={...}>` — standard section block (no border). Pairs with `<Field>`, `<FormRow>`, `<Callout>` inside.
- `<PanelHeader title="..." action={...}>` — dashboard-style header **with `borderBottom`** separator (use in AnalyticsModal panels and panels where the title should be visually divided from the body). Same title typography as `FormSection` (sm/semibold).
- `<FormRow label="..." helper="..."><Switch ... /></FormRow>` — left label/helper, right control. Use for switch/select rows.
- `<Callout tone="info|success|warning|danger|neutral" title="..." compact>...</Callout>` — replaces ad-hoc colored `<Box bg="blue.50" ...>`. Always prefer over inline colored boxes.
- `<CollapsibleSection variant="static" ...>` — non-accordion, always-open (no chevron). Use where collapsing is unwanted (e.g. AutoTrading sections).
- `MM.spinner.panel` (`{ size: 'md', py: 6 }`) — standard panel loading. Pair with `<Flex justify="center" align="center" py={MM.spinner.panel.py}><Spinner size={MM.spinner.panel.size} /></Flex>`.
- `MM.buttonSize.nav` (`'2xs'`) — pagination / prev-next nav. Pair with `px={1.5} minW="auto"` for tight icon-only buttons (‹ ›).

**Theming rules (mandatory for future multi-theme support):**
- All colors via **semantic tokens** — never hardcode hex/rgb
- Use `colorPalette` prop (not `color="blue.500"`) when Chakra supports it
- Use theme **recipes** for repeated visual patterns
- Inline style props only for layout (spacing, positioning, dimensions)
- Components in `ui/` are theme-agnostic — they receive colors from the token system, never define their own palette

**Creating a new wrapper in `ui/`:**
1. Follow the existing pattern (re-export from Chakra with `forwardRef`)
2. Export from `ui/index.ts`
3. Update `docs/UI_STYLE_GUIDE.md` (catalog) and `apps/electron/src/renderer/components/ui/README.md` (usage)
4. New theme recipes → document in the Style Guide

### Git Workflow

```bash
develop                # never commit directly
  ← feature/chart-rendering
  ← bugfix/canvas-resize
  ← hotfix/critical-bug

git checkout develop && git pull
git checkout -b feature/new-feature
# ... work ...
pnpm test              # 🔴 mandatory — must pass
git commit -m "feat: description"
git push origin feature/new-feature
gh pr create           # PR to develop
```

### 🔴 Pre-Commit Checklist (MANDATORY)
- [ ] `pnpm test` — all tests pass (frontend + backend)
- [ ] `pnpm --filter @marketmind/electron type-check` — no TS errors (frontend)
- [ ] `pnpm --filter @marketmind/backend type-check` — no TS errors (backend)
- [ ] `pnpm --filter @marketmind/electron lint` — no lint errors
- [ ] Tests cover new/changed code
- [ ] No `console.log` / debug code
- [ ] No code comments (READMEs/JSDoc on public APIs only)
- [ ] User-facing text internationalized (no hardcoded strings)
- [ ] DRY (no duplication), testable (pure functions, DI), performant (no needless re-renders)
- [ ] `CHANGELOG.md` updated if applicable
- [ ] On a feature/bugfix branch — never main/develop directly

**Broken tests, code comments, hardcoded strings, or main-branch commits = DO NOT COMMIT.**

### Conventional Commits (English)
`feat:` new feature · `fix:` bug fix · `docs:` docs · `refactor:` restructure (use for handler-object refactors) · `perf:` performance · `chore:` maintenance

---

## 📁 Project Structure

```
marketmind/                         # monorepo root
├── apps/
│   ├── electron/                   # Electron desktop app
│   │   └── src/{main,renderer,shared}
│   └── backend/                    # Fastify + tRPC server
│       ├── src/{db,exchange,routers,services,trpc}
│       │   ├── exchange/{binance,interactive-brokers}      # 16 IB modules
│       │   ├── routers/                                     # health, auth, wallet, trading, analytics, fees, auto-trading, mcp
│       │   └── services/backtesting/                        # BacktestEngine, MultiWatcherBacktestEngine, FilterManager
│       ├── strategies/builtin/                              # 105 strategy JSON files
│       └── scripts/backtest/                                # rank-strategies, rank-strategies-with-filters, run-optimization
├── packages/                       # 7 shared workspaces: types, indicators, fibonacci, logger, trading-core, risk, utils
├── packages/mcp-*                  # 4 MCP servers (screenshot, app, backend, strategy) + mcp-trading (v1.5)
├── docs/                           # BACKEND_QUICKSTART, MCP_SERVERS, UI_STYLE_GUIDE, BROWSER_TESTING, RELEASE_PROCESS, V1_X_PLAN
└── pnpm-workspace.yaml
```

---

## 💡 Code Patterns

**File naming:** Components `PascalCase.tsx`, utilities/types/constants `camelCase.ts`.

**Import order:**
```typescript
// 1. external
import React, { useState } from 'react';
import { Box } from '@chakra-ui/react';
// 2. internal absolute (use `import type` for type-only)
import type { Kline } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
// 3. relative
import { calculateSMA } from './utils';
```

**Style examples:**
```typescript
// arrow utilities; named-export PascalCase components
const calculateSMA = (klines: Kline[], period: number): number => {
  if (klines.length === 0) return 0;
  return klines.reduce((sum, k) => sum + k.close, 0) / klines.length;
};

// constants — extract magic numbers
export const CHART_CONFIG = {
  VOLUME_THRESHOLD: 1_000_000,
  DEFAULT_MA_PERIODS: [20, 50, 200],
  CANVAS_PADDING: 20,
} as const;

// Zustand store
interface ChartState {
  klines: Kline[];
  setKlines: (klines: Kline[]) => void;
}
export const useChartStore = create<ChartState>((set) => ({
  klines: [],
  setKlines: (klines) => set({ klines }),
}));
```

### Canvas rendering (chart hot path)
- Slice klines to viewport before drawing (`klines.slice(visibleStart, visibleEnd)`)
- Drive animation with `requestAnimationFrame`; flag `animationNeeded` to skip idle frames
- Debounce resize (~150ms)
- Decouple chart re-renders from store: imperative `subscribe` + throttle + diff (see memory: `feedback_render_decoupling.md`)
- Clear canvas in `useEffect` cleanup

---

## 🔌 Backend Integration

### tRPC client (frontend)
```typescript
// apps/electron/src/renderer/services/trpc.ts
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3001/trpc', credentials: 'include' })],
});
```

### Backend hook (React Query)
```typescript
export const useBackendWallets = () => {
  const qc = useQueryClient();
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => trpc.wallet.list.query() });
  const createWallet = useMutation({
    mutationFn: (data: CreateWalletInput) => trpc.wallet.create.mutate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  });
  return { wallets, createWallet };
};
```

### tRPC router (backend)
```typescript
export const walletRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.wallets.findMany({ where: eq(wallets.userId, ctx.session.userId) })
  ),
  create: protectedProcedure
    .input(createWalletSchema)
    .mutation(async ({ ctx, input }) => {
      const [w] = await ctx.db.insert(wallets).values({
        userId: ctx.session.userId,
        ...input,
        apiKey: encrypt(input.apiKey),
        apiSecret: encrypt(input.apiSecret),
      }).returning();
      return w;
    }),
});
```

### Backend utility modules (use these — don't reinvent)
- **`services/database/walletQueries`** — `getByIdAndUser` (throws NOT_FOUND), `getById`, `findByIdAndUser`, `listByUser`, `listActiveByUser`. Always prefer over inline drizzle queries that need user-scoping.
- **`utils/profile-transformers`** — `parseEnabledSetupTypes`, `stringifyEnabledSetupTypes`, `transformTradingProfile`, `transformAutoTradingConfig`. Single source of truth for JSON↔type conversions.
- **`utils/kline-mapper`** — `mapDbKlinesToApi` converts DB rows (Date/string-decimal) to API `Kline` (number/timestamp).

### Auth (Argon2 + sessions)
Argon2 params: `{ memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 }`. Session = random token in DB + HTTP-only cookie (30-day TTL). `protectedProcedure` reads cookie, looks up session, attaches `ctx.user` and `ctx.session`. Password policy enforced on `register` / `changePassword` / `resetPassword` (login intentionally still accepts old weak passwords); shared validator in `@marketmind/utils#validatePassword`.

---

## 🔒 Security

- **API keys:** AES-256-CBC encrypt before insert, decrypt on read. Never log raw keys. Electron renderer uses `safeStorage` (platform-native) via IPC `storage:setApiKey` / `storage:getApiKey`; preload exposes only `window.electron.secureStorage`.
- **Env vars:** `apps/backend/.env` is gitignored. Required: `DATABASE_URL`, `ENCRYPTION_KEY` (32-byte hex), `NODE_ENV`.
- **IPC:** main process validates inputs; renderer only uses `contextBridge`-exposed surface, never `ipcRenderer` directly.

---

## 🤖 MCP Servers (v1.1+)

Four Model Context Protocol servers in `packages/mcp-*` expose 47 tools to any MCP client (Claude Code, ChatGPT desktop, custom agents). Install via `pnpm mcp:install` (auto-detects each `packages/mcp-*` workspace and registers it in `~/.claude.json`).

- `@marketmind/mcp-screenshot` (6 tools) — visual capture pipeline (Playwright + Chromium against the dev renderer); HTML galleries side-by-side dark/light. **Phase 6 visual verification depends on this.**
- `@marketmind/mcp-app` (19 tools) — drives the live dev app: navigation, symbol/timeframe/chart-type, theme, sidebars, allowlisted store dispatch, Playwright escape hatches.
- `@marketmind/mcp-backend` (14 tools) — read-only DB layer + tRPC bridge + audit log.
- `@marketmind/mcp-strategy` (8 tools) — Pine strategy CRUD + backtest proxies.
- `@marketmind/mcp-trading` (v1.5) — paper trade execution behind per-wallet `agentTradingEnabled` toggle, hard-gate (`mcp.assertWriteAllowed` → FORBIDDEN + `denied` audit row when off), 30 writes/hour rate limit, surfaced in Settings → Security as "AI Agent Activity".

Docs: [`docs/MCP_SERVERS.md`](docs/MCP_SERVERS.md), [`docs/MCP_AGENT_GUIDE.md`](docs/MCP_AGENT_GUIDE.md), [`docs/MCP_SECURITY.md`](docs/MCP_SECURITY.md).

**All MCP servers are dev-only** — require `VITE_E2E_BYPASS_AUTH=true` (renderer-driving servers) and a local `DATABASE_URL`. **Exception:** `mcp-trading` talks pure tRPC over HTTP with a real session cookie (`MM_MCP_SESSION_COOKIE`) — no e2e bypass needed.

---

## 🧪 Testing

**Browser automation:** see [`docs/BROWSER_TESTING.md`](docs/BROWSER_TESTING.md). Three layers — Playwright MCP (generic web), chart perf harness (`pnpm --filter @marketmind/electron test:perf`), Electron smoke (`pnpm --filter @marketmind/electron test:e2e:electron`). Renderer-only auth bypass via `VITE_E2E_BYPASS_AUTH=true`.

**⚠️ Electron e2e — never use `page.route()`:** Playwright's `page.route()` enables CDP request interception that conflicts with Vite's ESM module loader in the Electron renderer; on reload, every `/src/**` and `@vite/client` request fails with `net::ERR_FAILED` and React never mounts (true even when the route pattern matches none of those URLs). Use `installTrpcMockOnContext(ctx)` (addInitScript fetch monkey-patch) instead — see Layer 4 in `docs/BROWSER_TESTING.md`.

### Backend integration tests
Use **testcontainers** with PostgreSQL + TimescaleDB. Helpers in `apps/backend/src/__tests__/helpers/`:

- **`test-db.ts`** — `setupTestDatabase()` / `teardownTestDatabase()` boot a `timescale/timescaledb:latest-pg17` container and run migrations. Cleanup uses `session_replication_role = 'replica'` to skip RI cascades, so **new child tables must be added to the explicit cleanup list**.
- **`test-context.ts`** — tRPC context factory.
- **`test-fixtures.ts`** — `createTestUser`, `createAuthenticatedUser`, `createTestSession`, `createTestWallet`.
- **`test-caller.ts`** — `createAuthenticatedCaller(user, session)` for router tests.

```typescript
describe('Wallet Router', () => {
  beforeAll(setupTestDatabase);
  afterAll(teardownTestDatabase);
  beforeEach(cleanupTables);

  it('returns only the user\'s wallets', async () => {
    const { user, session } = await createAuthenticatedUser();
    const caller = createAuthenticatedCaller(user, session);
    await caller.wallet.createPaper({ name: 'Test' });
    expect(await caller.wallet.list()).toHaveLength(1);
  });
});
```

The `pretest` script in backend runs `bash scripts/ensure-docker.sh` — backend tests need Docker for testcontainers; CI/local without Docker hangs at the pretest hook.

---

## 📊 Current Development Phase

**Version:** v1.5.0

v1.5 is the largest feature drop since v1.0 — 28 commits headlined by `@marketmind/mcp-trading` (paper-trade execution for MCP agents behind a per-wallet toggle, hard-gated with audit log), the layout-durability story closing (snapshot list/restore UI + WAL archiving for PITR), `@marketmind/tokens` extracted into its own package, centralized keyboard registry + `?` help modal, backtest runs persisting across backend restart, and an axe-core dialog regression spec gating CI. v1.4 + earlier plans archived in `docs/archive/`.

### System Status (v1.5.0)
- ✅ Backend infrastructure (Fastify 5.6.2 + tRPC 11.7.2)
- ✅ Database (PostgreSQL 17 + TimescaleDB 2.23.1)
- ✅ Authentication (Argon2 + sessions)
- ✅ API routers (health, auth, wallet, trading, auto-trading, analytics, fees, mcp)
- ✅ Exchange abstraction (Binance crypto + IB stocks, 16 IB modules)
- ✅ Futures auto-trading (user stream, liquidation monitoring, margin manager, max drawdown)
- ✅ Trailing stop system (v0.51.0+, ATR-multiplier volatility)
- ✅ Risk management (alerts, margin top-up, position sizing)
- ✅ Stream resilience (watchdog + forced reconnect + synthesized klines from `@trade` when `@kline_*` degrades — `services/binance-kline-stream.ts`, `services/kline-synthesis.ts`)
- ✅ Integration tests (testcontainers + PG + Timescale)
- ✅ Strategy system (105 builtin JSON files)
- ✅ Backtesting infrastructure (BacktestEngine, MultiWatcherBacktestEngine, 3 optimization scripts)

### DEFAULT_ENABLED_SETUPS (13 strategies)
`7day-momentum-crypto`, `breakout-retest`, `bull-trap`, `cumulative-rsi-r3`, `divergence-rsi-macd`, `golden-cross-sma`, `hull-ma-trend`, `liquidity-sweep`, `macd-divergence`, `momentum-breakout-2025`, `nr7-breakout`, `pin-inside-combo`, `triple-ema-confluence`

### Testing Status (~8,400 total tests)
- **Backend:** 5,416 passing across 204 files + 40 skipped (IB integration tests requiring Gateway)
- **Frontend:** 2,239 unit (182 files) + 27 browser
- **Indicators:** 722 across 60 files
- **Visual regression:** 44-PNG baseline (`apps/electron/screenshots/baseline/`) + CI gate (`.github/workflows/visual-regression.yml`, pixelmatch `maxDiffPixels=40000` ≈ 3.1%, `threshold=0.2`)
- **Standardization:** 0 hardcoded shade literals (`color="X.500"`, `bg="X.50"`) and 0 `_dark={{}}` overrides remaining in `apps/electron/src/renderer/components/`. All colors flow through semantic tokens (`X.fg/.subtle/.muted/.solid`, `bg.panel/.muted`, `fg.muted`, `trading.profit/.loss`).

### Backtesting scripts
```bash
node --experimental-vm-modules --loader ts-node/esm scripts/backtest/rank-strategies.ts                    # rank all 105 (BTC/ETH/SOL, 1h, 3y)
node --experimental-vm-modules --loader ts-node/esm scripts/backtest/rank-strategies-with-filters.ts       # × 6 filter presets
node --experimental-vm-modules --loader ts-node/esm scripts/backtest/run-optimization.ts [--quick]         # 3-stage: Fib params → filters → trailing stop
```

---

## 🚀 Development Commands

```bash
# install
pnpm install

# dev (2 terminals)
pnpm --filter @marketmind/backend dev          # backend on :3001
pnpm --filter @marketmind/electron dev         # Electron renderer

# tests (mandatory before commit)
pnpm test                                      # all tests
pnpm --filter @marketmind/electron test
pnpm --filter @marketmind/backend test

# type-check / lint
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron lint

# database (apps/backend)
pnpm db:generate    # generate migration from schema diff
pnpm db:migrate     # apply migrations
pnpm db:push        # push schema (dev only)
pnpm db:studio      # Drizzle Studio GUI

# add deps
pnpm --filter @marketmind/backend add fastify
pnpm --filter @marketmind/electron add react-query

# clean / build
pnpm clean
pnpm build
```

**PostgreSQL setup (one-time):**
```bash
docker run -d --name marketmind-postgres \
  -e POSTGRES_PASSWORD=your-password -e POSTGRES_DB=marketmind \
  -p 5432:5432 timescale/timescaledb:latest-pg17
```
`apps/backend/.env`: `DATABASE_URL=postgresql://...`, `ENCRYPTION_KEY=<32-byte hex>`, `NODE_ENV=development`.

---

## 📚 Key Files Reference

**Configuration:** `docs/V1_X_PLAN.md` (active version plan), `README.md`, `apps/backend/.env` (gitignored)

**Documentation:**
- `docs/BACKEND_QUICKSTART.md` — backend developer guide
- `docs/MCP_SERVERS.md` / `MCP_AGENT_GUIDE.md` / `MCP_SECURITY.md` — MCP overview, recipes, threat model
- `docs/UI_STYLE_GUIDE.md` / `UI_DIALOG_PATTERNS.md` / `UI_DESIGN_SYSTEM.md` — UI catalog and patterns
- `docs/BROWSER_TESTING.md` — Playwright + chart perf + Electron smoke
- `docs/RELEASE_PROCESS.md` — release checklist (version updated in 6 places)
- `docs/INFRA_RECOVERY.md` — DB recovery / WAL archiving / PITR runbook

**Scripts:** `scripts/setup-github.sh`, `scripts/install-hooks.sh`, `apps/backend/scripts/backtest/*`

---

## 🚨 Critical Reminders

1. 🔴 Never commit with failing tests — `pnpm test` first
2. 🔴 No code comments — self-documenting code + READMEs
3. 🔴 No magic numbers — extract to constants
4. 🔴 No `any` types — use proper types or `unknown`
5. 🔴 Feature/bugfix branches only — never main/develop directly
6. 🔴 UI components from `@renderer/components/ui` only — never raw Chakra interactive primitives
7. 🔴 No watch-mode commands — always run-once
8. 🔴 No hardcoded color shades or `_dark={{}}` overrides — semantic tokens only
9. 🔴 No flaky tests — fix the test, never retry/skip/timeout-pad your way past it

---

**Last Updated:** May 2026 · **Doc version:** 2.0 · **Project version:** 1.5.0 · **For:** Claude Code, Cursor, Copilot, Gemini, and other AI assistants
