# v1.7 — Phase-2 sweep: sidebars, panels, toolbars, pages

> **One sentence:** apply the v1.6 design language (DialogShell + FormSection + the bible) to every non-dialog surface in the app — sidebars, panels, toolbars, pages, tables — so the entire app reads as one design language, not just the dialogs.
>
> **Authored:** 2026-05-02, immediately after v1.6.0 ships.

## Why

v1.6 made the 18 dialogs uniform. But every other surface in the app is still a melting pot of:

- 4 sidebars (`MarketSidebar`, `TradingSidebar`, `AutoTradingSidebar`, `OrderFlowSidebar`) — each hand-rolling its own header, despite a `<SidebarHeader>` primitive existing in `@marketmind/ui` (and going unused).
- Chart panels (`FuturesPositionsPanel`, `TradingChecklistPanel`, `OrderFlowMetrics`, `PerformancePanel`, `MarginInfoPanel`, `AgentActivityPanel`) — each with its own padding / header / loading / empty-state idiom.
- Toolbars (`ChartToolsToolbar`, `Toolbar`, `QuickTradeToolbar`, `DrawingToolbar`) — different button sizing rules, different separator styles, different overflow behavior.
- Pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `TwoFactorPage`, `VerifyEmailPage`, `ChartWindow`) — card-based forms, but each card hand-rolls header/body/footer and field spacing.

The dialog bible's rules apply everywhere: same Stack rhythm, same FormSection grouping, same loading/empty primitives, same CTA verb table, same input density. v1.7 enforces them.

## Track structure

Mirrors v1.6 but for non-dialog surfaces. Each track has explicit per-surface deliverables.

### Track P (Panels) — chart side panels uniform
Audit + rewrite the 6 chart-side panels using `<FormSection>` (same pattern as Settings tabs):
- `FuturesPositionsPanel` — list of open positions; loading/empty primitives
- `TradingChecklistPanel` — already mostly compliant per CLAUDE.md memory; verify
- `OrderFlowMetrics` — section grouping, no bespoke headers
- `PerformancePanel` — stats grid, loading state primitive
- `MarginInfoPanel` — currently mock; align with FormSection style
- `AgentActivityPanel` (in Settings) — already compliant from v1.5; verify under new bible

### Track S (Sidebars) — sidebars unified
- **Standardize `SidebarHeader`** in `@marketmind/ui` to match the actually-used style (xs/semibold title, px=3/py=2, borderBottom 1px) — current export uses lg/medium which nobody uses. Add a `closeButton` slot so the close X has a canonical home.
- **Add `SidebarTabsHeader`** primitive that bundles Tabs.List with an optional close button — the 3 tabbed sidebars (TradingSidebar / AutoTradingSidebar / OrderFlowSidebar) all reinvent this composition.
- **Migrate all 4 sidebars** to the new primitives. Drop the bespoke `<Flex>` + `<Text fontSize="xs">` + `<IconButton>` triplets.
- **Tab labels** standardized via a `<SidebarTabLabel>` (or just enforce `<Text fontSize="xs">` to disappear in favor of the trigger's default text rendering).

### Track T (Toolbars) — chart toolbars uniform
- **Audit toolbar button sizing**: bible's "size=xs for inputs; size=sm for switches" rule has no explicit toolbar guidance. Toolbars have icon-only buttons, dropdown menus, separators. Lock down: icon buttons at `size="2xs"`, dropdown buttons at `size="xs"`, separators via a dedicated `<ToolbarSeparator>` primitive.
- **`<ToolbarSeparator>` primitive** — every toolbar uses different separator dimensions (`<Separator orientation="vertical" h="20px" />`, etc.). Lock the height + color via token.
- **`<ChartToolbar>` shell primitive** — the 3 chart-related toolbars (`ChartToolsToolbar`, `DrawingToolbar`, `QuickTradeToolbar`) compose Box + Flex + bg + borderBottom hand-rolled. Extract the shell.

### Track G (Pages — auth) — page chrome uniform
The 6 auth pages share a card-based form layout. Currently each one rebuilds the same shape. Extract:
- **`<AuthPageShell>`** — centered card, app logo, title + description, body slot, footer slot. Shared across LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage, VerifyEmailPage.
- **Field layout consistency** — `<Stack gap={3}>` of `<Field>` per page. Currently each page does its own Stack gap.
- **Error + success states** — page-level error already uses `<Alert>` per CLAUDE.md (`<Alert>` is for page-level banners; `<Callout>` is for in-form). Verify all 6 follow that rule.

### Track R (Rows / Cards / Tables) — list-of-records uniform
- **`<RecordRow>`** primitive — every "list of objects" rendering hand-rolls a `<Flex borderWidth=1 borderRadius=md p=2 px=3>` + label / actions row. Wallets, profiles, custom symbols, snapshots, sessions, watchers — all the same shape.
- **Verify table primitives** are used everywhere (`<TradingTable>` exists; check if any list still uses `<table>` directly).
- **Empty/loading row primitives** for tables — `<TableEmptyState>` and `<TableLoadingState>` so tables don't reinvent.

### Track A (Audits) — gates for the new rules
- **`audit-panel-rules.mjs`** — same shape as `audit-dialog-rules.mjs` but for `*Panel.tsx` / `*Sidebar.tsx` / `*Toolbar.tsx`. Catches bespoke `<Text fontSize="xs" color="fg.muted">` for headers, hand-rolled separators, missing primitives.
- **CI gate** at `--strict` from PR #N.

## Sequencing

| # | Track | What | Effort |
|---|---|---|---|
| 1 | S | Standardize `SidebarHeader` + add `SidebarTabsHeader` primitive | 2h |
| 2 | S | Migrate MarketSidebar / TradingSidebar / AutoTradingSidebar / OrderFlowSidebar to new primitives | 3h |
| 3 | P | Audit + rewrite the 6 chart-side panels | 6-8h |
| 4 | T | `<ToolbarSeparator>` + `<ChartToolbar>` shell + 3 toolbar migrations | 4-5h |
| 5 | G | `<AuthPageShell>` + 6 page migrations | 4-6h |
| 6 | R | `<RecordRow>` + `<TableEmptyState>` / `<TableLoadingState>` primitives + sweep | 4-5h |
| 7 | A | `audit-panel-rules.mjs` + CI gate | 3-4h |

**Total estimated: 26-33h.**

## Acceptance

- All 4 sidebars use `<SidebarHeader>` or `<SidebarTabsHeader>` — no hand-rolled header `<Flex>`.
- All 6 chart panels use `<FormSection>` for groupings; loading/empty states via primitives.
- All 3 chart toolbars use `<ToolbarSeparator>` + the shell primitive.
- All 6 auth pages use `<AuthPageShell>`.
- `audit-panel-rules.mjs --strict` clean.
- Visual regression baseline updated.
- Reading any non-dialog surface in v1.7, the same patterns from v1.6's dialogs are visibly present.

## Out of scope (deferred to v1.8)

- Header redesign (the app-wide top header) — bigger conversation about navigation.
- Chart canvas rendering (canvas drawing primitives) — separate concern.
- Settings tabs internal restructure (already done as part of v1.6 G/S).
- Mobile / tablet adaptations.

---

**Status (2026-05-02 — planning):** plan landed. Implementation starts with Track S (sidebars).
