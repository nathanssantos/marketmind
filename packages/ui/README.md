# `@marketmind/ui`

Tier-1 + Tier-2 UI primitives shared across the MarketMind renderer and any future surface (landing site, docs site, dev tools). Extracted from `apps/electron/src/renderer/components/ui/` per `docs/UI_EXTRACTION_PLAN.md` and the v1.6 cycle.

## Why this package exists

- **One place** to look for "what UI primitives do we have?" — the catalog below + JSDoc on every export.
- **Theme-agnostic surface**: components consume Chakra's semantic tokens (`fg.muted`, `bg.panel`, `trading.profit`) and `MM.*` design tokens. They don't hardcode shade literals like `red.500` — that rule is enforced by `scripts/audit-shade-literals.mjs`.
- **No app-runtime coupling**: nothing in this package imports `trpc`, the renderer's stores, or the i18n provider. Components that need i18n stay in the app under `apps/electron/src/renderer/components/ui/` (Tier 3).

## What's inside

### Tier 1 — pure Chakra wrappers (32)

Each is a `forwardRef`-wrapped re-export of the Chakra primitive with a stable API and the standard size defaults the app uses (typically `size="xs"` or `size="sm"`).

| Export | File | One-liner |
|---|---|---|
| `Alert` | `alert.tsx` | Chakra alert with `Root/Title/Description/Indicator/Content` slots |
| `Badge` | `badge.tsx` | Compact pill — recipe-driven from `@marketmind/tokens` |
| `BetaBadge` | `beta-badge.tsx` | "BETA" badge wrapper |
| `Button` | `button.tsx` | Chakra button — defaults `size="xs"` |
| `Card` | `card.tsx` | Card with `Root/Body/Header/Footer` slots |
| `Checkbox` | `checkbox.tsx` | Chakra checkbox |
| `CloseButton` | `close-button.tsx` | Defaults `aria-label="Close"` (a11y) |
| `DataCard` | `data-card.tsx` | Outlined card for metric blocks |
| `Dialog` family | `dialog.tsx` | All Chakra dialog parts: `Root/Backdrop/Positioner/Content/Header/Body/Footer/Title/CloseTrigger/ActionTrigger` |
| `Field` | `field.tsx` | Form field wrapper with label/error/helper |
| `IconButton` | `icon-button.tsx` | Icon-only button |
| `Image` | `image.tsx` | `<img>` wrapper with fallback |
| `Input` | `input.tsx` | Text input |
| `Link` | `link.tsx` | Anchor with theme-aware color |
| `Logo` | `logo.tsx` | Layered brain+chart icon |
| `Menu` | `menu.tsx` | Dropdown menu |
| `NumberInput` | `number-input.tsx` | Number input with steppers |
| `PasswordInput` | `password-input.tsx` | Password input with reveal toggle |
| `Popover` | `popover.tsx` | Floating panel anchored to a trigger |
| `ProgressBar`, `ProgressRoot` | `progress.tsx` | Linear progress |
| `Radio`, `RadioGroup` | `radio.tsx` | Radio inputs |
| `Select` | `select.tsx` | Custom select with portal control |
| `Separator` | `separator.tsx` | `<hr>` wrapper |
| `Skeleton` | `skeleton.tsx` | Loading placeholder |
| `Slider` | `slider.tsx` | Range slider |
| `Stat`, `StatRow` | `stat.tsx` | Label/value pair |
| `Switch` | `switch.tsx` | On/off toggle |
| `Table` family | `table.tsx` | All Chakra table parts: `Root/Header/Body/Row/ColumnHeader/Cell` |
| `Tabs` | `tabs.tsx` | Chakra tabs |
| `Textarea` | `textarea.tsx` | Multi-line text input |
| `ToggleIconButton` | `toggle-icon-button.tsx` | Icon button with active/inactive variants |

### Tier 2 — token-aware composed primitives (10+)

These import from `@marketmind/tokens` (`MM.*` constants, `getPnLColor`). They depend on Tier 1.

| Export | File | One-liner |
|---|---|---|
| `Callout` | `callout.tsx` | Inline info/success/warning/danger box. Replaces ad-hoc colored `<Box bg="blue.50">` patterns |
| `ColorPicker` | `color-picker.tsx` | Hex color swatch grid + manual input, popover-anchored |
| `CreateActionButton` | `create-action-button.tsx` | "+ Create X" / "Add X" / "Import X" trigger button. See `docs/UI_CREATION_FLOWS.md` |
| `DialogSection` | `dialog-section.tsx` | Section primitive for dialog bodies (title + description + action + body) |
| `FormSection`, `FormRow` | `form-section.tsx` | Standard section block + label/control row |
| `PanelHeader` | `panel-header.tsx` | Dashboard panel header with `borderBottom` separator |
| `SidebarContainer`, `SidebarHeader` | `Sidebar/` | Sidebar layout primitives |
| `FieldHint`, `MetaText`, `PageTitle`, `SectionDescription`, `SectionTitle`, `SubsectionTitle` | `typography.tsx` | Semantic text blocks at standard sizes/weights |

