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
| File naming | 8 files end in `*Dialog.tsx`, 5 in `*Modal.tsx` — arbitrary split. `KeyboardShortcutHelpModal.tsx` lives at the components root while every other modal sits inside a feature folder. |
| Repeated Props shape | Every modal hand-writes `interface XxxDialogProps { isOpen: boolean; onClose: () => void; ... }`. No shared base. |
| Repeated mutation/toast plumbing | `try { await mutate(); toast.success; } catch (err) { toast.error(title, err instanceof Error ? err.message : undefined); }` — confirmed 19 occurrences of `err instanceof Error ? err.message` across the renderer. |
| Form state boilerplate | Each form has its own `useState` per field, manual reset on close, manual `isValid` derivation. |
| i18n key conventions | Mixed: `trading.wallets.createTitle` vs `marketSidebar.watchers.startWatchers` vs `screener.title` vs `settings.security.agentTrading.title`. No predictable shape. |
| Domain constants | Some live in `@marketmind/types` (`CURRENCY_SYMBOLS`, `DEFAULT_CURRENCY`), some inline in components (`SELECTABLE_CURRENCIES.map(...)` defined at the top of `CreateWalletDialog`), some hardcoded in handlers. |
| Validation | Backend has zod schemas (`createWalletSchema`, `passwordPolicySchema`, etc.); renderer re-derives validation rules ad-hoc instead of reusing them. |

This is the cycle to fix it. Not iteratively. **Each modal gets rewritten** against a fixed primitive set so the result is uniform by construction, not by hope. The rewrite is also the moment we standardize **file names, shared types, common hooks, and i18n key shapes** — touching these once during the rewrite is cheap; touching them later means re-touching every file.

