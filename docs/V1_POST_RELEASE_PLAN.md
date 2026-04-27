# v1 Post-Release Plan

> Status: drafted **2026-04-27** after `v1.0.0` ship; revised after max-effort review the same day. Living document — update phases as they complete.

---

## TL;DR — what changes vs the first draft

After a deep review, the plan was tightened in 8 ways:

1. **Trading MCP deferred to v1.2** — exposing trade execution via MCP needs more security design than fits in v1.1; the other 4 servers are valuable independently.
2. **`@marketmind/ui` extraction split** — Phase 2.2 produces an *audit + migration plan* in v1.1; the actual extraction is its own future PR train.
3. **MCP servers split into 4 packages** (`mcp-screenshot`, `mcp-app`, `mcp-backend`, `mcp-strategy`) — each independently installable.
4. **Security model section added** for MCP — auth, audit, rate limiting, env gates.
5. **Cross-cutting concerns** section made explicit (i18n×4 langs, dark/light parity, a11y minimums, performance budget).
6. **Risk + mitigation table** added at the top — surfaces blast radius per phase.
7. **Dependency graph** added — clarifies what blocks what.
8. **Compact-style values tightened** by one notch toward VSCode density (button primary `xs`, gap section `4`, gap row `2.5`, dialog padding `p={3}`).

---

## Design language — read first

Everything below assumes the **MarketMind compact style** that already lives in:
- `Layout/Toolbar.tsx` (top app header, height `30px`)
- `Layout/ChartToolsToolbar.tsx` (left vertical drawing toolbar)
- `Layout/QuickTradeToolbar.tsx` (boleta)

Reference frame: **VSCode density**. Compact and objective — every pixel justified, no decorative spacing.

### Compact-style rules (apply to every component touched in Phases 1–6)

| Property | Compact value | Old/avoid |
|---|---|---|
| Section heading | `fontSize="sm"` semibold, `lineHeight="1.2"` | `md`/`lg` headings |
| Subsection / eyebrow | `fontSize="2xs"` uppercase tracked, color `fg.muted` | inline bold |
| Body text | `fontSize="xs"` `lineHeight="1.45"` | `sm` default |
| Helper / hint | `fontSize="2xs"` `color="fg.muted"` | `xs` |
| Buttons (primary action) | `size="xs"` | `sm`/`md` |
| Buttons (secondary / row action) | `size="2xs"` | `sm`/`md` |
| Stack gap (between sections) | `gap={4}` | `gap={5}+` |
| Stack gap (rows in a section) | `gap={2.5}` | `gap={4}+` |
| Stack gap (inline / tight) | `gap={1.5}–{2}` | `gap={3+}` |
| Dialog content padding | `p={3}` (header `pt={4}`, body `p={3}`) | `p={6}` |
| Section content padding | `p={2.5}` | `p={4}` |
| Compact inline padding (`Callout compact`) | `px={2.5} py={1.5}` | `p={3+}` |
| Avatar / preview blocks | `48×48` to `64×64` | `80×80+` |
| Border radius | `sm` (2px) for badges, `md` (4px) for cards | `lg` |
| Borders | `borderWidth="1px"` semantic tokens (`X.muted`) | `2px` |
| Icons in compact buttons | `12–14px` | `16+` |
| Icons in section headers | `14–16px` | `20+` |
| Switch / Checkbox | `size="sm"` (default for our wrappers) | `md` |

> **a11y floor** — never go below `fontSize="2xs"` (10px) for any text. Helper/hint at `2xs` is the minimum. Body text stays at `xs` (12px) minimum. Tab targets ≥ `28×28` (Chakra `xs` size hits this).

> **When in doubt, lean tighter** — favor density over decoration. Toolbars (`Toolbar.tsx`, `ChartToolsToolbar.tsx`) are even tighter than this table; emulate them where the surface is purely controls.

### Component primacy (use these — not ad-hoc)

