# MarketMind UI design system

> **Authority:** v1.6 cycle. Audit script: `scripts/audit-dialog-rules.mjs` and `scripts/audit-shade-literals.mjs`.
>
> **Quick answers**
> - **Where do primitives live?** `@marketmind/ui` (Tier 1 + Tier 2) or `apps/electron/src/renderer/components/ui/` (Tier 3 — i18n / runtime-coupled). Always import via `@renderer/components/ui` from app-site.
> - **Where do tokens live?** `@marketmind/tokens` — `MM.*` constants for spacing/typography/dialog sizes, `semanticTokenColors` for color tokens, `getPnLColor` helper.
> - **What's the design language reference?** This document.
> - **What's the per-component catalog?** `packages/ui-core/README.md`.
> - **What about creation flows / "Create X" buttons?** `docs/UI_CREATION_FLOWS.md`.

## The 13 dialog rules (v1.6)

These are the contracts every dialog honors. Codified by `scripts/audit-dialog-rules.mjs --strict`:

1. **Creation lives in dedicated dialogs, never in tabs.** A "+ Create X" button in a list view opens a dedicated `<DialogShell>`-based dialog for that one action.
2. **Settings is for *preferences and account state*, not *records you create*.** Wallets, trading profiles, custom symbols, watchers, screener saved sets — those go in dedicated management surfaces.
3. **One responsibility per modal.** Form, viewer, or workflow — pick one.
4. **Width is a token, not a number.** `<DialogShell size="sm|md|lg|xl|full">` reads from `MM.dialog.size`. No raw `maxW`.
5. **Title typography is fixed.** `MM.typography.dialogTitle` (md, semibold, short line-height). Optional one-line description below.
6. **Footer convention is fixed.** `borderTop`, right-aligned buttons, Cancel ghost / primary on the right. Loading state disables both.
7. **Empty / loading / error states are primitives.** `<EmptyState>`, `MM.spinner.panel`, `<Callout tone="danger">`. No bespoke text.
8. **Destructive confirms always go through `<ConfirmationDialog>`.** No inline are-you-sure UI.
9. **Esc + click-outside close, except mid-mutation.** When `isLoading` is true, both are blocked.
10. **No nested modals more than 1 level deep.**
11. **All user-visible strings come from i18n.** Zero `t('foo', 'fallback')` calls. Every dialog title, description, label, placeholder, helper, and CTA is in `en/pt/es/fr` JSON.
12. **Progressive disclosure for secondary fields.** Use `<CollapsibleSection variant="static">`.
13. **Modal opens from explicit user action.** Never auto-open on app mount, route load, or background event.

## Design tokens

### Spacing — `MM.spacing.*`

| Token | Value | Use |
|---|---|---|
| `MM.spacing.section.gap` | 4 (16px) | Between sections in a dialog or tab — matches VSCode density |
| `MM.spacing.row.gap` | 2.5 (10px) | Between rows inside a section |
| `MM.spacing.inline.gap` | 1.5 (6px) | Inline groups (icon + label, badges) |
| `MM.spacing.inlineTight.gap` | 1 (4px) | Compact inline (Callout compact mode) |
| `MM.spacing.dialogPadding` | 3 (12px) | Dialog body padding (legacy — prefer `MM.dialog.bodyPadding`) |
| `MM.spacing.sectionPadding` | 2.5 (10px) | Section content padding |

### Typography — `MM.typography.*` + `MM.font.*`

| Token | Use |
|---|---|
| `MM.typography.dialogTitle` | `<DialogShell>` title — md, semibold, short |
| `MM.typography.dialogDescription` | One-line description below title — xs, fg.muted, tall |
| `MM.typography.sectionTitle` | `<DialogSection>` / `<FormSection>` title — sm, semibold |
| `MM.typography.sectionDescription` | Section helper text — 2xs, fg.muted, tall |
| `MM.font.pageTitle` | lg, bold |
| `MM.font.body` | xs, normal |
| `MM.font.hint` | 2xs, normal |

### Dialog sizing — `MM.dialog.*`

| Size | Width | Use |
|---|---|---|
| `sm` | maxW: 400px | Confirmation, single-field rename |
| `md` | maxW: 560px | Standard form (CreateWallet, AddWatcher) |
| `lg` | maxW: 840px | Data viewer or 2-column form (Orders, ProfileEditor) |
| `xl` | maxW: 1100px / w: 90vw | Workflow modal with tabs (Settings, Backtest, Analytics) |
| `full` | 100vw | Fullscreen |

