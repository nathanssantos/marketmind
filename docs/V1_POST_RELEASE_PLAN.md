# v1 Post-Release Plan

> Status: drafted **2026-04-27** after `v1.0.0` ship. Living document — update phases as they complete.

## Design language — read first

Everything below assumes the **MarketMind compact style** that already lives in:
- `Layout/Toolbar.tsx` (top app header, height `30px`)
- `Layout/ChartToolsToolbar.tsx` (left vertical drawing toolbar)
- `Layout/QuickTradeToolbar.tsx` (boleta)

Reference frame: **VSCode density**. Compact and objective — every pixel justified, no decorative spacing.

### Compact-style rules (apply to every component touched in Fases 1-6)

| Property | Compact value | Old/avoid |
|---|---|---|
| Section heading | `fontSize="sm"` semibold, `lineHeight="1.2"` | `md`/`lg` headings |
| Body text | `fontSize="xs"` `lineHeight="1.45"` | `sm` default |
| Helper / hint | `fontSize="2xs"` `color="fg.muted"` | `xs` |
| Buttons (primary action) | `size="sm"` | `md` |
| Buttons (secondary / row action) | `size="xs"` or `2xs` | `sm`/`md` |
| Stack gap (sections) | `gap={5}` | `gap={6+}` |
| Stack gap (rows) | `gap={3}` | `gap={4}` |
| Stack gap (inline) | `gap={2}` | `gap={3+}` |
| Dialog content padding | `p={4}` | `p={6}` |
| Section content padding | `p={3}` | `p={4}` |
| Compact inline padding | `px={2.5} py={1.5}` (Callout `compact`) | `px={3} py={2.5}` |
| Avatar / preview blocks | `64×64` | `80×80+` |
| Border radius | `md` (4px) — `sm` for badges | `lg` |
| Borders | `borderWidth="1px"` semantic tokens | `2px` shoutful |
| Icons inside compact buttons | `size={12-14}` | `16+` |

### Component primacy (use these — not ad-hoc)

| Pattern | Component |
|---|---|
| Section block | `<FormSection title=... description=... action=...>` |
| Row with label + control | `<FormRow label=... helper=...>` |
| Toned banner (info/warn/danger/success/neutral) | `<Callout tone=... compact>` |
| Pill / status marker | `<Badge colorPalette=...>` (never `<Box bg="green.100" _dark={...}>`) |
| Eyebrow / subtitle | `<SubsectionTitle>` |
| Always-open section header | `<CollapsibleSection variant="static">` |
| Collapsible (where it actually helps) | `<CollapsibleSection variant="collapsible">` (default) |

**Forbidden patterns** (every occurrence is a refactor target):
- `bg="X.50"` / `bg="X.900"` / `_dark={{ bg: 'X.900' }}` overrides — use `X.subtle`/`X.muted` semantic tokens
- `<Alert.Root>...</Alert.Root>` for inline contextual messages — use `<Callout>`
- Hardcoded `color="X.600"` / `color="X.200"` — use `.fg` / `.subtle` / `.muted`
- Custom `<Box>` pretending to be a section header — use `<FormSection>`

---

## Phase 1 — Quality & tests

Goal: cover the v1 sweep refactors that shipped without unit tests, wire up Notifications for real, deepen backend integration tests.

### 1.1 Unit tests for v1 refactors
- `Trading/DirectionBadge.test.tsx` — `long_only` / `short_only` / btc trend variants (BULLISH/BEARISH/neutral) / skipped count
- `Trading/DynamicSymbolRankings.test.tsx` — active marker / added pills / removed pills
- `Trading/CreateWalletDialog.test.tsx` — exchange switch (Binance↔IB) / wallet type variants / Callout error states
- `Trading/AddWatcherDialog.test.tsx` — single↔bulk mode / profile selector / submit gate
- `Trading/ImportProfileDialog.test.tsx` — JSON parse validation / preview / import mutation
- `Trading/StartWatchersModal.test.tsx` — direction toggles / count input / quick-start mutation
- `ui/Callout.test.tsx` + `ui/FormSection.test.tsx` + `ui/FormRow.test.tsx` — primitives smoke tests

### 1.2 Backend test depth
- audit-logger masking integration: assert email is masked at every call site (`auth.login`, `auth.register`, `auth.changePassword`, `auth.requestPasswordReset`, etc.) — never raw email in serialized payload
- concurrent session revoke (race condition coverage)
- avatar edge cases — empty string data, whitespace-only, malformed base64, oversized

### 1.3 NotificationsTab — wire up to real toaster
- `orderToastsEnabled` → guard inside `useOrderNotifications` hook
- `setupToastsEnabled` → guard inside `useSetupNotifications`
- `notificationSoundEnabled` → Web Audio API beep on success/info/warn/error in `toaster.ts`
- e2e test: toggle off → trigger event → assert toast NOT called

