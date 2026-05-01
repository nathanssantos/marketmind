# `@marketmind/ui` extraction plan

**Status:** plan-only. Extraction itself is a follow-up PR series.
**Authors:** v1.5 F.2.
**Last updated:** 2026-04-30.

The directory `apps/electron/src/renderer/components/ui/` has been the single source of truth for ~60 wrapper components since v1.0. `CLAUDE.md` calls it out as "designed for future extraction into a standalone `@marketmind/ui` package". This document inventories the surface, classifies each export by extraction readiness, and proposes a sequence so the first move can be a small, low-risk PR rather than a forklift migration.

## Inventory

The barrel at `apps/electron/src/renderer/components/ui/index.ts` exports 73 named bindings across 50+ files. They split cleanly into three tiers:

### Tier 1 — pure Chakra wrappers (extract first)

Theme-agnostic, no app-runtime dependencies. Re-export Chakra primitives with `forwardRef` + a stable API. These are the safest to extract because they have no peer-dep beyond `@chakra-ui/react`, `react`, and `react-icons`.

| Export | File | Imports |
|---|---|---|
| `Alert` | `alert.tsx` | chakra |
| `Badge` | `badge.tsx` | chakra |
| `BetaBadge` | `beta-badge.tsx` | chakra |
| `Button` | `button.tsx` | chakra |
| `Card` | `card.tsx` | chakra |
| `Checkbox` | `checkbox.tsx` | chakra |
| `CloseButton` | `close-button.tsx` | chakra |
| `ColorModeProvider`, `useColorMode` | `color-mode.tsx` | chakra + `next-themes` |
| `DataCard` | `data-card.tsx` | chakra |
| `Dialog` family | `dialog.tsx` | chakra |
| `Field` | `field.tsx` | chakra |
| `IconButton` | `icon-button.tsx` | chakra |
| `Image` | `image.tsx` | chakra |
| `Input` | `input.tsx` | chakra |
| `Link` | `link.tsx` | chakra |
| `Logo` | `logo.tsx` | chakra |
| `Menu` | `menu.tsx` | chakra |
| `NumberInput` | `number-input.tsx` | chakra |
| `PasswordInput` | `password-input.tsx` | chakra |
| `Popover` | `popover.tsx` | chakra |
| `ProgressBar`, `ProgressRoot` | `progress.tsx` | chakra |
| `Radio`, `RadioGroup` | `radio.tsx` | chakra |
| `Select` | `select.tsx` | chakra |
| `Separator` | `separator.tsx` | chakra |
| `Skeleton` | `skeleton.tsx` | chakra |
| `Slider` | `slider.tsx` | chakra |
| `Stat`, `StatRow` | `stat.tsx` | chakra |
| `Switch` | `switch.tsx` | chakra |
| `Table` | `table.tsx` | chakra |
| `Tabs` | `tabs.tsx` | chakra |
| `Textarea` | `textarea.tsx` | chakra |
| `ToggleIconButton` | `toggle-icon-button.tsx` | chakra |
| `TooltipWrapper` | `Tooltip.tsx` | chakra |

### Tier 2 — token-aware composed primitives (extract after Tier 1)