`MM.dialog.bodyPadding`, `headerPadding`, `footerPadding`, `sectionGap` — read by `<DialogShell>`. Drawers and side panels (v1.7+) read the same tokens for width consistency.

### Buttons — `MM.buttonSize.*`

| Token | Value | Use |
|---|---|---|
| `MM.buttonSize.primary` | `'xs'` | Default size for primary actions |
| `MM.buttonSize.secondary` | `'2xs'` | Secondary / cancel |
| `MM.buttonSize.nav` | `'2xs'` | Pagination / prev-next nav |

### Loading — `MM.spinner.*`

| Token | Value | Use |
|---|---|---|
| `MM.spinner.panel` | `{ size: 'md', py: 6 }` | Dashboard-style panel loading state |
| `MM.spinner.inline` | `{ size: 'sm', py: 0 }` | Inline within a row |

## Color — semantic tokens only

**Every color in the renderer flows through Chakra's semantic token system.** No `color="red.500"` literals. Audited by `scripts/audit-shade-literals.mjs --strict`.

### Domain palettes

- `fg` / `fg.muted` / `fg.subtle` — text foreground
- `bg.panel` / `bg.muted` / `bg.subtle` / `bg.emphasized` — backgrounds
- `border` — neutral borders
- `accent.{fg,subtle,solid}` — accent (active wallet, primary CTA)

### Trading semantics

- `trading.profit` — green for profitable PnL
- `trading.loss` — red for unprofitable PnL
- `trading.warning` — yellow for warning states (close to liquidation, etc.)

Use `getPnLColor(value, colorMode)` from `@marketmind/tokens` to pick `trading.profit` vs `trading.loss` based on a numeric value.

### Status palettes

- Use `colorPalette="X"` props on `<Badge>`, `<Button>`, etc. — `green | red | yellow | orange | blue | gray | accent`. The component picks the right shade automatically.

## Composition rules

### Modal/dialog body

Always inside `<DialogShell>`:

```tsx
<DialogShell size="md" title="..." description="..." onSubmit={...}>
  <DialogSection title="Section A" description="...">
    <Field label="Foo">...</Field>
    <Field label="Bar">...</Field>
  </DialogSection>
  <DialogSection title="Section B">
    ...
  </DialogSection>
</DialogShell>
```

### Settings tab body

Use `<FormSection>` (no border separator, just whitespace rhythm) for grouping prefs:

```tsx
<FormSection title="..." description="..." action={...}>
  <FormRow label="..." helper="..."><Switch /></FormRow>
  <Callout tone="info" compact>...</Callout>
</FormSection>
```

### Dashboard panel

Use `<PanelHeader>` (with `borderBottom`):

```tsx
<Box>
  <PanelHeader title="..." action={<Button size="2xs">Refresh</Button>} />
  <Box p={MM.spacing.sectionPadding}>
    {/* panel body */}
  </Box>
</Box>
```

### Empty / loading / error

```tsx
{isLoading && (
  <Flex justify="center" align="center" py={MM.spinner.panel.py}>
    <Spinner size={MM.spinner.panel.size} />
  </Flex>
)}
{!isLoading && rows.length === 0 && <EmptyState size="sm" title="..." />}
{error && <Callout tone="danger" compact>{error.message}</Callout>}
```

## Anti-patterns the audit forbids

| Pattern | Why | Fix |
|---|---|---|
| `color="red.500"` | hardcoded shade literal | semantic token (`trading.loss`, `red.fg`) |
| `_dark={{ bg: 'gray.700' }}` | semantic tokens auto-resolve light/dark | use `bg.muted` |
| `<Dialog.Root>` outside `ui-core/` | hand-rolled dialog | `<DialogShell>` |
| `maxW="1100px"` on `Dialog.Content` | raw width literal | `<DialogShell size="xl">` |
| `t('foo.bar', 'Default text')` | en JSON should be canonical | drop fallback; ensure key exists in JSON |
| `interface XxxDialogProps { isOpen; onClose; ... }` (without `extends DialogControlProps`) | duplicate boilerplate | `extends DialogControlProps from @marketmind/types` |
| `*Modal.tsx` filename | inconsistent with Chakra primitive name | rename to `*Dialog.tsx` |

## Maintaining this document

- Update when adding a new design token or changing a default.
- The catalog of components lives in `packages/ui-core/README.md` — link, don't duplicate.
- Anti-patterns table mirrors the audit script. Keep in sync.