### 1.4 Acceptance
- All 4 sub-phases shipped in 1 PR (`feature/v1-quality-pass`)
- Frontend unit tests +20-25
- Backend integration tests +5-8
- 0 lint errors, 0 type errors
- All e2e specs still pass

---

## Phase 2 — Code/architecture

### 2.1 Design tokens
- Extract spacing + typography scale to `apps/electron/src/renderer/theme/tokens.ts` (export named constants matching the compact-style table above)
- Refactor `FormSection`, `FormRow`, `Callout`, typography components to consume tokens
- Document in `UI_STYLE_GUIDE.md` with copy-pasteable examples
- Tokens are the single source of truth — components reference, never hardcode

### 2.2 `@marketmind/ui` package extraction prep
- Audit `apps/electron/src/renderer/components/ui/*` for cross-imports (`@renderer/...`, `@shared/...`)
- Convert deps to props (e.g. `useColorMode` becomes a prop or moves to a context the package owns)
- Set up `packages/ui` workspace skeleton (`package.json`, `tsconfig.json`, barrel `index.ts`)
- Migration checklist per component (track in `packages/ui/MIGRATION.md`)

### 2.3 Acceptance
- Tokens in use across all primitives
- Style guide section "Tokens" with table of every token + value
- `packages/ui` exists, builds, but is not yet consumed (extraction starts in v1.2)

---

## Phase 3 — Sidebars deep review

Apply the compact-style rules + primitives to every sidebar.

### 3.1 TradingSidebar (`Trading/TradingSidebar.tsx`)
- Header → `FormSection`-style block
- Tabs styling consistent with main settings rail
- Portfolio/Orders bodies: review row gaps, button sizes

### 3.2 AutoTradingSidebar (`AutoTrading/AutoTradingSidebar.tsx`)
- Same pass

### 3.3 MarketSidebar (`MarketSidebar/`)
- Tabs: PairsTab, WatchersTab, LogsTab, SetupsTab, RankingsTab, etc.
- Each tab body — apply FormSection / FormRow / Callout where applicable

### 3.4 OrderFlowSidebar (`OrderFlow/`)
- Same pass

### 3.5 Acceptance
- 0 hardcoded `X.50`/`X.900` color shades in sidebar tree
- 0 ad-hoc `<Box bg=... _dark={{...}}>` patterns
- All section headers use `FormSection` or `SubsectionTitle`
- Sidebar e2e specs still pass

---

## Phase 4 — Modal deep review

### 4.1 OrdersDialog (`Trading/OrdersDialog.tsx`) — pula passada superficial, faz review completo
- Stats bar at top → semantic tokens
- Filter bar → `FormRow`-aligned controls
- Pagination → compact buttons

### 4.2 BacktestForm tabs internos
- `Backtest/tabs/RiskTab.tsx` — already converted to `variant="static"`; revisit fields/grids spacing
- `Backtest/tabs/FiltersTab.tsx` — kept collapsible; verify each FilterCard layout
- `BacktestForm.tsx` outer shell

### 4.3 ScreenerModal body
- `Screener/ScreenerFiltersBar.tsx`
- `Screener/ScreenerResultsTable.tsx` — compact table densities
- Saved-screeners section

### 4.4 AnalyticsModal subpanels
- `Analytics/EquityCurveChart.tsx`
- `Analytics/PerformanceCalendar.tsx`
- `Trading/PerformancePanel.tsx`
- `MarginInfoPanel.tsx`

### 4.5 Acceptance
- All 4 modals pass compact-style audit
- Screenshots before/after committed to PR description
- e2e specs still pass

---

## Phase 5 — MCP infrastructure (do most complete possible)

This is what the user asked for explicitly: **fazer o mais completo possível**. Five MCP servers ship in this phase.

### 5.1 Workspace setup
- `packages/mcp-app/` — workspace
- Stdio transport (works with Claude Code, Claude Desktop, Cursor, etc.)
- Discovery via `init.json` listing all tools per server
- Health-check tool on every server

### 5.2 `mm-screenshot-mcp` (priority — enables Phase 6)
- `screenshot.tab(tabId)` — Settings tab
- `screenshot.modal(name, state?)` — any registered modal
- `screenshot.sidebar(name)` — any sidebar
- `screenshot.fullPage(label)` — whatever's currently rendered
- `screenshot.gallery({ tabs?, modals?, sidebars?, themes?: ['dark', 'light'] })` — generates HTML index of every capture, side-by-side dark/light, timestamped
- Implementation: spawns a Playwright browser, installs trpc mock, drives `__globalActions` bridge, captures, persists under `apps/electron/screenshots/{timestamp}/`

