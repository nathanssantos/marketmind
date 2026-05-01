# v1.6 — Design system + Modal sweep + `@marketmind/ui` extraction

> **One sentence:** lock in a single design language for every modal in the app, extract the wrappers into `@marketmind/ui`, and use the work as the documented reference for the rest of the app's surfaces in v1.7+.
>
> **Authored:** 2026-05-01, on the heels of v1.5.0 ship.

## Why

After v1.5 the app has ~17 modal surfaces and they don't agree on anything load-bearing:

| Drift | Evidence |
|---|---|
| Width | `maxW="1100px"` (Settings, Analytics) vs `1200px` (Screener, Orders) vs no cap (ProfileEditor) vs `90vw` vs `95vw` |
| Title size | `fontSize="md"` (Analytics, Screener) vs default Chakra (StartWatchers, Orders, TradingProfiles) |
| Header padding | `px={4} pt={4}` vs `px={4} pt={4} pb={3}` vs `borderBottom="1px solid"` vs default vs none |
| Footer | some `borderTop`, some not, some inside `<FormDialog>`, some hand-rolled |
| Body padding | `p={4}` (FormDialog default) vs `py={4}` vs no padding when full-width content |
| Wrapper choice | 7 dialogs use `<FormDialog>`, the rest hand-roll `Dialog.Content`/`Dialog.Header`/etc. |
| i18n hygiene | dozens of `t('foo.bar', 'Fallback text')` calls — the fallback exists because the JSON entry doesn't, or the entry diverged from the fallback over time |
| Tab vs dedicated modal | `TradingProfilesTab.tsx` is a 6-line wrapper that just renders `<TradingProfilesManager />` — the same content as `TradingProfilesModal`. Wallets/CustomSymbols similarly mix "list of objects you create" inside `Settings`, instead of being their own dedicated surfaces. |
| Description slot | `<DialogHeader>` only has a title — there is nowhere standard to put a one-line subtitle/context (e.g. "Backtest a strategy on 3 years of klines.") |

This is the cycle to fix it. Not iteratively. **Each modal gets rewritten** against a fixed primitive set so the result is uniform by construction, not by hope.