## What's *not* here (Tier 3 — stays app-side)

- **`DialogShell`** — uses `useTranslation`. Pulling react-i18next into `ui-core` would force every consumer to set up an i18n provider just to render a dialog. Lives at `apps/electron/src/renderer/components/ui/dialog-shell.tsx` until a future PR decouples by accepting `cancelLabel`/`submitLabel` as required props.
- **`MetricCard`, `PnLDisplay`, `TooltipWrapper`** — depend on `useColorMode`, which is tRPC-coupled (reads/writes user preferences for color mode). Decoupling means accepting `colorMode` as a prop or splitting the component into a presentational shell + a color-mode-aware app-side wrapper.
- **`ColorModeProvider` / `useColorMode`** — the trpc-coupled provider itself.
- **`ConfirmationDialog`, `EmptyState`, `ErrorMessage`, `FormDialog`, `LoadingSpinner`, `PasswordStrengthMeter`** — all use `useTranslation` (i18n strings).
- **`CryptoIcon`** — runtime asset path resolution.
- **`DirectionModeSelector`** — i18n + trading-domain enum.
- **`GridWindow`** — trading-specific layout primitive.
- **`CollapsibleSection`** — could graduate (local state only); deferred for now.

The barrel at `apps/electron/src/renderer/components/ui/index.ts` re-exports everything from `@marketmind/ui` plus the Tier-3 components, so app-site imports stay `@renderer/components/ui` and don't change.

## Usage

```tsx
import {
  Button,
  Callout,
  DialogSection,
  Field,
  FormSection,
  Input,
} from '@marketmind/ui';

<FormSection title="API credentials" description="Read-only.">
  <FormRow label="API key">
    <Input placeholder="sk-..." />
  </FormRow>
  <Callout tone="warning" compact>
    Never share your API key.
  </Callout>
</FormSection>
```

## Conventions every component follows

1. **`forwardRef`** so the consumer can attach refs to the underlying DOM element.
2. **Semantic tokens only** — `fg`, `fg.muted`, `bg.panel`, `trading.profit`, etc. Never raw `red.500` / `green.50`. Audited by `scripts/audit-shade-literals.mjs`.
3. **`MM.*` for spacing/typography** — `MM.spacing.row.gap`, `MM.font.sectionTitle.size`, `MM.dialog.bodyPadding`. Consumers shouldn't hardcode `gap={4}` either; pull the matching token.
4. **Default size = compact** — `size="xs"` for buttons, `size="sm"` for inputs/selects, matching the app's density target.
5. **No `_dark={{ ... }}` overrides** — semantic tokens auto-resolve light/dark.
6. **TypeScript-first** — every export ships its `*Props` type alongside.

## Adding a new component

1. Decide the tier:
   - **Tier 1** if it's a pure Chakra wrapper or composed only from other Tier-1 primitives.
   - **Tier 2** if it consumes `@marketmind/tokens` (MM constants, getPnLColor).
   - **Tier 3** (stays app-side) if it imports `useTranslation`, `useColorMode`, the renderer's stores, tRPC, or anything from `@/renderer/...` outside the ui directory.
2. Drop the file into `packages/ui-core/src/<name>.tsx`.
3. Export from `packages/ui-core/src/index.ts` — group with its tier.
4. Re-export from `apps/electron/src/renderer/components/ui/index.ts` so app-site imports stay `@renderer/components/ui`.
5. Tests go in `apps/electron/src/renderer/components/ui/<name>.test.tsx` (the renderer has the vitest infra; tests import the primitive from `@marketmind/ui`).
6. JSDoc the public exports — IDE hover should surface the rules + accepted prop values.

## Related

- `docs/UI_EXTRACTION_PLAN.md` — the original audit + sequencing.
- `docs/UI_CREATION_FLOWS.md` — pattern for creation-dialog triggers (`useDisclosure` + `<CreateActionButton>` + `<DialogShell>`).
- `docs/I18N_DIALOG_KEYS.md` — i18n key shape convention for dialogs.
- `docs/V1_6_PLAN.md` — full v1.6 cycle plan including Tracks E (shared infra), A (modal sweep), B (this extraction), C (this docs).
- `@marketmind/tokens` — the design tokens this package consumes.