### 5.3 `mm-app-mcp` (renderer control)
- Navigation: `app.openSettings(tab?)` / `app.closeSettings()` / `app.openModal(name)` / `app.closeAll()`
- Symbol/chart: `app.navigateToSymbol(symbol, marketType?)` / `app.setTimeframe(tf)` / `app.setChartType(type)`
- UI state: `app.toggleIndicator(id)` / `app.applyTheme('dark'|'light')` / `app.toggleSidebar(name)`
- Generic dispatch: `app.dispatchToolbar(action)` — clicks any toolbar button by ID
- Escape hatch: `app.click(selector)` / `app.fill(selector, value)` / `app.waitFor(condition, timeout?)`
- Capture: `app.takeScreenshot(label?)` (also exposed)
- Store inspection: `app.inspectStore(name)` — read-only access to `priceStore | indicatorStore | layoutStore | drawingStore | uiStore | preferencesStore`
- Store dispatch (whitelisted): `app.dispatchStore(name, action, payload)` — scoped writes only

### 5.4 `mm-backend-mcp` (DB + tRPC bridge)
- DB queries (read-only): `db.query.{wallets, executions, orders, klines, users, sessions, watchers, setups, autoTradingConfig}`
- SQL escape hatch (read-only): `db.exec(sql)`
- tRPC bridge: `trpc.call(path, input)` — invoke any endpoint via authenticated caller
- Audit log: `audit.tail({event?, since?, limit?})`
- Health: `health.check()` — DB + Redis + Binance + IB connectivity

### 5.5 `mm-strategy-mcp` (power-user)
- `strategy.list()` — all 106 builtin + user
- `strategy.run({id, symbol, interval, range, params?})` — direct backtest
- `strategy.diff({id, paramsA, paramsB, fixture})` — A/B compare
- `strategy.optimize({id, grid, fixture})` — grid search runner
- `strategy.create({json})` / `strategy.export({id})`

### 5.6 `mm-trading-mcp` (paper-only by default)
- `paper.placeOrder({symbol, side, qty, price?, type})`
- `paper.closePosition({executionId})`
- `paper.listExecutions({walletId, status?})`
- `live.*` namespace gated by `MCP_ENABLE_LIVE_TRADING=true` env — disabled by default for safety

### 5.7 Documentation
- `docs/MCP_SERVERS.md` — overview, install, per-server reference
- `docs/MCP_AGENT_GUIDE.md` — common-flow examples ("rode 5 backtests com esses params", "feche todas as posições BTCUSDT", "screenshot todos os modais em dark mode", "compare backtest A vs B em ETHUSDT")
- Per-package README with setup

### 5.8 Configuration
- `pnpm mcp:install` — single-command registers all 5 servers in Claude Code's `~/.claude.json`
- Auto-detection via `package.json` `mcp` field
- Telemetry opt-in: which tools are being invoked (helps understand which surface to grow)

### 5.9 Acceptance
- 5 servers exposing 30+ tools combined
- All servers pass their own contract tests (each tool call returns expected schema)
- `pnpm mcp:install` works locally
- Docs cover every tool with input/output examples

---

## Phase 6 — Visual verification (uses Phase 5)

Runs the screenshot pipeline, reviews tela-a-tela, lands fixes.

### 6.1 Initial capture
- Run `mm-screenshot-mcp gallery({tabs: 'all', modals: 'all', sidebars: 'all', themes: ['dark', 'light']})`
- ~80-120 screenshots expected
- Side-by-side dark/light HTML index

### 6.2 Tela-a-tela review
- For each screenshot, score against compact-style rules: spacing, typography, color tokens
- Flag inconsistencies in a checklist file

### 6.3 Fixes
- Iterate per file: re-capture, diff vs golden, repeat until clean

### 6.4 Visual regression baseline
- Commit `apps/electron/screenshots/baseline/` as golden files
- Add CI step that runs the gallery on PR + diffs vs baseline → fails on >5% pixel diff
- Single image: 80-120 captures × ~200KB = 15-25MB total — manageable

### 6.5 Acceptance
- 0 inconsistencies vs compact-style rules
- Baseline golden files committed
- Visual regression CI step active

---

## Phase 7 — Polish + release v1.1

### 7.1 CHANGELOG `v1.1.0` entry
### 7.2 Site update — `marketmind-site/src/config/site.ts` — version + test count + new MCP feature blurb
### 7.3 Release tag `v1.1.0` triggering desktop builds

---

## Notes & open questions

- **MCP scope** — user explicitly asked for "mais completo possível". Built into Phase 5: 5 servers, 30+ tools, paper trading enabled, live trading gated.
- **Visual regression budget** — 80-120 screenshots × 200KB ≈ 20MB in repo. Acceptable. If grows much beyond, switch to LFS or external bucket.
- **Compact-style rules are non-negotiable** — every refactor in Phases 3-4-6 follows them. Any deviation requires a comment justifying why.
- **Notifications tab** — currently placeholder. Phase 1.3 wires it up properly. After that, can extend with email push (deferred to v1.2+).