| Pattern | Component | Forbidden replacement |
|---|---|---|
| Section block | `<FormSection title description action>` | `<Box>` + `<Heading>` + `<Stack>` |
| Row with label + control | `<FormRow label helper>` | inline `<HStack>` with manual layout |
| Toned banner | `<Callout tone="info\|success\|warning\|danger\|neutral" compact>` | `<Alert.Root>`, `<Box bg="X.50">` |
| Pill / status marker | `<Badge colorPalette>` | `<Box bg="green.100" _dark={...}>` |
| Eyebrow / subtitle | `<SubsectionTitle>` | inline bold `<Text>` |
| Always-open section header | `<CollapsibleSection variant="static">` | manual heading + content |
| Collapsible (where it actually helps) | `<CollapsibleSection variant="collapsible">` (default) | hand-rolled accordion |

**Forbidden patterns** (every occurrence is a refactor target):
- `bg="X.50"` / `bg="X.100"` / `bg="X.900"` shade literals → use `X.subtle` / `X.muted` semantic tokens
- `_dark={{ bg: 'X.900', color: 'X.200' }}` overrides → use semantic tokens that auto-resolve
- `<Alert.Root status="...">` for inline contextual messages → use `<Callout>`
- Hardcoded `color="X.600"` / `X.500` on text → use `.fg` / `.subtle` / `.muted`
- Custom `<Box>` pretending to be a section header → use `<FormSection>`
- `<Heading size="md+">` inside a dialog → too big; use `<SectionTitle>` or sm

---

## Cross-cutting concerns (every phase respects these)

### CC-1 i18n × 4 languages
- Any new user-facing string lands in **all four** locale files: `en`, `pt`, `es`, `fr`.
- Verify post-edit: `for f in en pt es fr; do node -e "JSON.parse(...)" || echo "$f FAIL"; done`
- Reuse existing keys before adding new ones.

### CC-2 Dark + light parity
- Every visual change is verified in both modes.
- Semantic tokens (`X.subtle`, `X.muted`, `X.fg`) handle dark/light automatically — never use shade literals or `_dark` overrides.