The work also feeds two follow-on threads:
1. **`@marketmind/ui` extraction** — the primitives the modal sweep produces are the same ones planned in `docs/UI_EXTRACTION_PLAN.md` (#320). Doing modal sweep first locks the API; extraction becomes mechanical.
2. **Phase 2 (v1.7+) — apply the same pass to every other surface** (sidebars, panels, toolbars, pages, tables). The modal sweep is the proof-of-pattern; v1.7+ replays it on the rest of the app. **Every primitive added in v1.6 must be designed to also serve sidebars/panels/toolbars** — don't bake "modal-only" assumptions into them.

---

## UX rules (the contract every modal honors after v1.6)

These are the rules the rewrite enforces. They become part of `@marketmind/ui`'s package documentation so any future contributor reading the README sees them before writing a new modal.

1. **Creation lives in dedicated dialogs, never in tabs.** A "+ Create X" button in a list view opens a dedicated `<FormDialog>` for that one action. No "Create" tab inside `<Settings>`. No giant nested forms.
2. **Settings is for *preferences and account state*, not *records you create*.** Wallets, trading profiles, custom symbols, watchers, screener saved sets — those are *user records*. They get dedicated management modals (`<WalletsModal>`, `<TradingProfilesModal>`, etc.) opened from where they're used (header, sidebar, chart toolbar). Settings stays as: account, security, notifications, general, chart, indicators (defaults), auto-trading, data, about.
3. **One responsibility per modal.** A modal either: (a) takes one focused input (form), (b) shows data with optional filters/actions (viewer), (c) configures a single subject across multiple panels (workflow with tabs). It does not do all three.
4. **Width is a token, not a number.** `sm` (~400px) for confirmation/single-field, `md` (~560px) for standard form, `lg` (~840px) for data viewer or 2-column form, `xl` (~1100px / 90vw) for workflow modal, `full` for fullscreen. Set via `<ModalShell size={...}>`. No raw `maxW` on modals.
5. **Title typography is fixed.** One size, one weight. The header may also carry an optional one-line description below the title and an optional inline action (e.g. "Reset to defaults") on the right.
6. **Footer convention is fixed.** Always `borderTop`. Buttons right-aligned. Cancel is ghost / secondary, primary action is the rightmost `colorPalette={primary}`. Loading state on the primary disables both. Destructive primary uses `colorPalette="red"`.
7. **Empty / loading / error states are primitives, never bespoke text.** `<EmptyState>`, the standard panel spinner (`MM.spinner.panel`), and `<Callout tone="danger">` at the top of the body. No "Carregando..." inline text, no "Nada por aqui" hand-typed strings.
8. **Destructive confirms always go through `<ConfirmationDialog>`.** No inline are-you-sure. The dedicated dialog also enforces consistent destructive-action copy via i18n.
9. **Esc + click-outside close, except mid-mutation.** When `isLoading` is true, both are blocked so an in-flight `mutateAsync` never gets orphaned. Already supported in `<FormDialog>`; gets formalized in `<ModalShell>`.
10. **No nested modals more than 1 level deep.** Settings → CreateWallet is fine. ProfileEditor → SubEditor → Confirm is not — flatten.
11. **All user-visible strings come from i18n.** Zero `t('foo', 'Fallback')` calls left after the sweep. Every modal title, description, label, placeholder, helper, and CTA is in `en/pt/es/fr` JSON. The sweep includes this audit.
12. **Progressive disclosure for secondary fields.** Advanced options use `<CollapsibleSection variant="static">` (already a primitive) so the default form fits a viewport-1 height.
13. **Modal opens from explicit user action.** Never auto-open on app mount, route load, or background event. (The auto-update notification is a banner, not a modal — it stays.)

---

## Track A — Design system primitives + modal sweep

### A.1 — `<ModalShell>` primitive

The replacement for both the hand-rolled `Dialog.Root → Dialog.Backdrop → Dialog.Positioner → Dialog.Content` chains and the existing `<FormDialog>`. Lives in `apps/electron/src/renderer/components/ui/modal-shell.tsx` initially, becomes part of `@marketmind/ui` Tier-2 in Track B.

**API (proposed):**
```tsx
<ModalShell
  isOpen={open}
  onClose={close}
  size="md"                              // sm | md | lg | xl | full
  title="Create wallet"                  // required
  description="Add a paper, testnet, or live trading wallet."  // optional, one line
  headerAction={<Button size="2xs">Reset</Button>}             // optional, right-aligned
  footer={<ModalFooter ... />}           // optional override
  isLoading={creating}                   // disables esc/click-outside
  onSubmit={handleSubmit}                // when set, default footer renders Cancel + primary
  submitLabel="Create"
  submitColorPalette="blue"
  submitDisabled={!isValid}
  bodyPadding={4}                        // numeric token; default 4
  contentMaxH="90vh"                     // for data viewers; default unset
>
  <ModalSection>...</ModalSection>
</ModalShell>
```

Renders the standard structure:
- Backdrop + positioner
- Content with size-token-driven `maxW`/`w` (no manual overrides)
- Header with title at `MM.typography.modalTitle`, optional description below, optional inline action right
- CloseButton in the corner (always)
- Body with token-driven padding
- Footer with `borderTop` + right-aligned button group

`<FormDialog>` becomes a thin alias for `<ModalShell>` during the migration window so the 7 callsites that already use it don't have to change in the same PR.

### A.2 — `<ModalSection>` + `<ModalSectionGroup>` primitives

Inside the body, sections give visual rhythm. We already have `<FormSection>` and `<PanelHeader>` — they get audited and unified.

```tsx
<ModalSection
  title="API credentials"
  description="Read-only. Never stored on our servers."
  action={<Link>Where do I find these?</Link>}
>
  <Field label="API key">...</Field>
  <Field label="Secret">...</Field>
</ModalSection>
```

Section title size and weight is **smaller** than the modal title — clear hierarchy. Description is `MetaText`-styled. Sections stack with consistent gap. Group of sections inside a tabbed modal sit in a single `<ModalSectionGroup gap={4}>`.

### A.3 — Width / typography / spacing tokens

New entries in `@marketmind/tokens`:

```ts
MM.modal = {
  size: { sm: 400, md: 560, lg: 840, xl: 1100, full: '100vw' },
  vw:   { md: '90vw', lg: '90vw', xl: '90vw' },                // mobile fallback
  bodyPadding: 4,
  headerPadding: { x: 4, top: 4, bottom: 3 },
  footerPadding: { x: 4, y: 3 },
}
MM.typography.modalTitle      = { fontSize: 'md',  fontWeight: 'semibold', lineHeight: 'short' };
MM.typography.modalDescription = { fontSize: 'xs', color: 'fg.muted', lineHeight: 'tall' };
MM.typography.sectionTitle    = { fontSize: 'sm',  fontWeight: 'semibold' };  // already exists, audit
MM.typography.sectionDescription = { fontSize: 'xs', color: 'fg.muted' };     // already exists, audit
```

`<ModalShell>` reads from `MM.modal.*`. Direct consumers that need to size something modal-adjacent (popovers that look like mini-modals, drawers later) read from the same tokens.

### A.4 — UX rule lint (cheap automated guard)

A `scripts/audit-modal-rules.mjs` similar to the existing `scripts/audit-shade-literals.mjs`. Forbids in `apps/electron/src/renderer/`:

- Direct `<Dialog.Root>` / `<DialogRoot>` outside `ui/`
- Raw `maxW=` on a `Dialog.Content`/`DialogContent`
- `t('...', '<fallback>')` with a non-empty fallback (encourages keeping i18n JSON authoritative)
- `<Dialog.Title>` without a `fontSize` token (the rule auto-passes once everyone is on `<ModalShell>` since the title rendering is centralized)

CI gate behind `RUN_MODAL_AUDIT=1` initially, default-on at the end of the sweep.

### A.5 — Modal-by-modal rewrite

One PR per modal (or per closely-related pair). Each PR:
1. Rewrites the modal against `<ModalShell>` + `<ModalSection>`.
2. Reviews every visible string. Moves any `t('...', 'fallback')` text into `en/pt/es/fr` JSON. Drops strings that are no longer reachable.
3. Reviews title, description, CTAs for clarity in en (canonical). Translations follow the en wording.
4. Updates Playwright e2e selectors if test ids changed.
5. Visual baseline: capture before/after with `mcp-screenshot` if the modal is in the visual-regression gallery.

The 16 surfaces (rough order, simplest → highest blast radius):

| # | Modal | Current size | Target size | Notes |
|---|---|---|---|---|
| 1 | `ChartCloseDialog` | 124 | sm | confirmation; lowest risk warm-up |
| 2 | `KeyboardShortcutHelpModal` | 100 | md | data viewer (read-only list) |
| 3 | `SaveScreenerDialog` | 49 | sm | single-field form |
| 4 | `IndicatorConfigDialog` | 304 | md | per-indicator config form |
| 5 | `ImportProfileDialog` | 175 | md | file-upload + preview |
| 6 | `AddWatcherDialog` | 211 | md | symbol/timeframe form |
| 7 | `CreateWalletDialog` | 282 | md | exchange + credentials form |
| 8 | `ProfileEditorDialog` | 271 | lg | richer 2-column form |
| 9 | `OrdersDialog` | 295 | lg | data viewer with filters |
| 10 | `StartWatchersModal` | 270 | md | confirm + balance allocator |
| 11 | `TradingProfilesModal` | 45 + Manager | xl | workflow w/ tabs (or split) |
| 12 | `ScreenerModal` | 284 | xl | workflow w/ filters + results |
| 13 | `AnalyticsModal` | 106 | xl | workflow w/ panels |
| 14 | `BacktestModal` | 79 | xl | workflow w/ wizard |
| 15 | `SettingsDialog` | 208 | xl | workflow w/ tabs (sees A.6 reorg) |
| 16 | `DynamicSymbolRankings` (3 inner) | — | sm | confirmation/info |
| 17 | inline `<ConfirmationDialog>` callsites | — | sm | already a primitive; sweep just confirms callsite consistency |

### A.6 — Settings reorganization + `Tab → Modal` migrations

The "creation lives in dedicated dialogs" rule applied to Settings:

| Tab | Verdict | Action |
|---|---|---|
| `account` | Keep | Single-record settings |
| `security` | Keep | Settings + lists (sessions, agent activity) |
| `notifications` | Keep | Preferences |
| `general` | Keep | App-level prefs |
| `chart` | Keep | Chart prefs |
| `wallets` | **Move out** | Becomes `<WalletsModal>` opened from header/sidebar. Tab removed. Settings stays for prefs only. |
| `tradingProfiles` | **Remove tab** | `TradingProfilesTab.tsx` is a 6-line wrapper; the dedicated `<TradingProfilesModal>` already exists. Drop the tab, open the modal directly. |
| `autoTrading` | Keep | Per-wallet config; not a list of records |
| `indicators` | Keep | Default indicator preferences |
| `customSymbols` | **Move out** | Becomes `<CustomSymbolsModal>` opened from chart toolbar / market sidebar. Tab removed. |
| `data` | Keep | App data ops (import/export/cleanup) |
| `updates` | **Fold into `about`** | One "About & updates" tab |
| `about` | Keep (renamed to "About") | absorbs Updates |

After: **9 tabs** in 4 groups (was 13/4). Settings becomes a true "preferences" surface; "things you create" go into their own modals.

### A.7 — i18n text audit (one sweep across all modals)

Single dedicated PR after the rewrites land:
- Grep every `t('...', '...')` with a non-empty fallback. For each: ensure the JSON has a matching entry that says exactly what the fallback says (or improve both). Then drop the fallback from the call.
- Pass through every modal title in en (canonical) — concise, sentence-case, ≤ 6 words. Examples: "Create wallet" not "Create new wallet"; "Add watcher" not "Add new watcher".
- Pass through every modal description — one sentence, present tense, says *what the modal accomplishes*, not *how it works*. Examples: "Backtest a strategy on 3 years of klines" not "Configure the backtest engine with strategy and historical data". 
- Pass through every CTA — verb-first, single word where possible: "Create", "Save", "Import", "Restore".
- pt/es/fr translations follow the en canonical strings 1:1.

---

## Track B — `@marketmind/ui` extraction

This executes the F.2 audit doc (`docs/UI_EXTRACTION_PLAN.md` from #320). Lands **after** Track A so the new primitives (`<ModalShell>`, `<ModalSection>`) extract along with the rest in their final shape.

### B.1 — `packages/ui-core/` skeleton + Tier 1
- New workspace `@marketmind/ui-core`. `-core` suffix during migration so the in-app `ui/` barrel can keep its name.
- Move all Tier-1 files (~33 pure Chakra wrappers): `Alert`, `Badge`, `Button`, `Card`, `Checkbox`, `CloseButton`, `ColorMode*`, `DataCard`, `Dialog`, `Field`, `IconButton`, `Image`, `Input`, `Link`, `Logo`, `Menu`, `NumberInput`, `PasswordInput`, `Popover`, `Progress*`, `Radio*`, `Select`, `Separator`, `Skeleton`, `Slider`, `Stat*`, `Switch`, `Table`, `Tabs`, `Textarea`, `ToggleIconButton`, `TooltipWrapper`.
- Keep `apps/electron/src/renderer/components/ui/index.ts` as a re-export aggregator: `export { Button, ... } from '@marketmind/ui-core'`. **No app-site import changes** in this PR.
- Test infra: vitest config in the new package mirrors backend/electron. Existing `*.test.tsx` files move alongside their components.

### B.2 — Tier 2 (token-aware composed)
- Move `Callout`, `FormSection`/`FormRow`, `MetricCard`, `PnLDisplay`, `PanelHeader`, typography family, `ColorPicker`, `Sidebar` family, **plus the new v1.6 primitives** (`ModalShell`, `ModalSection`, `ModalSectionGroup`, `FormDialog` alias).
- Declare `@marketmind/tokens` as `peerDependency`.

### B.3 — Tier 3 graduation
Only `PasswordStrengthMeter`. Adds `t` prop, defaults to identity. App-side wrapper at `apps/electron/.../ui/PasswordStrengthMeter.tsx` (8-line re-export) injects the real `useTranslation` `t`.

The remaining Tier-3 components stay in app indefinitely:
- `ConfirmationDialog`, `FormDialog` alias (already in B.2 if we move it; if it stays here, it's `t`-injected)
- `EmptyState`, `ErrorMessage`, `LoadingSpinner` — i18n-coupled
- `CryptoIcon` — runtime asset path resolution
- `DirectionModeSelector` — trading-domain
- `GridWindow` — trading-domain layout
- `CollapsibleSection` — local state only; could graduate later

### B.4 — Rename `ui-core` → `ui`
After B.1–B.3 land and bake (~1 sprint), rename the workspace. App imports stay on `@renderer/components/ui` throughout.

### B.5 — `Storybook` setup
**Skipped** unless an external consumer materializes (landing site, docs site). Not gating the package.

---

## Track C — Package documentation

The user explicitly asked to use this work to document the new UI package. **Documentation lands incrementally with each PR** — not as a big push at the end.

### C.1 — `packages/ui-core/README.md` (lives in repo)
Component catalog:
- One section per Tier (1/2/3 graduated)
- Per component: import path, prop table summary, one-line description, **a runnable code snippet**.
- Rules section quoting the 13 UX rules above so a contributor sees them at the entry.

### C.2 — `docs/UI_DESIGN_SYSTEM.md` (replaces parts of `UI_STYLE_GUIDE.md`)
The "design language" reference:
- Spacing tokens (`MM.spacing.*`)
- Typography tokens (`MM.typography.*`, including the new modal tokens)
- Color tokens (semantic only — no shade literals)
- Width/size tokens for modals + drawers
- Section composition (when to use `<ModalSection>` vs `<FormSection>` vs `<PanelHeader>`)
- Anti-patterns gallery: things the audit script forbids, with the reason.

### C.3 — Migration notes in CHANGELOG
Each PR's CHANGELOG entry lists "what changed in `@marketmind/ui`" so a future external consumer can track API drift.

### C.4 — Inline JSDoc on every public export in the package
`/** ... */` blocks over `<ModalShell>` etc. so IDE hover shows the rules + accepted prop values without leaving the editor. This is the single highest-ROI piece of documentation: it travels with the code.

---

## Track D — Phase-2 readiness (mind set, not work for v1.6)

After the modal sweep, v1.7+ extends the same pass to:

- **Sidebars** — `MarketSidebar`, `IndicatorsSidebar`, `RankingsSidebar`. They already exist as `<SidebarContainer>`/`<SidebarHeader>` primitives but their contents drift just like modals do.
- **Panels** — `FuturesPositionsPanel`, `TradingChecklistPanel`, the chart's right-side panels. Padding, headers, empty states all need the same rules.
- **Toolbars** — `ChartToolbar`, `QuickTradeToolbar`. Button sizing, separator usage, overflow behavior.
- **Pages** — `LoginPage`, `RegisterPage`, `ResetPasswordPage`. Card-based forms, but currently bespoke.
- **Tables / data displays** — `OrdersDialog`'s body, watcher cards, kline metadata. Once `Table` is consistent across them.

**v1.6 design constraint**: every primitive added (`<ModalShell>`, `<ModalSection>`, the modal width tokens) must work outside modals. `<ModalShell>` is modal-shaped, but `<ModalSection>` should compose just as well inside a sidebar panel. The width tokens should match the side-drawer widths v1.7 will use. Names that say "modal-only" (e.g. don't name it `<ModalSectionTitle>`) should stay generic so v1.7 can reuse them without renaming.

---

## Sequencing

The plan ships as ~20 PRs. Each PR is small (typically 1 modal + tests + i18n delta), green CI required.

| # | Phase | Track | What | Effort |
|---|---|---|---|---|
| 1 | Foundation | A.1, A.2, A.3 | `<ModalShell>` + `<ModalSection>` primitives + tokens + `<FormDialog>` aliasing | ~4-6h |
| 2 | Foundation | A.4 | `audit-modal-rules.mjs` script + initial pass (passes immediately since nothing migrated yet — gate disabled) | ~2h |
| 3 | Foundation | C.1 + C.2 stub | `packages/ui-core/README.md` skeleton + `docs/UI_DESIGN_SYSTEM.md` skeleton with the 13 rules | ~2h |
| 4 | Sweep | A.5 #1-3 | `ChartCloseDialog`, `KeyboardShortcutHelpModal`, `SaveScreenerDialog` | ~2h |
| 5 | Sweep | A.5 #4-7 | `IndicatorConfigDialog`, `ImportProfileDialog`, `AddWatcherDialog`, `CreateWalletDialog` | ~4h |
| 6 | Sweep | A.5 #8-10 | `ProfileEditorDialog`, `OrdersDialog`, `StartWatchersModal` | ~3h |
| 7 | Sweep | A.6 | Settings reorg — drop `wallets`/`customSymbols`/`tradingProfiles` tabs, fold `updates` into `about`, ship `<WalletsModal>` + `<CustomSymbolsModal>` | ~6-8h |
| 8 | Sweep | A.5 #11-15 | `TradingProfilesModal`, `ScreenerModal`, `AnalyticsModal`, `BacktestModal`, `SettingsDialog` (post-reorg) | ~6h |
| 9 | Sweep | A.5 #16-17 | `DynamicSymbolRankings` inner dialogs + `<ConfirmationDialog>` callsite sweep | ~2h |
| 10 | Sweep | A.7 | i18n text audit — strip every `t('...', 'fallback')`, pass through every title/description/CTA in en, propagate to pt/es/fr | ~3-4h |
| 11 | Sweep | A.4 | Enable `audit-modal-rules.mjs` in CI default-on | ~1h |
| 12 | Extraction | B.1 | Tier-1 extraction into `packages/ui-core/` | ~3-4h |
| 13 | Extraction | B.2 | Tier-2 extraction (token-aware + new modal primitives) | ~2h |
| 14 | Extraction | B.3 | Tier-3 graduation: `PasswordStrengthMeter` | ~1-2h |
| 15 | Extraction | B.4 | Rename `ui-core` → `ui` | ~30min |
| 16 | Documentation | C.1 expansion | Fill out the component catalog with snippets per export | ~3-4h |
| 17 | Documentation | C.2 expansion | Fill out `UI_DESIGN_SYSTEM.md` anti-patterns gallery + composition rules | ~2-3h |
| 18 | Documentation | C.4 | JSDoc sweep on every public export | ~2h |

**Total estimated effort:** ~40-50h of focused work spread across 18 PRs.

Track A (foundation + sweep) ships before Track B (extraction) so the API stabilizes before the workspace move. Track C runs alongside both — each foundational/sweep PR ships its own piece of documentation.

---

## Acceptance

A v1.6 phase is "done" when:
- All 17 modal surfaces use `<ModalShell>` + `<ModalSection>`.
- `audit-modal-rules.mjs` reports 0 violations and runs in CI default-on.
- `apps/electron/src/renderer/components/ui/index.ts` re-exports from `@marketmind/ui-core` (or `@marketmind/ui` post-rename).
- `packages/ui-core/README.md` documents every export with a runnable snippet.
- `docs/UI_DESIGN_SYSTEM.md` is the canonical reference (the older `UI_STYLE_GUIDE.md` either folds in or is archived).
- Zero `t('...', 'fallback')` calls remain in `apps/electron/src/renderer/`.
- en/pt/es/fr JSONs are 1:1 in keys for every modal-related namespace.
- Visual regression baseline updated with the new modal styling; no unintended regressions in non-modal surfaces.
- Lint + type-check + all tests green.
- `pnpm test` test count holds or grows (the rewrites carry their existing tests; new primitives add their own).

When v1.6 lands, the codebase is ready for v1.7's *"apply the same pass to the rest of the app"* phase with the design system documented and the package boundary in place.