The work also feeds two follow-on threads:
1. **`@marketmind/ui` extraction** — the primitives the modal sweep produces are the same ones planned in `docs/UI_EXTRACTION_PLAN.md` (#320). Doing modal sweep first locks the API; extraction becomes mechanical.
2. **Phase 2 (v1.7+) — apply the same pass to every other surface** (sidebars, panels, toolbars, pages, tables). The modal sweep is the proof-of-pattern; v1.7+ replays it on the rest of the app. **Every primitive added in v1.6 must be designed to also serve sidebars/panels/toolbars** — don't bake "modal-only" assumptions into them.

---

## UX rules (the contract every modal honors after v1.6)

These are the rules the rewrite enforces. They become part of `@marketmind/ui`'s package documentation so any future contributor reading the README sees them before writing a new modal.

1. **Creation lives in dedicated dialogs, never in tabs.** A "+ Create X" button in a list view opens a dedicated `<FormDialog>` for that one action. No "Create" tab inside `<Settings>`. No giant nested forms.
2. **Settings is for *preferences and account state*, not *records you create*.** Wallets, trading profiles, custom symbols, watchers, screener saved sets — those are *user records*. They get dedicated management modals (`<WalletsDialog>`, `<TradingProfilesDialog>`, etc.) opened from where they're used (header, sidebar, chart toolbar). Settings stays as: account, security, notifications, general, chart, indicators (defaults), auto-trading, data, about.
3. **One responsibility per modal.** A modal either: (a) takes one focused input (form), (b) shows data with optional filters/actions (viewer), (c) configures a single subject across multiple panels (workflow with tabs). It does not do all three.
4. **Width is a token, not a number.** `sm` (~400px) for confirmation/single-field, `md` (~560px) for standard form, `lg` (~840px) for data viewer or 2-column form, `xl` (~1100px / 90vw) for workflow modal, `full` for fullscreen. Set via `<DialogShell size={...}>`. No raw `maxW` on modals.
5. **Title typography is fixed.** One size, one weight. The header may also carry an optional one-line description below the title and an optional inline action (e.g. "Reset to defaults") on the right.
6. **Footer convention is fixed.** Always `borderTop`. Buttons right-aligned. Cancel is ghost / secondary, primary action is the rightmost `colorPalette={primary}`. Loading state on the primary disables both. Destructive primary uses `colorPalette="red"`.
7. **Empty / loading / error states are primitives, never bespoke text.** `<EmptyState>`, the standard panel spinner (`MM.spinner.panel`), and `<Callout tone="danger">` at the top of the body. No "Carregando..." inline text, no "Nada por aqui" hand-typed strings.
8. **Destructive confirms always go through `<ConfirmationDialog>`.** No inline are-you-sure. The dedicated dialog also enforces consistent destructive-action copy via i18n.
9. **Esc + click-outside close, except mid-mutation.** When `isLoading` is true, both are blocked so an in-flight `mutateAsync` never gets orphaned. Already supported in `<FormDialog>`; gets formalized in `<DialogShell>`.
10. **No nested modals more than 1 level deep.** Settings → CreateWallet is fine. ProfileEditor → SubEditor → Confirm is not — flatten.
11. **All user-visible strings come from i18n.** Zero `t('foo', 'Fallback')` calls left after the sweep. Every modal title, description, label, placeholder, helper, and CTA is in `en/pt/es/fr` JSON. The sweep includes this audit.
12. **Progressive disclosure for secondary fields.** Advanced options use `<CollapsibleSection variant="static">` (already a primitive) so the default form fits a viewport-1 height.
13. **Modal opens from explicit user action.** Never auto-open on app mount, route load, or background event. (The auto-update notification is a banner, not a modal — it stays.)

---

## Track E — Shared infrastructure (lands BEFORE Track A's sweep)

Track A's per-modal rewrite PRs stay small only if the shared scaffolding is already in place. This track ships that scaffolding first.

### E.1 — File naming convention
**Rule:** every dialog file is `<Feature>Dialog.tsx`, lives inside its feature folder. Matches the Chakra primitive name (`Dialog`), the ARIA role, and the existing `<FormDialog>` / `<ConfirmationDialog>` wrappers — single vocabulary across the whole stack. Prose uses "modal" and "dialog" interchangeably; **code, file names, primitives, and i18n keys always say "Dialog"**.

Renames in one PR (no behavior changes):
- `AnalyticsModal.tsx` → `AnalyticsDialog.tsx`
- `BacktestModal.tsx` → `BacktestDialog.tsx`
- `ScreenerModal.tsx` → `ScreenerDialog.tsx`
- `StartWatchersModal.tsx` → `StartWatchersDialog.tsx`
- `TradingProfilesModal.tsx` → `TradingProfilesDialog.tsx`
- `KeyboardShortcutHelpModal.tsx` → `KeyboardShortcutHelpDialog.tsx` (also moves from the components root into `Help/` so it follows the feature-folder rule)

Files already named `*Dialog.tsx` stay as-is (`ChartCloseDialog`, `IndicatorConfigDialog`, `SaveScreenerDialog`, `AddWatcherDialog`, `CreateWalletDialog`, `ImportProfileDialog`, `OrdersDialog`, `ProfileEditorDialog`, `SettingsDialog`). The audit script (E.9) forbids reintroducing `*Modal.tsx`.

### E.2 — Shared `<DialogShell>` props base
```ts
// packages/types/src/ui.ts (or in @marketmind/ui when extracted)
export interface DialogControlProps {
  isOpen: boolean;
  onClose: () => void;
}

// Per-modal:
interface CreateWalletDialogProps extends DialogControlProps {
  defaultExchange?: ExchangeId;
}
```

Drops 17 hand-rolled `interface XxxDialogProps { isOpen; onClose; }` definitions.

### E.3 — `useFormState<T>` hook
```ts
const { values, set, reset, isDirty } = useFormState<CreateWalletInput>({
  initial: { name: '', exchange: 'BINANCE', walletType: 'paper', /* ... */ },
  resetOn: isOpen,        // auto-reset when the modal closes/reopens
});
// values.name, set('name', value), reset(), isDirty
```

Single hook replaces the 4–10 `useState` calls + the `resetForm()` boilerplate that every form modal duplicates today. Ships in `@renderer/hooks/`.

### E.4 — `useMutationWithToast` hook
```ts
const create = useMutationWithToast(trpc.wallet.createPaper.useMutation, {
  successKey: 'trading.wallets.created',
  failureKey: 'trading.wallets.createFailed',
  onSuccess: () => { reset(); onClose(); },
});

// Inside submit:
await create.mutateAsync({ name, exchange, walletType, ... });
```

Encapsulates the 19 `try/catch + err instanceof Error ? err.message` instances. Surfaces a consistent `failureKey` toast title with the underlying error message as body. Ships in `@renderer/hooks/`.

### E.5 — i18n key shape convention
**Rule:** every dialog-scoped key follows `<feature>.dialogs.<dialogName>.<key>`. `<key>` is one of a fixed enum:
- `title` — dialog title
- `description` — optional one-line description
- `submit` — primary CTA verb
- `cancel` — secondary CTA verb (rarely overridden; defaults to `common.cancel`)
- `field.<fieldName>.label` / `field.<fieldName>.helper` / `field.<fieldName>.placeholder`
- `section.<sectionName>.title` / `section.<sectionName>.description`
- `success` / `failure` — toast keys (success body / failure title)
- `confirm.title` / `confirm.body` / `confirm.cta` — destructive confirms

Migration sweep PR rewrites every dialog-related key to fit. `en/pt/es/fr` JSONs end up structurally identical (same keys, different values).

### E.6 — Domain constants centralization audit
- Catalog every `const SELECTABLE_X`, `const MIN_Y`, `const MAX_Z`, `DEFAULT_*` defined inside a component file.
- Move trading-domain constants (currencies, exchanges, intervals, market types) into `@marketmind/types`.
- Move UI/UX constants (modal sizes, paddings, common z-indexes) into `@marketmind/tokens`.
- Renderer-only / app-only constants (e.g. polling intervals for a specific component) stay co-located in a feature `constants.ts`.

### E.7 — Validation schema reuse
Backend tRPC procedures already declare zod schemas (`createWalletSchema`, `passwordPolicySchema`, etc.). For the modal sweep:
- Re-export shareable schemas from `@marketmind/types` so the renderer imports the same source of truth.
- Each modal's `isValid` becomes `schema.safeParse(values).success` — eliminates ad-hoc rules like `name.trim() && parseFloat(initialBalance) > 0`.
- Per-field error messages flow from the same zod issues, displayed under each `<Field>`.

### E.8 — Folder layout convention
Each dialog that's bigger than ~200 LOC graduates from a single file to a folder:
```
Trading/
  CreateWalletDialog/
    index.ts                  // re-exports CreateWalletDialog
    CreateWalletDialog.tsx    // the shell + composition
    CreateWalletDialog.test.tsx
    sections/                 // one file per <DialogSection>
      ExchangeSection.tsx
      CredentialsSection.tsx
      WalletTypeSection.tsx
    constants.ts              // local-only constants
    types.ts                  // local-only types (public Props live in the file root)
```

Smaller dialogs (< 200 LOC) stay flat. The decision goes by complexity, not arbitrary cutoff — but the *target* is that no single `*.tsx` file in the dialog layer exceeds ~200-250 LOC after the sweep.

### E.9 — Audit script for the new conventions
`scripts/audit-dialog-rules.mjs` — single script enforcing every Track E + Track A rule that's mechanically checkable. Forbids in `apps/electron/src/renderer/`:
- New files matching `*Modal.tsx` (only `*Dialog.tsx` is allowed; existing `*Modal.tsx` files are tracked in a known-rename list during the sweep, removed once renames land)
- Hand-rolled `<Dialog.Root>` outside `ui/` (must use `<DialogShell>` or `<FormDialog>`)
- Raw `maxW=` on a `Dialog.Content`/`DialogContent`
- `t('...', '<non-empty-fallback>')` calls
- `interface .*DialogProps` that doesn't extend `DialogControlProps`
- i18n keys not following `<feature>.dialogs.<dialog>.<key>` (best-effort — flags suspicious shapes)

CI gate behind `RUN_DIALOG_AUDIT=1` initially, default-on once the sweep finishes.

---

## Track A — Design system primitives + modal sweep

### A.1 — `<DialogShell>` primitive

The replacement for both the hand-rolled `Dialog.Root → Dialog.Backdrop → Dialog.Positioner → Dialog.Content` chains and the existing `<FormDialog>`. Lives in `apps/electron/src/renderer/components/ui/dialog-shell.tsx` initially, becomes part of `@marketmind/ui` Tier-2 in Track B.

**API (proposed):**
```tsx
<DialogShell
  isOpen={open}
  onClose={close}
  size="md"                              // sm | md | lg | xl | full
  title="Create wallet"                  // required
  description="Add a paper, testnet, or live trading wallet."  // optional, one line
  headerAction={<Button size="2xs">Reset</Button>}             // optional, right-aligned
  footer={<DialogFooter ... />}          // optional override
  isLoading={creating}                   // disables esc/click-outside
  onSubmit={handleSubmit}                // when set, default footer renders Cancel + primary
  submitLabel="Create"
  submitColorPalette="blue"
  submitDisabled={!isValid}
  bodyPadding={4}                        // numeric token; default 4
  contentMaxH="90vh"                     // for data viewers; default unset
>
  <DialogSection>...</DialogSection>
</DialogShell>
```

Renders the standard structure:
- Backdrop + positioner
- Content with size-token-driven `maxW`/`w` (no manual overrides)
- Header with title at `MM.typography.dialogTitle`, optional description below, optional inline action right
- CloseButton in the corner (always)
- Body with token-driven padding
- Footer with `borderTop` + right-aligned button group

`<FormDialog>` becomes a thin alias for `<DialogShell>` during the migration window so the 7 callsites that already use it don't have to change in the same PR.

### A.2 — `<DialogSection>` + `<DialogSectionGroup>` primitives

Inside the body, sections give visual rhythm. We already have `<FormSection>` and `<PanelHeader>` — they get audited and unified.

```tsx
<DialogSection
  title="API credentials"
  description="Read-only. Never stored on our servers."
  action={<Link>Where do I find these?</Link>}
>
  <Field label="API key">...</Field>
  <Field label="Secret">...</Field>
</DialogSection>
```

Section title size and weight is **smaller** than the modal title — clear hierarchy. Description is `MetaText`-styled. Sections stack with consistent gap. Group of sections inside a tabbed modal sit in a single `<DialogSectionGroup gap={4}>`.

### A.3 — Width / typography / spacing tokens

New entries in `@marketmind/tokens`:

```ts
MM.dialog = {
  size: { sm: 400, md: 560, lg: 840, xl: 1100, full: '100vw' },
  vw:   { md: '90vw', lg: '90vw', xl: '90vw' },                // mobile fallback
  bodyPadding: 4,
  headerPadding: { x: 4, top: 4, bottom: 3 },
  footerPadding: { x: 4, y: 3 },
}
MM.typography.dialogTitle      = { fontSize: 'md',  fontWeight: 'semibold', lineHeight: 'short' };
MM.typography.dialogDescription = { fontSize: 'xs', color: 'fg.muted', lineHeight: 'tall' };
MM.typography.sectionTitle    = { fontSize: 'sm',  fontWeight: 'semibold' };  // already exists, audit
MM.typography.sectionDescription = { fontSize: 'xs', color: 'fg.muted' };     // already exists, audit
```

`<DialogShell>` reads from `MM.dialog.*`. Direct consumers that need to size something modal-adjacent (popovers that look like mini-modals, drawers later) read from the same tokens.

### A.4 — Dialog-by-dialog rewrite

One PR per modal (or per closely-related pair). Each PR:
1. Rewrites the modal against `<DialogShell>` + `<DialogSection>`.
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
| 15 | `SettingsDialog` | 208 | xl | workflow w/ tabs (sees A.5 reorg) |
| 16 | `DynamicSymbolRankings` (3 inner) | — | sm | confirmation/info |
| 17 | inline `<ConfirmationDialog>` callsites | — | sm | already a primitive; sweep just confirms callsite consistency |

### A.5 — Settings reorganization + `Tab → Modal` migrations

The "creation lives in dedicated dialogs" rule applied to Settings:

| Tab | Verdict | Action |
|---|---|---|
| `account` | Keep | Single-record settings |
| `security` | Keep | Settings + lists (sessions, agent activity) |
| `notifications` | Keep | Preferences |
| `general` | Keep | App-level prefs |
| `chart` | Keep | Chart prefs |
| `wallets` | **Move out** | Becomes `<WalletsDialog>` opened from header/sidebar. Tab removed. Settings stays for prefs only. |
| `tradingProfiles` | **Remove tab** | `TradingProfilesTab.tsx` is a 6-line wrapper; the dedicated `<TradingProfilesDialog>` already exists. Drop the tab, open the modal directly. |
| `autoTrading` | Keep | Per-wallet config; not a list of records |
| `indicators` | Keep | Default indicator preferences |
| `customSymbols` | **Move out** | Becomes `<CustomSymbolsDialog>` opened from chart toolbar / market sidebar. Tab removed. |
| `data` | Keep | App data ops (import/export/cleanup) |
| `updates` | **Fold into `about`** | One "About & updates" tab |
| `about` | Keep (renamed to "About") | absorbs Updates |

After: **9 tabs** in 4 groups (was 13/4). Settings becomes a true "preferences" surface; "things you create" go into their own modals.

### A.6 — i18n text audit (one sweep across all modals)

Single dedicated PR after the rewrites land:
- Grep every `t('...', '...')` with a non-empty fallback. For each: ensure the JSON has a matching entry that says exactly what the fallback says (or improve both). Then drop the fallback from the call.
- Pass through every modal title in en (canonical) — concise, sentence-case, ≤ 6 words. Examples: "Create wallet" not "Create new wallet"; "Add watcher" not "Add new watcher".
- Pass through every modal description — one sentence, present tense, says *what the modal accomplishes*, not *how it works*. Examples: "Backtest a strategy on 3 years of klines" not "Configure the backtest engine with strategy and historical data". 
- Pass through every CTA — verb-first, single word where possible: "Create", "Save", "Import", "Restore".
- pt/es/fr translations follow the en canonical strings 1:1.

---

## Track B — `@marketmind/ui` extraction

This executes the F.2 audit doc (`docs/UI_EXTRACTION_PLAN.md` from #320). Lands **after** Track A so the new primitives (`<DialogShell>`, `<DialogSection>`) extract along with the rest in their final shape.

### B.1 — `packages/ui-core/` skeleton + Tier 1
- New workspace `@marketmind/ui`. `-core` suffix during migration so the in-app `ui/` barrel can keep its name.
- Move all Tier-1 files (~33 pure Chakra wrappers): `Alert`, `Badge`, `Button`, `Card`, `Checkbox`, `CloseButton`, `ColorMode*`, `DataCard`, `Dialog`, `Field`, `IconButton`, `Image`, `Input`, `Link`, `Logo`, `Menu`, `NumberInput`, `PasswordInput`, `Popover`, `Progress*`, `Radio*`, `Select`, `Separator`, `Skeleton`, `Slider`, `Stat*`, `Switch`, `Table`, `Tabs`, `Textarea`, `ToggleIconButton`, `TooltipWrapper`.
- Keep `apps/electron/src/renderer/components/ui/index.ts` as a re-export aggregator: `export { Button, ... } from '@marketmind/ui'`. **No app-site import changes** in this PR.
- Test infra: vitest config in the new package mirrors backend/electron. Existing `*.test.tsx` files move alongside their components.

### B.2 — Tier 2 (token-aware composed)
- Move `Callout`, `FormSection`/`FormRow`, `MetricCard`, `PnLDisplay`, `PanelHeader`, typography family, `ColorPicker`, `Sidebar` family, **plus the new v1.6 primitives** (`DialogShell`, `DialogSection`, `DialogSectionGroup`, `FormDialog` alias).
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
- Section composition (when to use `<DialogSection>` vs `<FormSection>` vs `<PanelHeader>`)
- Anti-patterns gallery: things the audit script forbids, with the reason.

### C.3 — Migration notes in CHANGELOG
Each PR's CHANGELOG entry lists "what changed in `@marketmind/ui`" so a future external consumer can track API drift.

### C.4 — Inline JSDoc on every public export in the package
`/** ... */` blocks over `<DialogShell>` etc. so IDE hover shows the rules + accepted prop values without leaving the editor. This is the single highest-ROI piece of documentation: it travels with the code.

---

## Track D — Phase-2 readiness (mind set, not work for v1.6)

After the modal sweep, v1.7+ extends the same pass to:

- **Sidebars** — `MarketSidebar`, `IndicatorsSidebar`, `RankingsSidebar`. They already exist as `<SidebarContainer>`/`<SidebarHeader>` primitives but their contents drift just like modals do.
- **Panels** — `FuturesPositionsPanel`, `TradingChecklistPanel`, the chart's right-side panels. Padding, headers, empty states all need the same rules.
- **Toolbars** — `ChartToolbar`, `QuickTradeToolbar`. Button sizing, separator usage, overflow behavior.
- **Pages** — `LoginPage`, `RegisterPage`, `ResetPasswordPage`. Card-based forms, but currently bespoke.
- **Tables / data displays** — `OrdersDialog`'s body, watcher cards, kline metadata. Once `Table` is consistent across them.

**v1.6 design constraint**: every primitive added (`<DialogShell>`, `<DialogSection>`, the dialog width tokens) must work outside dialogs. `<DialogShell>` is dialog-shaped, but `<DialogSection>` should compose just as well inside a sidebar panel. The width tokens should match the side-drawer widths v1.7 will use. Names should stay generic (`<DialogSection>` not `<DialogSectionTitle>` — same component reused outside dialogs without renaming). The hooks from Track E (`useFormState`, `useMutationWithToast`) likewise apply to any form, anywhere.

---

## Status (2026-05-02 — v1.6 substantially complete)

**Track E (shared infrastructure) — complete.** PRs #329-#336.

**Track A (sweep) — complete.**
- ✅ A.1+A.2+A.3 `<DialogShell>` + `<DialogSection>` + `MM.dialog.*` tokens (#337)
- ✅ A.4 dialog rewrites — all 17 surfaces migrated to `<DialogShell>` (#338-#343)
- ✅ A.4 creation-dialog trigger pattern — `useDisclosure` + `<CreateActionButton>` + `docs/UI_CREATION_FLOWS.md` (#345-#346)
- ✅ A.5 Settings reorg — 13 tabs → 9 (#357-#360)
  - Stage 1: fold Updates → About (#357)
  - Stage 2: drop Trading Profiles tab; trigger in WatchersTab header (#358)
  - Stage 3: drop Wallets tab; new `<WalletsDialog>` opens from WalletSelector (#359)
  - Stage 4: drop Custom Symbols tab; new `<CustomSymbolsDialog>` opens from SymbolSelector (#360)
- ✅ A.6 i18n text audit — all 192 `t('foo', 'fallback')` calls cleaned (#347-#351)

**Track B (`@marketmind/ui` extraction) — substantially complete.**
- ✅ B.1 Tier-1 extraction — 32 pure Chakra wrappers moved (#353)
- ✅ B.2 Tier-2 extraction — 10+ token-aware composed primitives + Sidebar (#354)
- B.3 Tier-3 graduation (`PasswordStrengthMeter`) — deferred; needs i18n `t` prop decoupling
- B.4 rename `ui-core` → `ui` — deferred; let the API bake first

**Track C (documentation) — complete.**
- ✅ `docs/I18N_DIALOG_KEYS.md` (E.5)
- ✅ `docs/UI_CREATION_FLOWS.md` (creation-dialog trigger pattern, A.4)
- ✅ `packages/ui-core/README.md` — component catalog (C.1, #355)
- ✅ `docs/UI_DESIGN_SYSTEM.md` — design language reference (C.2, #355)

**Audit baseline:** all 5 dialog rules clean, shade-literal audit clean, dialog-i18n-keys audit clean. CI can flip `audit-dialog-rules.mjs` to `--strict` in a follow-up workflow.

| Audit | Status |
|---|---|
| `audit-dialog-rules.mjs --strict` | ✓ clean |
| `audit-shade-literals.mjs` | ✓ 218 files / 0 forbidden patterns |
| `audit-dialog-i18n-keys.mjs` | ✓ clean (4 dialogs / 4 locales) |
| `pnpm --filter @marketmind/electron type-check` | ✓ |
| `pnpm --filter @marketmind/electron lint` | ✓ 0 errors (1969 warnings, baseline) |
| `pnpm --filter @marketmind/electron test:unit` | ✓ 2327 / 2327 |

**Deferred items (real work that didn't fit this cycle):**
- **B.3 Tier-3 graduation** — `PasswordStrengthMeter` decouples by accepting a `t` prop; small follow-up.
- **B.4 rename** — `ui-core` → `ui` once consumers external to the renderer materialize.

**Track F — Order/position chart reactivity (2026-05-02 → 2026-05-02, substantially complete)**

User reported (2026-05-02) that closing a position via Stop Loss took ~1 minute for the chart to reflect the close, even though Binance had already filled. Then a follow-up: cancelling a pending limit order had a flicker (line vanishes, comes back, vanishes again). Detailed plan at `docs/V1_6_ORDER_REACTIVITY_PLAN.md`.

Shipped:
- ✅ F.3 backup polling 30s → 5s (#364)
- ✅ F.3 chart subscribes to `position:closed` for snapshot+flash (#364)
- ✅ F.2 position-sync 5min → 30s (#365)
- ✅ F.4 SL/TP toast (#366)
- ✅ F.2 toast in algo/orphan/untracked close paths via shared helper (#368)
- ✅ F.3 cancel-flicker fix — 30s smart override TTL (#369)
- ✅ F.4 POSITION_OPENED toast on limit + manual fills (#373)
- ✅ F.4 LIQUIDATION detection + critical-urgency toast (#374)
- ✅ F.2 `stream:reconnected` event + renderer subscription (#375)
- ✅ F.3 chart live-patch on `position:update` + `order:update` (#376)
- ✅ F.4 POSITION_PYRAMIDED + POSITION_PARTIAL_CLOSE toasts (#377)

Acceptance results:
- SL fills → chart updates in <1.5s p95 ✓ (websocket + 5s backup poll + 30s position-sync watchdog).
- User-perceived latency <200ms via flash+toast ✓ (chart subscribes to `position:closed` directly).
- Pending limit cancel reliably hides on first click without flicker ✓.
- Server-pushed updates (trailing-stop, modify) visible immediately via live-patch ✓.
- Stream reconnect after gap → force-refresh + visible toast for >30s gaps ✓.

Deferred items (polish, not blocking):
- F.1 instrumentation overlay — was for diagnosing the original bug; kept on the backlog as observability work, not user-visible.
- F.3 fast-recheck after user-submit (1s+3s belt-and-suspenders) — covered well enough by the existing onSuccess invalidate + 5s backup polling.
- F.4 per-event flash color variants (different colors for open/pyramid/partial/close) — chart polish.
- F.4 order-line move animation + cancel fade — chart polish.
- F.2 auto-cancel toast for system-cancelled orders (wallet-disabled, expired) — low-frequency event.

**Track F no longer blocks v1.6.0 release.**

---

## Sequencing

The plan ships as ~22 PRs. Each PR is small (typically 1 dialog + tests + i18n delta), green CI required.

| # | Phase | Track | What | Effort |
|---|---|---|---|---|
| 1 | Shared infra | E.1 | File rename sweep — every `*Modal.tsx` → `*Dialog.tsx`. No behavior changes. | ~1-2h |
| 2 | Shared infra | E.2 | `DialogControlProps` base type in `@marketmind/types`; sweep the 17 hand-rolled `interface XxxDialogProps` to extend it. | ~1h |
| 3 | Shared infra | E.3 | `useFormState<T>` hook + first migration (CreateWalletDialog as a guinea pig). | ~2-3h |
| 4 | Shared infra | E.4 | `useMutationWithToast` hook + first migration (CreateWalletDialog again). | ~2h |
| 5 | Shared infra | E.5 | i18n key shape convention + tooling — JSON-schema-validate `<feature>.dialogs.<dialog>.<key>` shape in CI. | ~2h |
| 6 | Shared infra | E.6 | Domain constants centralization — sweep `SELECTABLE_*` / `MIN_*` / `MAX_*` / `DEFAULT_*` into `@marketmind/types` (domain) or `@marketmind/tokens` (UX). | ~2h |
| 7 | Shared infra | E.7 | Validation schema reuse — re-export shareable backend zod schemas via `@marketmind/types`; first migration (CreateWalletDialog → schema-driven `isValid`). | ~2-3h |
| 8 | Shared infra | E.9 | `audit-dialog-rules.mjs` script (initial pass; gate disabled) | ~2h |
| 9 | Foundation | A.1, A.2, A.3 | `<DialogShell>` + `<DialogSection>` primitives + `MM.dialog.*` tokens + `<FormDialog>` aliasing | ~4-6h |
| 10 | Foundation | C.1 + C.2 stub | `packages/ui-core/README.md` skeleton + `docs/UI_DESIGN_SYSTEM.md` skeleton with the 13 rules | ~2h |
| 11 | Sweep | A.4 #1-3 | `ChartCloseDialog`, `KeyboardShortcutHelpDialog` (renamed), `SaveScreenerDialog` | ~2h |
| 12 | Sweep | A.4 #4-7 | `IndicatorConfigDialog`, `ImportProfileDialog`, `AddWatcherDialog`, `CreateWalletDialog` | ~4h |
| 13 | Sweep | A.4 #8-10 | `ProfileEditorDialog`, `OrdersDialog`, `StartWatchersDialog` (renamed) | ~3h |
| 14 | Sweep | A.5 | Settings reorg — drop `wallets`/`customSymbols`/`tradingProfiles` tabs, fold `updates` into `about`, ship `<WalletsDialog>` + `<CustomSymbolsDialog>` | ~6-8h |
| 15 | Sweep | A.4 #11-15 | `TradingProfilesDialog`, `ScreenerDialog`, `AnalyticsDialog`, `BacktestDialog`, `SettingsDialog` (post-reorg) | ~6h |
| 16 | Sweep | A.4 #16-17 | `DynamicSymbolRankings` inner dialogs + `<ConfirmationDialog>` callsite sweep | ~2h |
| 17 | Sweep | A.6 | i18n text audit — strip every `t('...', 'fallback')`, pass through every title/description/CTA in en, propagate to pt/es/fr | ~3-4h |
| 18 | Sweep | E.9 | Enable `audit-dialog-rules.mjs` in CI default-on | ~1h |
| 19 | Extraction | B.1 | Tier-1 extraction into `packages/ui-core/` | ~3-4h |
| 20 | Extraction | B.2 | Tier-2 extraction (token-aware + new dialog primitives) | ~2h |
| 21 | Extraction | B.3 | Tier-3 graduation: `PasswordStrengthMeter` | ~1-2h |
| 22 | Extraction | B.4 | Rename `ui-core` → `ui` | ~30min |
| 23 | Documentation | C.1 expansion | Fill out the component catalog with snippets per export | ~3-4h |
| 24 | Documentation | C.2 expansion | Fill out `UI_DESIGN_SYSTEM.md` anti-patterns gallery + composition rules | ~2-3h |
| 25 | Documentation | C.4 | JSDoc sweep on every public export | ~2h |

**Total estimated effort:** ~55-70h of focused work spread across ~25 PRs.

Track ordering rationale:
- **Track E (shared infra)** ships first — file renames + base types + hooks + i18n convention + validation schema reuse + audit script. Each per-dialog PR after E lands stays small because the scaffolding is in place.
- **Track A (foundation primitives + sweep)** ships next, on top of E.
- **Track B (`@marketmind/ui` extraction)** ships after A so the API stabilizes before the workspace move.
- **Track C (documentation)** runs alongside A and B — each foundational/sweep PR ships its own piece of documentation.

---

## Acceptance

A v1.6 phase is "done" when:
- Every dialog file ends in `*Dialog.tsx`. Zero `*Modal.tsx` files left.
- All 17 dialog surfaces use `<DialogShell>` + `<DialogSection>`.
- Every `interface XxxDialogProps` extends `DialogControlProps`.
- `useFormState` + `useMutationWithToast` are the only paths used in dialogs that submit a mutation.
- Every dialog-related i18n key follows `<feature>.dialogs.<dialog>.<key>`. en/pt/es/fr JSONs are 1:1 in those keys.
- Zero `t('...', 'fallback')` calls remain in `apps/electron/src/renderer/`.
- `audit-dialog-rules.mjs` reports 0 violations and runs in CI default-on.
- `apps/electron/src/renderer/components/ui/index.ts` re-exports from `@marketmind/ui` (or `@marketmind/ui` post-rename).
- `packages/ui-core/README.md` documents every export with a runnable snippet; JSDoc on every public export so IDE hover surfaces the rules.
- `docs/UI_DESIGN_SYSTEM.md` is the canonical reference (the older `UI_STYLE_GUIDE.md` either folds in or is archived).
- Visual regression baseline updated with the new dialog styling; no unintended regressions in non-dialog surfaces.
- Lint + type-check + all tests green.
- `pnpm test` test count holds or grows (the rewrites carry their existing tests; new primitives add their own).

When v1.6 lands, the codebase is ready for v1.7's *"apply the same pass to the rest of the app"* phase with the design system documented and the package boundary in place.
