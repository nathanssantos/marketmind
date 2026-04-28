# v1.2 — Cross-surface standardization sweep

Post-v1.1 plan. The v1.0–v1.1 sweeps tightened individual phases (sidebars, modals, MCP, visual baseline). v1.2 is a **transversal** pass — comparing surfaces side-by-side to extract recurring patterns into primitives, then applying those primitives everywhere.

Goal: **fewer ad-hoc Box/Flex/Text triplets, more named primitives.** Every change ships with: tests, light/dark parity, baseline refresh, CHANGELOG line.

## Phase A — Extract recurring primitives

### A.1 `<EmptyState>` primitive
**Why** — every surface invents its own empty-state copy + layout: "No indicators yet, click 'New' to add one" / "No results found" / "No active watchers" / "No trades this month" / "No open positions". Different paddings (`p={4}` vs `p={6}` vs `p={8}`), different alignments, sometimes a CTA button below, sometimes inline help text.

**Spec**
- `<EmptyState title description action icon>` in `apps/electron/src/renderer/components/ui/empty-state.tsx`
- Compact-style: `py={6}`, `gap={2}`, `textAlign="center"`, `Stack` of `<Icon? />`, `<SectionTitle>`, `<MetaText description>`, `<Action?>`
- Optional dashed border (`borderStyle="dashed" borderColor="border"`) when called inside a card-less surface
- Add `EmptyState` to `ui/index.ts`, `ui/README.md`, `docs/UI_STYLE_GUIDE.md`
- Add token `MM.spacing.emptyState.py` to `theme/tokens.ts`
- Tests: render, with action, dashed border, all 4 locales
- ≥ 8 tests

**Apply to** (replace ad-hoc empty patterns)
- `IndicatorLibrary` — "No indicators yet"
- `WatchersList` — `<Box p={6} borderStyle="dashed">…<Button>Add Watcher</Button></Box>`
- `Trading/Portfolio` — "No open positions"
- `Trading/OrdersList` — "No orders" empty
- `MarketSidebar/tabs/MarketIndicatorCharts` — per-indicator no-data fallback (currently each renders its own muted Text)
- `MarketSidebar/tabs/MarketIndicatorSections` — same
- `Screener/ScreenerModal` — empty filter list
- `CustomSymbols/CustomSymbolsTab` — "No results found" when list empty
- `AnalyticsModal/PerformanceCalendar` — "No trades this month" (when `(data?.length ?? 0) === 0`)

### A.2 `<DataCard>` primitive
**Why** — Wallets, Trading Profiles, Active Watchers, Custom Symbols, Auto-Trading watcher cards all use `<Box borderWidth="1px" borderRadius="md" borderColor="border" p={N}>` with subtle differences. Header layout (title + badges + 3-dot menu) is hand-rolled each time.

**Spec**
- `<DataCard title badge action accentColor>` slot-based composition
  - `<DataCard.Header />` — title + optional badge cluster + right-side action menu
  - `<DataCard.Body />` — child content
  - `<DataCard.Footer />` — optional metadata row
- Optional `accentColor` → `borderLeftWidth="3px" borderLeftColor={accent}.muted` for "default profile" / "active watcher" markers
- Adds `DataCard` to ui index + style guide

**Apply to**
- `Settings/WalletsTab` cards
- `Settings/TradingProfilesTab` profile cards (replaces yellow-accent star hack)
- `Settings/AutoTradingTab` watcher cards (BTC/ETH/SOL grid)
- `MarketSidebar/tabs/WatchersTab` watcher rows (currently a table)
- `CustomSymbolsTab` index cards

### A.3 Section header audit — replace remaining manual headers
**Why** — Several places still hand-roll `<Flex justify="space-between"><Stack gap={0}><Text fontSize="md" fontWeight="bold" /><Text fontSize="xs" color="fg.muted" /></Stack></Flex>` instead of using `<FormSection>` (no border) or `<PanelHeader>` (border-bottom). This includes the CustomSymbolsTab header I just added — should migrate to FormSection.

**Audit targets** (search for the `<Text fontSize="md" fontWeight="bold">` pattern)
- `CustomSymbolsTab` — manual header → `<FormSection>`
- `IndicatorLibrary` — manual header → `<PanelHeader>` (it's a dashboard-style listing)
- `TradingProfilesManager` — manual `<Heading size="md">` → `<FormSection>` or `<PanelHeader>`
- Any other surface flagged by the audit grep

## Phase B — P2 cleanup from `docs/visual-review-2026-04.md`

| Item | Surface | Plan |
|---|---|---|
| B.1 | Custom Symbols "Create New" form | bare `<Input>+<Button>` rows → `<FormRow>` wrappers |
| B.2 | Screener empty state | Use new `<EmptyState>` from A.1 |
| B.3 | OrderFlow placeholder | Add label "Awaiting price stream…" instead of `0.00` |
| B.4 | Chart input units | Add placeholder/suffix hints (`px`, `%`) |
| B.5 | Trading Profiles default-marker | Yellow accent → `accentColor="yellow"` on new `<DataCard>` from A.2; document semantics |

## Phase C — Doc + meta

- C.1 Bump `CLAUDE.md` `Project Version` to `1.1.0` (currently shows `0.85.0`)
- C.2 Update `docs/UI_STYLE_GUIDE.md` with the new EmptyState + DataCard sections
- C.3 Update `apps/electron/src/renderer/components/ui/README.md` catalog
- C.4 CHANGELOG entry under `[Unreleased]`

## Phase D — Visual regression refresh

- D.1 Re-run gallery after A+B land
- D.2 Replace `apps/electron/screenshots/baseline/` with the new captures
- D.3 Document the refresh in PR body so reviewers know this is intentional, not a regression

## Phase E — Release v1.2.0

(Pending user authorization — release is a user action.)

- E.1 CHANGELOG `[1.2.0]` section
- E.2 Version bump (3 package.json + README + CHANGELOG + site)
- E.3 Tag `v1.2.0`

---

## Sequencing — one phase per PR

1. **PR α** (Phase A.1) — EmptyState primitive only (no application)
2. **PR β** (Phase A.1 application) — Apply EmptyState across all flagged surfaces
3. **PR γ** (Phase A.2) — DataCard primitive
4. **PR δ** (Phase A.2 application) — Apply DataCard across surfaces (replaces yellow-accent hack — visible visual change)
5. **PR ε** (Phase A.3) — Manual section header migration
6. **PR ζ** (Phase B) — P2 cleanup (small, batched)
7. **PR η** (Phase D) — Baseline refresh + Phase C docs (single bundled PR since they all describe the same UI)
8. **PR θ** (Phase E) — Release v1.2.0 (user-authorized)

Each PR keeps the **per-PR mandate** from `V1_POST_RELEASE_PLAN.md` Section CC-5: tests pass, type-check pass, lint pass, no `any`, i18n × 4 locales, theme parity. Each PR's diff stays under ~500 lines so review stays tractable.

---

**Estimated scope**: ~8 PRs, each 50–500 lines + tests. Total UI inventory after v1.2: 1 new primitive (`EmptyState`), 1 composite primitive (`DataCard`), 0 ad-hoc empty/card patterns surviving in the renderer.