### CC-3 Accessibility minimums
- Every interactive element keyboard-reachable (`tab` order verified)
- Every input/control has a label (via `<Field label>`) or `aria-label`
- Color contrast ≥ WCAG AA (Chakra semantic tokens already pass)
- No text below `fontSize="2xs"` (10px)
- `aria-disabled` and `disabled` set together where applicable
- Tabs use `role="tab"`/`tabpanel` (Chakra `Tabs` provides; verify don't strip)

### CC-4 Performance budget
- Settings dialog open: < 200ms first paint (jsdom + browser tests both)
- Tab switch: < 50ms (no heavy queries on inactive tabs)
- Track via `perfMonitor.recordComponentRender` already wired in MainLayout — extend to dialogs
- Visual regression: pixel diff < 0.5% per screenshot; >2% blocks merge
- E2E suite: total runtime budget 25min on PR (currently ~20min)

### CC-5 Per-PR mandate (CLAUDE.md non-negotiables)
- `pnpm --filter @marketmind/electron type-check` → 0 errors
- `pnpm --filter @marketmind/backend type-check` → 0 errors
- `pnpm --filter @marketmind/electron lint` → 0 errors (warnings allowed for pre-existing)
- All tests pass: backend unit + frontend unit + browser + e2e
- CHANGELOG `[Unreleased]` section appended (not new section until v1.1.0 cut)

### CC-6 Rollback strategy
- Every PR is squash-merged → single revert commit reverses cleanly
- Schema migrations are additive only; never destroy a column in v1.x
- Feature flags for risky toggles (e.g., MCP live-trading gate)

---

## Risk + mitigation

| Phase | Top risk | Likelihood | Mitigation |
|---|---|---|---|
| 1.1 Unit tests | False sense of coverage from shallow tests | Med | Each test must include at least one meaningful assertion (mutation called, store updated) — not just "renders" |
| 1.3 Notifications wiring | Silently breaking existing toasts | Med | E2E spec: simulate price update → assert toast appears → toggle off → assert no toast |
| 2.1 Design tokens | Token rename ripples 100+ files | High | Tokens are additive; old literals coexist until refactored. Track migration in `tokens-migration.md` |
| 2.2 ui extraction | Hidden coupling explodes during port | High | This phase **only audits + plans**, doesn't extract. Extraction is v1.2. |
| 3 Sidebars | Functional regression in trading flows | High | Re-run all sidebar e2e specs after each sub-phase; bisect on regression |
| 4 Modals | Backtest modal breaks existing workflows | Med | Snapshot tests before/after for each modal |
| 5 MCP screenshot | Browser process leak / OOM | Med | Single browser instance per server lifetime; restart on N captures or 1h |
| 5 MCP app | Store mutations from MCP corrupt state | High | Whitelist actions; default to read-only inspection |
| 5 MCP backend | SQL escape hatch enables abuse | High | Read-only DB user; allowlist `SELECT` only; per-call audit log |
| 5 MCP all | MCP servers run with elevated rights | High | Each server runs as separate process with minimal env (no DB write creds for read-only) |
| 6 Visual regression | Font rendering varies CI vs dev | High | Goldens captured in CI environment; per-test `maxDiffPixels` thresholds |
| 6 Pixel-diff CI cost | Adds ~5min per PR | Med | Run only on PRs touching `apps/electron/src/renderer/components/**`; skip on docs-only |

---

## Phase dependency graph

```
v1.0.0 (shipped)
   │
   ├── Phase 1 (quality + tests + Notifications wiring)
   │      │
   │      ├── Phase 2.1 (design tokens) ─────┐
   │      ├── Phase 2.2 (ui audit/plan)      │
   │      │                                   │
   │      └── Phase 5a (mcp-screenshot) ──┐   │
   │                                       │   │
   │                                       ▼   ▼
   │                                  ┌────────────┐
   │                                  │ Phase 3    │ (sidebars apply tokens)
   │                                  └────┬───────┘
   │                                       ▼
   │                                  ┌────────────┐
   │                                  │ Phase 4    │ (modals apply tokens)
   │                                  └────┬───────┘
   │                                       ▼
   │                                  ┌────────────┐
   │                                  │ Phase 5b   │ (mcp-app/backend/strategy)
   │                                  └────┬───────┘  (parallel-able with 6)
   │                                       ▼
   │                                  ┌────────────┐
   │                                  │ Phase 6    │ (visual verify w/ MCP)
   │                                  └────┬───────┘
   │                                       ▼
   │                                  ┌────────────┐
   │                                  │ Phase 7    │ (v1.1.0 release)
   │                                  └────────────┘
```

**Parallelizable**: 5b can run alongside Phase 6 (different surface, no conflict). 5a is a hard prereq for 6.

---

## Phase 1 — Quality & tests

> Goal: cover the v1 sweep refactors that shipped without unit tests, wire Notifications to the real toaster, deepen backend integration tests.

### 1.1 Unit tests for v1 refactors
Each test file ≥ 4 assertions covering behavior (not just render).

- `Trading/DirectionBadge.test.tsx` — `long_only` / `short_only` / btc trend variants (BULLISH/BEARISH/NEUTRAL) / skipped count visibility / isIB short-circuit
- `Trading/DynamicSymbolRankings.test.tsx` — active marker / added pills / removed pills / loading state
- `Trading/CreateWalletDialog.test.tsx` — exchange switch (Binance↔IB) wallet-type defaults / Callout error states / submit gating
- `Trading/AddWatcherDialog.test.tsx` — single↔bulk mode toggle / profile selector visibility (useDefault toggle) / submit fires correct mutation
- `Trading/ImportProfileDialog.test.tsx` — JSON parse validation / preview / import mutation
- `Trading/StartWatchersModal.test.tsx` — direction toggles fire updateConfig / count input bounded by max / quick-start mutation
- `ui/Callout.test.tsx` — every tone renders right icon + colors / title vs body composition / compact vs default padding
- `ui/FormSection.test.tsx` — title/description/action layout / no-header rendering / contentGap respected
- `ui/FormRow.test.tsx` — label/helper layout / action slot

### 1.2 Backend test depth
- `audit-logger` masking integration: assert email is masked at every call site (`auth.login`, `auth.register`, `auth.changePassword`, `auth.requestPasswordReset`, `auth.verifyTwoFactor`, `auth.toggleTwoFactor`) — full email NEVER in serialized payload
- Concurrent session revoke (race: two clients revoke same session simultaneously)
- Avatar edge cases — empty data, whitespace-only, malformed base64, oversized (just above cap)
- ChangePassword: assert sessions OTHER than current invalidated; current persists; new password works
- updateProfile: avatarColor validation regex edge cases (`#FFFFFF`, `#000000`, lowercase `#abcdef`, invalid `red`, invalid `#FFG`)

### 1.3 NotificationsTab — wire to real toaster
Currently a placeholder; turn switches into real behavior.

- `orderToastsEnabled` → guard inside `useOrderNotifications` hook + any direct `toaster.create(...)` for orders
- `setupToastsEnabled` → guard inside setup notification path
- `notificationSoundEnabled` → Web Audio API beep on success/info/warn/error in `toaster.ts` `createToaster` wrapper (or post-create hook)
- E2E spec: simulate `order:filled` socket event → assert toast → toggle off → assert no toast

### 1.4 Accessibility (a11y) audit on Settings dialog
- All 13 tab triggers reachable via keyboard arrow keys (Chakra `Tabs` should provide; verify in browser test)
- Focus trap inside dialog (Chakra Dialog provides; verify)
- Avatar color picker buttons have `aria-label` (already do — verify with axe/manual)
- Field labels associated with inputs (Chakra `Field` provides — verify)
- Run `axe-core` against settings-overhaul e2e spec; fail on serious/critical violations

### 1.5 Acceptance
- 1 PR (`feature/v1-quality-pass`)
- Frontend unit tests: 2155 → ~2180 (+25)
- Backend integration tests: 5389 → ~5400 (+10)
- a11y violations: 0 serious / 0 critical
- All CC-5 mandates pass

---

## Phase 2 — Code/architecture

### 2.1 Design tokens
- Define spacing + typography tokens via Chakra theme system (not parallel TS constants — keeps Chakra recipes consistent)
- File: `apps/electron/src/renderer/theme/tokens.ts` exports objects, registered into Chakra theme via `theme/index.ts`
- Tokens to add:
  - `mm.spacing.section` = `{ base: '1rem', xl: '1.25rem' }` (16-20px)
  - `mm.spacing.row` = `{ base: '0.625rem' }` (10px)
  - `mm.spacing.inline` = `{ base: '0.375rem' }` (6px)
  - `mm.spacing.dialogPadding` = `{ base: '0.75rem' }` (12px)
  - `mm.font.sectionTitle.size` = `'sm'`, `weight` = `'semibold'`
  - `mm.font.body.size` = `'xs'`
  - `mm.font.hint.size` = `'2xs'`
- Refactor `FormSection` / `FormRow` / `Callout` / typography components to consume tokens (no behavior change — just centralization)
- Document in `UI_STYLE_GUIDE.md` with copy-pasteable token names + values

### 2.2 `@marketmind/ui` extraction — audit + plan only
*Scope adjusted: extraction is v1.2; v1.1 produces the migration map.*

- Audit `apps/electron/src/renderer/components/ui/*` for cross-imports:
  - `@renderer/...` (renderer-specific stores/hooks)
  - `@shared/...` (renderer-only shared)
  - external deps already in `apps/electron/package.json` not yet extractable
- For each component: list its dependencies, classify (clean / coupled / blocker)
- Output: `packages/ui/MIGRATION.md` with per-component migration steps + recommended order

### 2.3 Acceptance
- Tokens land + primitives consume them
- Style guide documents token names + values
- Migration plan checked in (no extraction yet)
- All CC-5 mandates pass

---

## Phase 3 — Sidebars deep review

Apply compact-style rules + primitives to every sidebar. Each sub-phase = 1 PR. Re-run sidebar e2e after each.

### 3.1 TradingSidebar (`Trading/TradingSidebar.tsx`)
- Header → `FormSection`-style block
- Tabs styling consistent with main settings rail
- Portfolio + Orders bodies: row gaps, button sizes per compact-style
- Re-run: `sidebar-quick-trade.spec.ts`, `trading-flow.spec.ts`

### 3.2 AutoTradingSidebar (`AutoTrading/AutoTradingSidebar.tsx`)
- Same pass
- Re-run: `auto-trading-sidebar-toggle.spec.ts`, `auto-trading-watcher-manager.spec.ts`

### 3.3 MarketSidebar (`MarketSidebar/`)
- Tabs: PairsTab, WatchersTab, LogsTab, SetupsTab, RankingsTab
- Each tab body — apply FormSection / FormRow / Callout where applicable
- Re-run: existing market-sidebar specs

### 3.4 OrderFlowSidebar (`OrderFlow/`)
- Same pass
- Re-run: order-flow specs

### 3.5 Acceptance
- 0 hardcoded `X.50`/`X.100`/`X.900` shades in sidebar tree (grep clean)
- 0 ad-hoc `<Box bg=... _dark={{...}}>` patterns
- All section headers use `FormSection` or `SubsectionTitle`
- Sidebar e2e specs all pass
- Visual regression: each sidebar's screenshot diff < 5% (some shift expected)

---

## Phase 4 — Modal deep review

### 4.1 OrdersDialog (`Trading/OrdersDialog.tsx`)
- Stats bar at top → semantic tokens
- Filter bar → `FormRow`-aligned controls
- Pagination → compact buttons
- Re-run: any orders e2e

### 4.2 BacktestForm internals
- `Backtest/tabs/RiskTab.tsx` — already `variant="static"`; revisit field grids
- `Backtest/tabs/FiltersTab.tsx` — kept collapsible; FilterCard layout
- `BacktestForm.tsx` outer shell
- Re-run: `backtest-modal-flow.spec.ts`, `backtest-modal-open.spec.ts`

### 4.3 ScreenerModal body
- `Screener/ScreenerFiltersBar.tsx`
- `Screener/ScreenerResultsTable.tsx` — compact table density
- Saved-screeners section
- Re-run: `screener-modal-flow.spec.ts`

### 4.4 AnalyticsModal subpanels
- `Analytics/EquityCurveChart.tsx`
- `Analytics/PerformanceCalendar.tsx`
- `Trading/PerformancePanel.tsx`
- `MarginInfoPanel.tsx`
- Re-run: `analytics-modal.spec.ts`

### 4.5 Acceptance
- All 4 modals pass compact-style audit
- Screenshots before/after committed in PR description
- All e2e specs pass
- Visual regression diffs < 5%

---

## Phase 5 — MCP infrastructure

> User directive: **fazer o mais completo possível**. Four MCP servers ship in v1.1; trading MCP deferred to v1.2 (security design).

### 5.0 Security model (apply to every MCP server)
- **Process isolation**: each server is its own Node process (stdio transport), spawned by Claude Code/Desktop on demand. Servers do NOT share memory with the main app.
- **Auth**: each server reads a session token from env `MM_MCP_TOKEN` (rotated per local install). Backend verifies token on every tRPC bridge call.
- **DB credentials**: read-only servers (`mcp-backend` query path) use a read-only PG role (`marketmind_ro`); write-capable servers (none in v1.1) would use scoped roles.
- **Rate limiting**: each server enforces an in-process rate limit (default 30 req/min) — protects against runaway agent loops.
- **Audit log**: every tool call logs to `mcp-audit.log` with timestamp, tool name, input hash, result status. The log lives in `~/.marketmind/mcp-audit.log` (rotated daily, 30-day retention).
- **No live trading**: explicit allowlist of tools per server; `live.*` namespace not exposed in v1.1. Trading MCP is a separate v1.2 design.

### 5.1 Workspace setup
- `packages/mcp-screenshot/`, `packages/mcp-app/`, `packages/mcp-backend/`, `packages/mcp-strategy/` — four workspace packages
- Each: `package.json` with `bin`, stdio transport via `@modelcontextprotocol/sdk`, contract test
- Discovery: each server publishes `tools.list` returning JSON schema per tool
- Health check tool on every server: `__health()` → returns version, uptime, last-error

### 5.2 `mcp-screenshot` (priority — Phase 6 hard prereq)
Tools:
- `screenshot.tab(tabId)` — Settings tab capture
- `screenshot.modal(name, state?)` — any registered modal in any state
- `screenshot.sidebar(name)` — any sidebar
- `screenshot.fullPage(label)` — current state
- `screenshot.gallery({ tabs?: 'all'|string[], modals?: 'all'|string[], sidebars?: 'all'|string[], themes?: ['dark', 'light'] })` — generates HTML index of all captures

Implementation:
- Spawns Playwright Chromium browser, single instance per server lifetime, restart after 50 captures or 30min idle
- Installs trpc mock (`installTrpcMock` from existing e2e helpers)
- Drives `__globalActions` bridge for navigation
- Persists captures to `apps/electron/screenshots/{timestamp}/` (PNG) + index `gallery.html`
- Captures both dark + light when `themes` includes both
- Cleans up captures > 7 days old on server start

### 5.3 `mcp-app` (renderer control)
Read-mostly tools that drive the dev-mode app:
- Navigation: `app.openSettings(tab?)` / `app.closeSettings()` / `app.openModal(name)` / `app.closeAll()`
- Symbol: `app.navigateToSymbol(symbol, marketType?)` / `app.setTimeframe(tf)` / `app.setChartType(type)`
- UI state: `app.toggleIndicator(id)` / `app.applyTheme('dark'|'light')` / `app.toggleSidebar(name)`
- Generic dispatch: `app.dispatchToolbar(action)` (allowlisted button IDs)
- Escape hatch: `app.click(selector)` / `app.fill(selector, value)` / `app.waitFor(condition, timeout?)`
- Screenshot proxy: `app.takeScreenshot(label?)`
- Store inspection (read-only): `app.inspectStore(name)` — `priceStore | indicatorStore | layoutStore | drawingStore | uiStore | preferencesStore`
- Whitelist store dispatch: `app.dispatchStore(name, action, payload)` — allowlist of {store, action} pairs only

### 5.4 `mcp-backend` (DB + tRPC bridge, read-only)
- DB queries (read-only role): `db.query.{wallets, executions, orders, klines, users, sessions, watchers, setups, autoTradingConfig}`
  - Each takes typed input matching the table's natural query shape (e.g. `executions: { walletId, status?, since?, limit?: 100 }`)
- SQL escape hatch (read-only): `db.exec(sql)` — runs as `marketmind_ro` role; rejects any non-`SELECT` keyword
- tRPC bridge: `trpc.call(path, input)` — invoke any procedure via authenticated caller (`mcp-bot-user`)
- Audit log: `audit.tail({event?, since?, limit?})`
- Health: `health.check()` — DB + Redis (if running) + Binance + IB connectivity

### 5.5 `mcp-strategy` (power-user)
- `strategy.list()` — 106 builtin + user
- `strategy.run({id, symbol, interval, range, params?})` — direct backtest, returns BacktestResult
- `strategy.diff({id, paramsA, paramsB, fixture})` — A/B compare
- `strategy.optimize({id, grid, fixture})` — grid search runner (long-running, returns task id; client polls)
- `strategy.create({json})` — register a new user-defined strategy from JSON (validated)
- `strategy.export({id})` — export strategy JSON

### 5.6 ~~`mcp-trading`~~ — **deferred to v1.2**
Reasons:
- Trade execution via MCP needs a per-call confirmation UI
- Audit trail beyond simple log (per-trade attribution to MCP origin)
- Wallet whitelist + monetary cap per session
- Threat model: prompt injection → unintended trade
- Dedicated PR with security review

### 5.7 Documentation
- `docs/MCP_SERVERS.md` — overview, install, per-server reference (every tool with input + output schema + example)
- `docs/MCP_AGENT_GUIDE.md` — common-flow examples:
  - "rode 5 backtests com esses params, me mostre comparison" (uses `mcp-strategy.diff`)
  - "screenshot todos os modais em dark e light" (uses `mcp-screenshot.gallery`)
  - "mostre a P&L total da carteira X" (uses `mcp-backend.db.query.executions`)
  - "abra Settings na aba Security e me mostre" (uses `mcp-app.openSettings('security')` + `screenshot.fullPage`)
- `docs/MCP_SECURITY.md` — threat model, env gates, audit log retention, RBAC for DB
- Per-package README with quick-start

### 5.8 Configuration
- `pnpm mcp:install` — single-command registers all 4 servers in Claude Code's `~/.claude.json`
- Auto-detection via `package.json` `"mcp"` field per package
- Telemetry: opt-in env `MM_MCP_TELEMETRY=true` — logs which tools invoked (stdout only, never sent off-machine in v1.1)

### 5.9 Acceptance
- 4 servers exposing 30+ tools combined
- Contract test per server (each tool returns expected schema)
- `pnpm mcp:install` works on fresh checkout
- Docs cover every tool with input/output examples
- Audit log writes verified
- All CC-5 mandates pass

---

## Phase 6 — Visual verification (uses Phase 5)

### 6.1 Initial capture
- `pnpm mcp:run mcp-screenshot screenshot.gallery({tabs: 'all', modals: 'all', sidebars: 'all', themes: ['dark', 'light']})`
- Expected: ~80–120 captures
- Output: HTML index with side-by-side dark/light per surface

### 6.2 Tela-a-tela review
- For each surface, score against compact-style rules
- Track issues in `docs/visual-review-2026-04.md` (issue per surface, severity, target phase)
- Group findings by severity:
  - **P0** — broken layout / overflow / mismatched theme
  - **P1** — inconsistent spacing/typography
  - **P2** — minor token miss
- Drive to 0 P0/P1 before baseline. P2 documented for v1.2.

### 6.3 Fixes
- Iterate per file: re-capture, diff vs previous, repeat until clean
- Each fix PR auto-runs the gallery in CI for diff comparison

### 6.4 Visual regression baseline
- Commit `apps/electron/screenshots/baseline/` as golden files (English locale, both themes)
- Other locales: smoke captures only, not baseline (avoids 4× golden bloat)
- Add CI step: gallery on PR (only when `apps/electron/src/renderer/**` touched), per-image `maxDiffPixels=200` and `threshold=0.2`
- Failure mode: regression diff > threshold → CI fails → developer either fixes or accepts (with reason in PR body)

### 6.5 Acceptance
- 0 P0/P1 issues
- Baseline goldens committed (~20MB)
- Visual regression CI step active and gating PRs touching renderer/

---

## Phase 7 — Polish + release v1.1

### 7.1 CHANGELOG `[1.1.0] - YYYY-MM-DD` entry
- Drains `[Unreleased]` accumulated since v1.0.0
- Section structure per Keep a Changelog (Added / Changed / Fixed / Deprecated / Removed / Security / Notes)
- MCP gets its own subsection given the surface area

### 7.2 Site update — `marketmind-site/src/config/site.ts`
- `version: 'v1.1.0'`
- `tests: '8,500+'` (estimate — adjust to actual)
- New stat or feature blurb for MCP

### 7.3 Release tag `v1.1.0`
- Promotes develop → main
- Tag triggers desktop build workflow
- Verify Vercel deploy of site
- Verify desktop builds attached to release

---

## Notes & open questions

- **Pixel-diff threshold tuning** — start with `maxDiffPixels=200` per image; tune up if false positives
- **MCP local-only in v1.1** — no remote MCP host, no auth handoff to cloud agents. Just stdio + local Claude Code.
- **i18n for MCP responses** — MCP tools return data, not UI. No translation needed.
- **Storybook?** — would benefit primitives but is its own infra investment. Defer to v1.2+.
- **Performance instrumentation depth** — extend `perfMonitor` to record dialog/modal mount times. Already records component renders.
- **Trading MCP threat-model writeup** — prereq for v1.2 trading MCP work. Should land in v1.1 docs as a forward-looking note.

---

## Cross-reference

- Style guide: `docs/UI_STYLE_GUIDE.md`
- Existing standardization plan (superseded by this doc, kept for history): `docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`
- Browser testing: `docs/BROWSER_TESTING.md`
- Release process: `docs/RELEASE_PROCESS.md`
- `apps/electron/src/renderer/components/ui/README.md` — primitive catalog (kept in sync with each phase)
- `CLAUDE.md` — global engineering rules (CC-5 above derived from here)