Pull from `@marketmind/tokens` (already a workspace package, F.1 #301). Extraction means `@marketmind/ui` declares `@marketmind/tokens` as a peer dep — clean since both will ship from the same monorepo.

| Export | File | Tokens used |
|---|---|---|
| `Callout` | `callout.tsx` | `MM.callout.tones`, `MM.callout.spacing` |
| `FormRow`, `FormSection` | `form-section.tsx` | `MM.section.title`, etc. |
| `MetricCard` | `MetricCard.tsx` | `getPnLColor` |
| `PanelHeader` | `panel-header.tsx` | `MM.section.title`, `MM.section.divider` |
| `PnLDisplay` | `PnLDisplay.tsx` | `getPnLColor` |
| `FieldHint`, `MetaText`, `PageTitle`, `SectionDescription`, `SectionTitle`, `SubsectionTitle` | `typography.tsx` | `MM.typography.*` |

Also includes `ColorPicker` (`color-picker.tsx`) and `Sidebar` family (`SidebarContainer`, `SidebarHeader`) — both Chakra-only but composed enough that they belong in Tier 2 to avoid splitting closely-related families.

### Tier 3 — app-runtime-coupled (stays in app indefinitely, or extract last with explicit peers)

These import from app-specific runtime: i18n strings, `@marketmind/utils` validators, app-only event listeners, asset URLs. Extracting them means either bundling i18n strings inside the package (anti-pattern) or expecting the consumer to provide a translation function (workable but invasive).

| Export | File | App coupling |
|---|---|---|
| `CollapsibleSection` | `CollapsibleSection.tsx` | local state only (could be Tier 2; needs check) |
| `ConfirmationDialog` | `ConfirmationDialog.tsx` | i18n + `window.keydown` listener |
| `CryptoIcon` | `CryptoIcon.tsx` | runtime asset path resolution |
| `DirectionModeSelector` | `DirectionModeSelector.tsx` | i18n + trading-domain enum |
| `EmptyState` | `EmptyState.tsx` | i18n |
| `ErrorMessage` | `ErrorMessage.tsx` | i18n |
| `FormDialog` | `FormDialog.tsx` | i18n |
| `GridWindow` | `GridWindow.tsx` | trading-specific layout primitive |
| `LoadingSpinner` | `LoadingSpinner.tsx` | i18n |
| `PasswordStrengthMeter` | `PasswordStrengthMeter.tsx` | i18n + `@marketmind/utils#validatePassword`/`passwordStrength` |

`PasswordStrengthMeter` is the cleanest Tier-3 candidate to graduate: only depends on `@marketmind/utils`, which can be a peer dep. The rest are tied to i18n strings, which are app-specific (en/pt/es/fr translation JSON lives in `apps/electron/src/renderer/locales/`).

## Peer-dependency boundaries

After F.1 shipped `@marketmind/tokens` as a real workspace package, the dependency stack is:

```
@marketmind/types ──┐
                    ├─→ @marketmind/utils ─→ @marketmind/tokens ─→ @marketmind/ui (proposed)
                    └─→ @marketmind/risk    @marketmind/trading-core
```

`@marketmind/ui` would declare:
- **Hard deps:** `@chakra-ui/react`, `react`, `react-dom`, `react-icons`
- **Peer deps:** `@marketmind/tokens` (Tier 2+), `@marketmind/utils` (only for `PasswordStrengthMeter` if Tier 3 graduates), `next-themes`
- **Excluded:** `@marketmind/types`, `@marketmind/risk`, `@marketmind/trading-core` — none of the wrappers reference trading types directly

`react-i18next` is **not** a hard dep for the package even after Tier 3 graduates. Tier-3 components that need translation should accept a `t` function via prop, defaulting to identity. This keeps `@marketmind/ui` framework-agnostic at the runtime boundary.

## Proposed extraction sequence

### PR 1 — `packages/ui-core/` skeleton + Tier 1 (low risk)
- New workspace `@marketmind/ui` (use `-core` suffix during the migration so the in-app `ui/` barrel can keep its name unchanged).
- Move all Tier-1 files. Keep `apps/electron/src/renderer/components/ui/index.ts` as a re-export aggregator: `export { Button, ... } from '@marketmind/ui'`.
- No app code touches imports — every site still imports from `@renderer/components/ui`. Verification: existing tests + visual regression suite must pass with zero diffs.
- Test infra: `vitest` config in the new package mirrors backend's `vitest.config.ts`. Same testing-library setup. Existing `apps/electron/src/renderer/components/ui/*.test.tsx` files move alongside their components.

### PR 2 — Tier 2 (token-aware)
- Move `callout.tsx`, `form-section.tsx`, `MetricCard.tsx`, `PnLDisplay.tsx`, `panel-header.tsx`, `typography.tsx`, `color-picker.tsx`, `Sidebar/`.
- `@marketmind/ui` declares `@marketmind/tokens` as a peer dep; `package.json` lists it under `peerDependencies` (warns on mismatch) and `devDependencies` (so the package builds locally).
- App-side `ui/index.ts` continues to re-export.

### PR 3 — Tier 3 graduation candidates
Only `PasswordStrengthMeter` graduates. Add `t` prop, default to identity. App-side wrapper at `ui/PasswordStrengthMeter.tsx` (8-line re-export) injects the real `useTranslation` `t`.

### PR 4 — Rename to `@marketmind/ui`
After PRs 1-3 land and bake (~1 sprint), rename the workspace from `ui-core` → `ui`. App imports stay on `@renderer/components/ui` throughout.

### PR 5 — Optional Storybook setup
Skip until external consumers (e.g. landing page repo) need a visual catalog. Adds maintenance cost; defer until justified.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Test infra duplication (vitest config in 2 places) | high | Symlink `vitest.config.ts` from monorepo root; share `@testing-library` setup file |
| Visual regression noise from import-path churn | medium | Tier 1 PR keeps every consumer's import unchanged via barrel re-export; visual suite runs with `maxDiffPixels=40000` already absorbing CI noise |
| Snapshot tests breaking on prop forwardRef change | low | Tier 1 components already use `forwardRef`; no API changes during extraction |
| Storybook setup creep | medium | Excluded from PRs 1-3 entirely; revisit when external consumer materializes |
| Electron-specific imports leaking in (e.g. `window.electron`) | low | Audit found only `window.addEventListener('keydown', ...)` in `ConfirmationDialog`; that's standard DOM API, not Electron-specific. CryptoIcon's asset path resolution is electron-aware (uses `import.meta.env.BASE_URL`), so it stays Tier 3 |
| Tokens package version drift between monorepo and external consumers | medium | Pin `@marketmind/tokens` as a `peerDependency` with a wide semver range; lock exact version in app `package.json` |
| i18n strings hardcoded in Tier-3 `t('foo')` calls | n/a | Tier 3 stays app-side until graduated with a `t` prop; addressed PR-by-PR |

## What this PR ships

This PR is the document above. No code moves yet. The next concrete action is **PR 1** above — Tier-1 extraction behind the `ui-core` alias — which can be a separate ~3-hour PR following this audit.

## Effort summary

| Slice | Effort | Risk |
|---|---|---|
| F.2 audit doc (this PR) | 3-4h | zero |
| PR 1 (Tier 1 + skeleton) | 3-4h | low |
| PR 2 (Tier 2) | 2h | low |
| PR 3 (Tier 3 graduation) | 1-2h | low |
| PR 4 (rename) | 30min | trivial |
| PR 5 (Storybook) | deferred | — |
