# UI Dialog Patterns — the component bible

> **Purpose.** Every dialog in MarketMind is one of a small handful of *jobs*. This document fixes the canonical pattern for each job so a future contributor never has to re-decide. Read this *before* writing or rewriting a dialog.
>
> **Authority.** This document supersedes ad-hoc patterns scattered across the codebase. Where the existing code conflicts, the rule here wins — those are the rewrites Track G is doing.
>
> **Scope.** Just dialogs. Sidebars / panels / pages get their own pattern doc when v1.7 starts.

---

## Table of contents

- [Job-to-pattern map (the cheat sheet)](#job-to-pattern-map)
- [Shell rules (recap from v1.6 A)](#shell-rules)
- [Patterns by job](#patterns-by-job)
  - [Single-field input](#single-field-input)
  - [Standard form (2–6 fields)](#standard-form)
  - [Conditional / branching form](#conditional-form)
  - [Multi-step flow](#multi-step-flow)
  - [Destructive confirmation](#destructive-confirmation)
  - [Object-management dialog (list + create + edit)](#object-management)
  - [Read-only data viewer](#data-viewer)
  - [Workflow dialog with tabs](#workflow-with-tabs)
- [Cross-cutting rules](#cross-cutting-rules)
  - [Title, description, CTA verb](#title-description-cta)
  - [Field layout: stack vs grid](#field-layout)
  - [Helper text vs hint vs description](#helper-text)
  - [Error display](#error-display)
  - [Success feedback](#success-feedback)
  - [Loading body](#loading-body)
  - [Empty body](#empty-body)
  - [Footer button order + colors](#footer-buttons)
  - [Keyboard](#keyboard)
- [Component picker (which primitive for which input)](#component-picker)
- [What never to do](#never)
- [Test coverage](#test-coverage)

---

<a id="job-to-pattern-map"></a>
## Job-to-pattern map (the cheat sheet)

| Dialog's job | Pattern | Width | Example |
|---|---|---|---|
| Take ONE input (rename, paste blob) | [Single-field input](#single-field-input) | `sm` | SaveScreenerDialog, ImportProfileDialog |
| Create / edit one record (2–6 fields, no tabs) | [Standard form](#standard-form) | `md` | CreateWalletDialog, AddWatcherDialog |
| Form whose fields depend on a "type" select | [Conditional form](#conditional-form) | `md` | CreateWalletDialog (paper/testnet/live, Binance/IB) |
| Multi-step (config → review → run) | [Multi-step flow](#multi-step-flow) | `md` or `lg` | BacktestDialog |
| Confirm a destructive action | [Destructive confirmation](#destructive-confirmation) | `sm` | ChartCloseDialog (full close), `<ConfirmationDialog>` callsites |
| Manage a list of records (CRUD inline) | [Object management](#object-management) | `lg` | WalletsDialog, TradingProfilesDialog, CustomSymbolsDialog |
| Browse data with filters/sort | [Data viewer](#data-viewer) | `lg` | OrdersDialog, KeyboardShortcutHelpDialog |
| Configure a many-faceted subject | [Workflow with tabs](#workflow-with-tabs) | `xl` | SettingsDialog, AnalyticsDialog, ProfileEditorDialog, ScreenerDialog |

If a dialog seems to cross categories (e.g. "create + view in one screen"), split it. One job per dialog (UX rule #3).

---

<a id="shell-rules"></a>
## Shell rules (recap from v1.6 A)

These are the rules `<DialogShell>` enforces by default. Don't override them.

- **Use `<DialogShell>` or its `<FormDialog>` alias** — never hand-roll `Dialog.Root → Dialog.Backdrop → Dialog.Positioner → Dialog.Content`.
- **`size` is a token**, not a number: `sm` (~400px) / `md` (~560px) / `lg` (~840px) / `xl` (~1100px / 90vw) / `full`.
- **Header**: title + optional description + optional inline action (top-right, e.g. "Reset to defaults").
- **Footer**: `borderTop`, right-aligned, Cancel left of primary, primary rightmost. Loading state on primary disables both. Destructive primary uses `colorPalette="red"`.
- **Esc + click-outside close** — except when `isLoading=true` (mid-mutation), which blocks both.

Audit gate: `pnpm lint:dialogs:strict` enforces all of the above.

---

<a id="patterns-by-job"></a>
## Patterns by job

<a id="single-field-input"></a>
### Single-field input

**Use when** the entire dialog is asking for ONE value. Rename, paste blob, set a single number.

**Pattern.**

```tsx
<FormDialog
  isOpen={isOpen}
  onClose={onClose}
  size="sm"
  title={t('feature.dialogs.X.title')}
  description={t('feature.dialogs.X.description')}  // present iff non-obvious
  onSubmit={handleSubmit}
  submitLabel={t('common.save')}
  submitDisabled={!isValid}
  isLoading={isSaving}
>
  <Field label={t('feature.dialogs.X.fieldLabel')}>
    <Input
      size="xs"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={t('feature.dialogs.X.fieldPlaceholder')}
      autoFocus
    />
  </Field>
</FormDialog>
```

**Rules.**
- `autoFocus` on the single input.
- `submitDisabled` derived from `value.trim().length > 0` (or schema validation).
- Pressing Enter inside the input submits the form.
- No `<Stack>` wrapping a single `<Field>` — the Field is the body.

<a id="standard-form"></a>
### Standard form (2–6 fields)

**Use when** creating/editing a single record with a small handful of fields, no branching.

**Pattern.**

```tsx
<FormDialog
  isOpen={isOpen}
  onClose={onClose}
  size="md"
  title={t('feature.dialogs.X.title')}
  description={t('feature.dialogs.X.description')}
  onSubmit={handleSubmit}
  submitLabel={t('common.create')}      // see CTA verb table
  submitColorPalette="blue"             // see footer color rule
  submitDisabled={!isValid}
  isLoading={isCreating}
>
  <Stack gap={3}>
    <Field label={t('...')}>
      <Input size="xs" {...} />
    </Field>
    <Field label={t('...')}>
      <Select size="xs" usePortal={false} {...} />
    </Field>
    <Field label={t('...')}>
      <NumberInput size="xs" {...} />
    </Field>

    {error && <Callout tone="danger" compact>{error}</Callout>}
  </Stack>
</FormDialog>
```

**Rules.**
- `<Stack gap={3}>` for the body (between fields).
- Inputs at `size="xs"` — uniform. Never mix `xs` and `sm` in the same dialog.
- `<Select>` always with `usePortal={false}` inside dialogs (Chakra DialogPositioner intercepts portal clicks — known issue, in feedback memory).
- Inline error: `<Callout tone="danger" compact>` at the BOTTOM of the body, below the last field. Not as a toast, not above the title.
- Use `useFormState<T>` when the form has ≥ 3 fields — handles initial state, reset on close, and a typed `setField`.

<a id="conditional-form"></a>
### Conditional / branching form

**Use when** field set changes based on a "type" select (paper vs live, exchange A vs B, etc.).

**Pattern.** Same as [Standard form](#standard-form) plus:

- The "type" select is **always the first field** in the form (after title/description).
- Conditional fields appear *below* the type select, NEVER above it. The user reads top-to-bottom.
- Use a single `{condition && (<>…</>)}` wrapper per type-branch — don't sprinkle multiple `{cond && …}` checks throughout the form.
- Provide context for branches via `<Callout tone="info">` or `<Callout tone="warning">` BEFORE the conditional fields, never after.

```tsx
<Stack gap={3}>
  <Field label={t('feature.dialogs.X.type')}>
    <Select value={type} onChange={setType} options={…} usePortal={false} />
  </Field>

  {type === 'paper' && (
    <>
      <Callout tone="info" title={t('feature.dialogs.X.paperInfo')} compact>
        {t('feature.dialogs.X.paperDescription')}
      </Callout>
      {/* paper-only fields */}
    </>
  )}

  {type === 'live' && (
    <>
      <Callout tone="warning" title={t('feature.dialogs.X.liveWarning')} compact>
        {t('feature.dialogs.X.liveDescription')}
      </Callout>
      {/* live-only fields */}
    </>
  )}

  {error && <Callout tone="danger" compact>{error}</Callout>}
</Stack>
```

**Rules.**
- Conditional sections sharing the same fields collapse into one branch — never write the same field twice in different branches.
- When a "live" / "real money" branch exists, its primary CTA flips to `submitColorPalette="red"`. The destructive-color rule below applies the same way.

<a id="multi-step-flow"></a>
### Multi-step flow

**Use when** the user must complete steps in order and reviewing intermediate state matters (Backtest = config → run → results).

**Pattern.**

- A header strip below the title shows step indicators (1 → 2 → 3) — current step solid, completed steps with check, future steps muted.
- Body shows ONE step at a time.
- Footer: `Cancel` (left), `Back` (only on step ≥ 2), primary forward action (label changes per step: `Next` / `Run` / `Done`).
- Forward CTA disabled until current step is valid.
- Going back never loses state — keep `useState` for each step's data hoisted at the dialog level.

A multi-step dialog with N=2 steps is fine; with N≥4 it's a sign the dialog should be a workflow with tabs instead.

<a id="destructive-confirmation"></a>
### Destructive confirmation

**Use when** the action is irreversible OR has cross-cutting effects (close a position, delete a wallet, cancel a watcher mid-run).

**Pattern.** ALWAYS through the shared `<ConfirmationDialog>` primitive — never inline `if (confirm())`, never a hand-rolled DialogShell with destructive buttons.

```tsx
<ConfirmationDialog
  isOpen={isOpen}
  onClose={onClose}
  onConfirm={onConfirm}
  title={t('feature.dialogs.X.title')}                // imperative: "Delete wallet?"
  description={t('feature.dialogs.X.description')}    // explain consequence in 1 sentence
  confirmLabel={t('feature.dialogs.X.confirm')}       // imperative: "Delete", "Close position"
  confirmColorPalette="red"
  isLoading={isProcessing}
/>
```

**Rules.**
- Title ends with `?` IF asking for confirmation; period (or no terminator) if stating an action.
- Description ≤ 80 chars, explains what gets lost / changed.
- Confirm button uses imperative verb that matches the title ("Delete wallet?" → "Delete"; "Close position?" → "Close position").
- NEVER "OK" / "Yes" / "Confirm" as the confirm label. The verb tells the user what they're doing.
- For positions/orders being closed at market: include the current price + PnL in the body BEFORE the buttons (see ChartCloseDialog).

<a id="object-management"></a>
### Object-management dialog (list + create + edit)

**Use when** the dialog manages a collection (Wallets, Trading Profiles, Custom Symbols).

**Pattern.**

```tsx
<DialogShell
  isOpen={isOpen}
  onClose={onClose}
  size="lg"
  title={t('feature.dialogs.X.title')}
  description={t('feature.dialogs.X.description')}
  headerAction={
    <CreateActionButton onClick={() => createDisclosure.onOpen()}>
      {t('feature.dialogs.X.create')}
    </CreateActionButton>
  }
>
  {records.length === 0 ? (
    <EmptyState
      title={t('feature.dialogs.X.emptyTitle')}
      description={t('feature.dialogs.X.emptyDescription')}
      action={<Button onClick={() => createDisclosure.onOpen()}>{t('feature.dialogs.X.createFirst')}</Button>}
    />
  ) : (
    <Stack gap={2}>
      {records.map((r) => <RecordRow key={r.id} record={r} … />)}
    </Stack>
  )}

  <CreateXDialog isOpen={createDisclosure.isOpen} onClose={createDisclosure.onClose} … />
</DialogShell>
```

**Rules.**
- `+ Create` button always in `headerAction` (top-right of header) — NEVER as the primary footer button.
- The footer of an object-management dialog is just `<DialogCloseTrigger>`-equivalent (`Done` / `Close`). No primary action — the actions are per-row.
- Empty state has the create CTA as its primary action.
- Per-row inline actions (edit/delete/duplicate) live as icon buttons on the right of each row.
- Per-row "edit" opens a separate `<FormDialog>` modal (see [Standard form](#standard-form)). NEVER inline-edit by replacing the row content with form fields — bad UX, hard to test, breaks keyboard flow.
- Destructive per-row actions (delete) route through `<ConfirmationDialog>` — see [Destructive confirmation](#destructive-confirmation).

<a id="data-viewer"></a>
### Read-only data viewer

**Use when** the user is browsing data they can't directly mutate from this dialog (orders, shortcut help, audit logs).

**Pattern.**

```tsx
<DialogShell
  isOpen={isOpen}
  onClose={onClose}
  size="lg"
  title={t('feature.dialogs.X.title')}
  description={t('feature.dialogs.X.description')}
>
  {isLoading ? (
    <PanelSpinner />
  ) : isError ? (
    <Callout tone="danger" title={t('feature.dialogs.X.errorTitle')}>
      {t('feature.dialogs.X.errorBody')}
    </Callout>
  ) : data.length === 0 ? (
    <EmptyState title={t('feature.dialogs.X.emptyTitle')} description={t('feature.dialogs.X.emptyDescription')} />
  ) : (
    <Table>{/* rows */}</Table>
  )}
</DialogShell>
```

**Rules.**
- Data viewer has NO footer primary action (no save, no submit). Just `Close`.
- Filters live in the header `headerAction` slot when small (≤ 2 selects); above the table otherwise.
- Loading / error / empty: ALWAYS the three primitives (`PanelSpinner` / `Callout tone="danger"` / `EmptyState`). NEVER bespoke text.

`PanelSpinner` is shorthand for the standard panel-loading combo:

```tsx
<Flex justify="center" align="center" py={MM.spinner.panel.py}>
  <Spinner size={MM.spinner.panel.size} />
</Flex>
```

If this combo appears more than 3 times in the codebase after Track G, extract it as a primitive.

<a id="workflow-with-tabs"></a>
### Workflow dialog with tabs

**Use when** configuring a many-faceted subject (Settings, Analytics, ProfileEditor, Screener).

**Pattern.**

```tsx
<DialogShell
  isOpen={isOpen}
  onClose={onClose}
  size="xl"
  title={t('feature.dialogs.X.title')}
  description={t('feature.dialogs.X.description')}
>
  <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="line">
    <Tabs.List>
      <Tabs.Trigger value="general">{t('feature.dialogs.X.tabs.general')}</Tabs.Trigger>
      <Tabs.Trigger value="signals">{t('feature.dialogs.X.tabs.signals')}</Tabs.Trigger>
      …
    </Tabs.List>
    <Tabs.Content value="general"><GeneralTab /></Tabs.Content>
    <Tabs.Content value="signals"><SignalsTab /></Tabs.Content>
    …
  </Tabs.Root>
</DialogShell>
```

**Rules.**
- One tab = one focused responsibility. If a tab body is > ~250 LOC or has ≥ 5 sections, split it.
- Each tab body is a `<Stack gap={5}>` of `<FormSection title description>`s. (Same shape Settings tabs use today.)
- Tab order: most-common-first (General first, advanced last).
- Tabs i18n key: `feature.dialogs.X.tabs.<name>` (per `docs/I18N_DIALOG_KEYS.md`).
- Footer of a workflow dialog: usually no primary action — saves happen per-tab via inline buttons or auto-save. Document why on a per-dialog basis.
- `<Tabs.Root>` uses `variant="line"` always (consistent visual weight).

---

<a id="cross-cutting-rules"></a>
## Cross-cutting rules

<a id="title-description-cta"></a>
### Title, description, CTA verb

**Title** — present tense, sentence case, no terminator. The verb form depends on the job:

| Job | Verb form | Example title |
|---|---|---|
| Single-field input / Standard form (creating) | Imperative + object | "Create wallet", "Add watcher" |
| Standard form (editing existing) | "Edit" + object | "Edit profile", "Edit watcher" |
| Destructive confirmation | Question with `?` | "Close position?", "Delete wallet?" |
| Object management | Object plural noun | "Wallets", "Trading profiles" |
| Data viewer | Object plural noun | "Orders", "Audit log" |
| Workflow with tabs | Subject noun | "Settings", "Analytics" |

**Description** (the line below the title in `<DialogShell>`'s header):
- Present iff the title alone doesn't tell the user what this dialog does.
- ≤ 80 characters.
- Period at the end.
- Avoid restating the title. "Create a new wallet for trading on Binance." is bad if the title is "Create wallet" — say something the title doesn't, or omit.

**CTA (primary footer button)** — pick from this fixed list:

| Job | CTA verb |
|---|---|
| Create form | "Create" |
| Edit form | "Save" |
| Confirmation (destructive) | The action verb: "Delete", "Cancel order", "Close position" |
| Confirmation (non-destructive) | "Confirm" |
| Multi-step intermediate | "Next" |
| Multi-step final | "Run", "Apply", "Done" (whichever fits the action) |
| Object-management close | "Done" |
| Data viewer close | "Close" |

NEVER use: "OK", "Submit" (too generic), "Yes" / "No", "Apply changes" (use "Save"), "Confirm" for destructive actions (use the action verb).

<a id="field-layout"></a>
### Field layout: stack vs grid

- **≤ 4 fields**: vertical `<Stack gap={3}>`.
- **5–8 fields with logical pairs** (e.g. "min" + "max", "from" + "to", "API key" + "API secret"): pairs side-by-side via `<HStack gap={3}>`, but the rest of the form stays in `<Stack>`. Pair only when the two fields are SEMANTICALLY paired — don't pack 2 unrelated fields just to save vertical space.
- **> 8 fields**: split into `<DialogSection>`s (header per group). If you have > 12 fields total, the dialog probably wants tabs.

NEVER use a CSS grid with arbitrary column counts inside a dialog body. Stack-vs-HStack is the entire vocabulary.

<a id="helper-text"></a>
### Helper text vs hint vs description

- **`<SectionDescription>`** — one line below a `<DialogSection>` title. Explains the section's purpose in ~10 words.
- **`<FieldHint>`** — one short line below a single field's input. Explains a constraint or unit. ≤ 60 chars.
- **`<MetaText>`** — small muted text used for displaying values (not for explaining inputs). Example: "Last updated 2h ago".

Don't use `<Text fontSize="xs" color="fg.muted">` directly — pick the right named primitive so the rule is enforceable.

<a id="error-display"></a>
### Error display

Three channels, three rules:

| Error scope | Channel | Component |
|---|---|---|
| Per-field validation (e.g. "this field is required") | Inline next to the field | `<Field error={…}>` |
| Dialog-wide validation or mutation error (e.g. "Failed to create wallet: API key invalid") | At the bottom of the body | `<Callout tone="danger" compact>` |
| Cross-dialog or background error (e.g. "Connection lost") | Toast | `toaster.create({ type: 'error', … })` |

Never put a mutation error in a toast if the user is still looking at the form that caused it — they'd lose the form context. Put it in the dialog body.

Never use `<Alert>` for errors inside a dialog body — `<Callout>` has the right framing (compact, contextual). `<Alert>` is for page-level / app-level banners.

<a id="success-feedback"></a>
### Success feedback

Two patterns, choose one per dialog:

**1. Silent close + toast** (the default). Mutation succeeds → dialog closes → success toast appears.

```tsx
const handleSubmit = async () => {
  try {
    await mutation.mutateAsync(values);
    toaster.create({ type: 'success', title: t('feature.dialogs.X.successTitle') });
    onClose();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  }
};
```

**2. Inline success state** (rare; use only for "modify and stay" flows like Settings tabs). The dialog stays open and shows an inline success indicator.

When using pattern 1, NEVER also show inline success state. Pick one.

<a id="loading-body"></a>
### Loading body

When the dialog body is waiting on an initial fetch:

```tsx
<Flex justify="center" align="center" py={MM.spinner.panel.py}>
  <Spinner size={MM.spinner.panel.size} />
</Flex>
```

NEVER bespoke "Loading…" / "Carregando…" text. The audit script `audit-dialog-content.mjs` (Track G.3) catches this.

When the dialog has DATA but a per-section action is mutating, gray out the section (`opacity={0.6}`) and disable controls — don't replace the section with a spinner.

<a id="empty-body"></a>
### Empty body

```tsx
<EmptyState
  title={t('feature.dialogs.X.emptyTitle')}
  description={t('feature.dialogs.X.emptyDescription')}
  action={primaryAction}  // optional
/>
```

NEVER bespoke "Nada por aqui" / "No data" / "Empty" text. Always `<EmptyState>`.

For data viewers, `<EmptyState>` has no action — closing the dialog is the only choice. For object-management dialogs, the empty state's action is "Create your first X".

<a id="footer-buttons"></a>
### Footer button order + colors

| Position | Component | Variant | Color |
|---|---|---|---|
| Left | Cancel / Back | `variant="ghost"` | `colorPalette="gray"` (default) |
| Right (primary) | Action verb | `variant="solid"` | depends on action — see below |

Primary color rule:

| Action | `submitColorPalette` |
|---|---|
| Standard create / edit / save | `"blue"` (default — equivalent to `accent.solid`) |
| Destructive (delete, close, cancel order) | `"red"` |
| Live-money / high-stakes (live wallet, large bet) | `"red"` |
| Start / activate (start watcher, run backtest) | `"green"` |
| Done / dismiss in object-management or viewer | `"gray"` |

NEVER use `"orange"` / `"yellow"` / `"purple"` for primary action buttons — those colors are for tone tokens (warnings, badges, callouts), not actions. Action color is a binary signal: blue=safe, red=careful, green=start, gray=neutral.

<a id="keyboard"></a>
### Keyboard

- **Esc** closes the dialog (unless `isLoading=true`).
- **Enter** inside any input submits the form, IF the form has a single primary action.
- **Tab** order: top-to-bottom, left-to-right. Skip non-interactive elements.
- **Arrow keys** move within `<Tabs.List>` and `<Select>` panels (Chakra default).

Run the axe-core spec (`apps/electron/e2e/a11y-dialogs.spec.ts`) after rewriting any dialog. Adding a new dialog without an axe assertion is a regression.

---

<a id="component-picker"></a>
## Component picker (which primitive for which input)

| Input type | Primitive |
|---|---|
| Short text (name, label, code) | `<Input size="xs">` |
| Long text (description, JSON blob) | `<Textarea size="xs">` |
| Password | `<PasswordInput size="xs">` |
| Number with min/max/step | `<NumberInput size="xs">` |
| Choice from < 6 options | `<Select size="xs" usePortal={false}>` |
| Choice from > 5 options OR with search | `<Select size="xs" usePortal={false}>` with searchable variant (TBD — track in v1.7) |
| Boolean toggle | `<Switch size="sm">` |
| Multi-select boolean (e.g. enable subset) | `<Checkbox.Group>` |
| Single choice from 2–4 options (visual buttons, e.g. theme picker) | `<Group attached>` of `<Button>`s with `variant="solid"` for selected, `"outline"` for others |
| Color | `<ColorPicker>` |
| Symbol | `<SymbolSelector>` |
| Timeframe | `<TimeframeSelector>` |
| Date / date range | (TBD — no canonical date primitive yet; use native input until we ship one) |
| File upload | (TBD — only `ImportProfileDialog` does this; uses textarea for paste, no real file picker) |

Inputs all at `size="xs"` is the rule for dialog density. Switch is at `size="sm"` because xs is too small for a touch target.

---

<a id="never"></a>
## What never to do

This is the quick "do not commit" list — most of these are caught by `audit-dialog-rules.mjs --strict`, but listing them once for clarity:

- Hand-rolled `Dialog.Root → Dialog.Backdrop → Dialog.Positioner → Dialog.Content`. Use `<DialogShell>`.
- Bespoke `<Text>Loading…</Text>` / `"Carregando..."` / `"Nada por aqui"` strings. Use the primitives.
- Inline `if (confirm('…'))`. Use `<ConfirmationDialog>`.
- `t('foo.bar', 'Fallback text')` — the JSON entry must exist (`audit-dialog-i18n-keys.mjs` enforces).
- Hardcoded `color="red.500"` / `bg="blue.50"`. Use semantic tokens (`bg.danger.subtle`, `fg.danger`, etc.).
- `<Alert>` inside a dialog body. Use `<Callout>`.
- A "+ Create" button in the FOOTER of an object-management dialog. It's a `headerAction`.
- "OK" or "Yes" as a CTA. Use the action verb.
- Mutation error displayed as a toast while the form is still open. Use `<Callout tone="danger">` in the body.
- Auto-opening a dialog on app mount or route change. Dialogs open from explicit user action (UX rule #13).
- Nesting modals more than 1 level deep (UX rule #10).
- `usePortal={true}` on `<Select>` inside a dialog. The DialogPositioner intercepts the click. (Memory: `feedback_select_in_dialog.md`.)

---

<a id="test-coverage"></a>
## Test coverage

Every dialog gets:

1. **One vitest browser test** that renders the dialog open, asserts the title and primary CTA are present, and snapshots the DOM. Diff a snapshot in PR review = visible regression check.
2. **One axe assertion** in `apps/electron/e2e/a11y-dialogs.spec.ts` opening the dialog and asserting no critical/serious axe violations.
3. **For dialogs with mutations**: a unit test of the mutation hook itself (separate from the dialog test) — the dialog test only covers the trigger.

Snapshot template:

```tsx
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateWalletDialog } from './CreateWalletDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('CreateWalletDialog', () => {
  it('renders title and primary CTA', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <CreateWalletDialog isOpen onClose={vi.fn()} onCreate={vi.fn()} />
      </ChakraProvider>,
    );
    expect(screen.getByText('trading.wallets.createTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'trading.wallets.create' })).toBeEnabled();
  });
});
```

---

## Companion documents

- [`docs/UI_DESIGN_SYSTEM.md`](UI_DESIGN_SYSTEM.md) — design language reference (colors, spacing, typography). Read this first if you're new to the codebase.
- [`docs/UI_CREATION_FLOWS.md`](UI_CREATION_FLOWS.md) — the `useDisclosure` + `<CreateActionButton>` pattern for opening creation dialogs from elsewhere.
- [`docs/I18N_DIALOG_KEYS.md`](I18N_DIALOG_KEYS.md) — the `<feature>.dialogs.<dialog>.<key>` i18n key shape convention.
- [`docs/V1_6_PLAN.md`](V1_6_PLAN.md) Track G — the per-dialog rewrite sequencing, status table, and individual dialog notes.

---

**Last updated:** 2026-05-02 (Track G.0).
