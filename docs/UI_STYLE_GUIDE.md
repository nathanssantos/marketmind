# UI Style Guide - MarketMind

Central reference for UI standardization across the MarketMind application.

> **Living Document:** This guide must be updated whenever components are created, modified, or deprecated. Keep it in sync with the actual codebase.

## The `ui/` Component Library

All reusable UI components live in `apps/electron/src/renderer/components/ui/`. This directory is the **single source of truth** and is designed for future extraction into a standalone `@marketmind/ui` package.

### Before Creating Any Component

1. Check `ui/index.ts` — the component may already exist
2. Check this guide for the full catalog below
3. If it doesn't exist, create a wrapper in `ui/` first, then use it from there

---

## Import Rules

### Single Canonical Import Path

All interactive/visual components must be imported from the barrel:

```tsx
import { Button, IconButton, Badge, Switch, Tabs } from '@renderer/components/ui';
```

### What Comes from `@renderer/components/ui`

**Every** interactive, composite, or styled component:

| Category | Components |
|----------|-----------|
| **Buttons** | `Button`, `IconButton`, `ToggleIconButton`, `CloseButton` |
| **Inputs** | `Input`, `NumberInput`, `PasswordInput`, `Textarea`, `Select`, `Slider`, `Switch`, `Checkbox`, `Radio`, `RadioGroup` |
| **Form** | `Field` |
| **Data Display** | `Badge`, `Card`, `Table`, `Stat`, `StatRow`, `PnLDisplay`, `MetricCard`, `CryptoIcon` |
| **Feedback** | `Alert`, `Skeleton`, `Progress` (`ProgressRoot`, `ProgressBar`), `LoadingSpinner`, `ErrorMessage`, `EmptyState` |
| **Navigation** | `Tabs`, `Menu`, `Link` |
| **Overlay** | `Dialog`, `FormDialog`, `ConfirmationDialog`, `Popover`, `TooltipWrapper` |
| **Layout** | `CollapsibleSection`, `Separator`, `SidebarContainer`, `SidebarHeader` |
| **Media** | `Image`, `Logo` |
| **Theme** | `useColorMode`, `ColorModeProvider` |

### What Comes Directly from `@chakra-ui/react`

**Only** layout primitives and structural elements:

- **Layout:** `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`, `GridItem`
- **Typography:** `Text`, `Heading`
- **Utility:** `Spinner`, `Portal`, `Group`

```tsx
import { Box, Flex, Stack, Text } from '@chakra-ui/react';
```

### Never Do

```tsx
// BAD - interactive component from Chakra directly
import { Button, Badge, Tabs, Menu } from '@chakra-ui/react';

// BAD - relative path instead of barrel
import { Button } from '../ui/button';

// GOOD - always use the barrel import
import { Button, Badge, Tabs, Menu } from '@renderer/components/ui';
```

---

## Theming Rules

All components must be **theme-agnostic** to support future multi-theme/palette switching.

### Style Hierarchy (priority order)

1. **Semantic tokens** - All colors must come from semantic tokens. Never hardcode hex/rgb values.
2. **Recipes** - Reusable component patterns (badge variants, collapsible sections, filter toggles).
3. **`colorPalette` prop** - Use Chakra's `colorPalette` prop (not `color="blue.500"`) when available.
4. **Inline style props** - Only for layout-specific context (spacing, positioning, dimensions).

### Semantic Tokens

All colors use semantic tokens defined in `theme/index.ts`. This enables future multi-theme support.

```tsx
// GOOD - semantic token
<Text color="fg.muted">...</Text>
<Box bg="bg.panel">...</Box>

// BAD - hardcoded color
<Text color="#718096">...</Text>
<Box bg="gray.100">...</Box>
```

Current token categories:
- `bg.*` - Background colors (`bg.panel`, `bg.muted`, `bg.subtle`, `bg.surface`, `bg.success`, `bg.warning`, `bg.error`, `bg.loading`)
- `fg.*` - Foreground/text colors (`fg`, `fg.muted`)
- `border` / `border.muted` - Border colors
- `chart.*` - Chart visualization colors (candle bullish/bearish, MAs, axis, etc.)
- `trading.*` - Trading UI colors:
  - `trading.long` / `trading.short` — direction (LONG/SHORT)
  - `trading.profit` / `trading.loss` — P&L sign
  - `trading.warning` — risky/elevated state (orange `#dd6b20`)
  - `trading.info` — informational (blue `#2563eb`)
  - `trading.neutral` — neutral state
- `accent.solid` - UI accent for active/selected/focused state (brand-blue, `#3182ce`)
- `brand.logo.primary` / `brand.logo.secondary` - Brand-locked logo colors
- `canvas.*` - Canvas rendering colors

### Forbidden patterns (enforced by `scripts/audit-shade-literals.mjs` in CI)

Five patterns the audit rejects automatically. Each entry shows the
**forbidden form** + the **semantic-token alternative**.

#### 1. `shade-literal-color` — static shade literals on JSX props

```tsx
// ❌ Forbidden — raw shade scale on a JSX prop
<Text color="green.500">+$123</Text>
<Box bg="red.50" borderColor="red.500" />

// ✅ Use semantic tokens
<Text color="trading.profit">+$123</Text>
<Box bg="bg.error" borderColor="trading.loss" />
```

#### 2. `_dark-override` — `_dark={{}}` JSX-prop overrides

```tsx
// ❌ Forbidden — manual dark-mode override on a prop
<Box bg="gray.50" _dark={{ bg: 'gray.700' }} />

// ✅ Use semantic tokens (auto-resolve dark/light)
<Box bg="bg.muted" />
```

#### 3. `_dark-override-nested` — same anti-pattern inside object literals

```tsx
// ❌ Forbidden — nested _dark in _hover (or any style object)
<MenuItem _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }} />

// ✅ Single semantic token, dark/light resolves automatically
<MenuItem _hover={{ bg: 'bg.muted' }} />
```

#### 4. `tinted-card-Box` — colored-bg + colored-border container

```tsx
// ❌ Forbidden — heavy "tinted card" wrapper around content
<Box bg="green.subtle" borderColor="green.muted" borderWidth={1}>
  <Stack>...</Stack>
</Box>

// ✅ Inline messages → <Callout tone="success" compact>
//    Content groups → plain Stack/Box (no tint) inside the parent panel
<Callout tone="success" compact>...</Callout>
```

#### 5. `dynamic-shade-pair` — both `green.NNN` AND `red.NNN` in a JSX expression

```tsx
// ❌ Forbidden — bidirectional shade literals (LONG/SHORT, P&L, etc.)
<Text color={isLong ? 'green.500' : 'red.500'}>{side}</Text>
<Box borderColor={isProfit ? 'green.500' : 'red.500'} />

// ✅ Map to the matching semantic-token pair
<Text color={isLong ? 'trading.long' : 'trading.short'}>{side}</Text>
<Box borderColor={isProfit ? 'trading.profit' : 'trading.loss'} />
```

> Single-shade dynamic uses (`'orange.500' : 'fg.muted'`, `'blue.500' : 'fg.muted'`)
> are intentionally not flagged — those are usually UI accents (active state,
> warning highlight) and have a different migration path:
> `'blue.500'` → `'accent.solid'`, `'orange.500'` → `'trading.warning'`,
> `'green.500'` (alone) → `'trading.profit'` etc.

### Wrapper Components and Theming

Components in `ui/` must:
- Receive colors from Chakra's token system, never define their own palette
- Use `colorPalette` prop for color variants
- Use `variant` prop for visual variants
- Never hardcode colors — delegate to the theme layer

---

## Component Catalog

### ToggleIconButton

Toggle button for toolbar/control bar actions. Replaces the verbose `IconButton` + conditional `colorPalette`/`variant` pattern.

```tsx
import { ToggleIconButton } from '@renderer/components/ui';

<ToggleIconButton
  active={showVolume}
  aria-label={t('chart.controls.volume')}
  onClick={toggleVolume}
  size="2xs"
>
  <LuBarChart2 />
</ToggleIconButton>
```

### Button / IconButton

```tsx
import { Button, IconButton } from '@renderer/components/ui';

<Button>Click me</Button>
<Button loading loadingText="Saving...">Save</Button>
<Button variant="outline" colorPalette="blue">Outline</Button>
<IconButton aria-label="Settings" size="sm"><LuSettings /></IconButton>
```

### Input / NumberInput / PasswordInput / Textarea

```tsx
import { Input, NumberInput, PasswordInput, Textarea } from '@renderer/components/ui';

<Input placeholder="Type something..." />
<NumberInput min={0} max={100} value={value} onChange={handleChange} />
<PasswordInput placeholder="Enter password" />
<Textarea placeholder="Description..." />
```

### Select

```tsx
import { Select, type SelectOption } from '@renderer/components/ui';

const options: SelectOption[] = [
  { value: 'btc', label: 'Bitcoin', description: 'BTC' },
];

<Select value={selected} options={options} onChange={setSelected} enableSearch />
```

### Slider / Switch / Checkbox / Radio

```tsx
import { Slider, Switch, Checkbox, Radio, RadioGroup } from '@renderer/components/ui';

<Slider value={[50]} onValueChange={(v) => setValue(v[0])} min={0} max={100} />
<Switch checked={value} onCheckedChange={setValue} />
<Checkbox checked={value} onCheckedChange={setValue}>Label</Checkbox>
<RadioGroup value={value} onValueChange={onChange}>
  <Radio value="a">Option A</Radio>
</RadioGroup>
```

### Badge

```tsx
import { Badge } from '@renderer/components/ui';

<Badge>Default</Badge>
<Badge colorPalette="green">Active</Badge>
```

### Tabs

```tsx
import { Tabs } from '@renderer/components/ui';

<Tabs.Root defaultValue="tab1">
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Content value="tab1">Content 1</Tabs.Content>
</Tabs.Root>
```

### Table

```tsx
import { Table } from '@renderer/components/ui';

<Table.Root>
  <Table.Header>
    <Table.Row><Table.ColumnHeader>Name</Table.ColumnHeader></Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row><Table.Cell>BTC</Table.Cell></Table.Row>
  </Table.Body>
</Table.Root>
```

### Menu

```tsx
import { Menu } from '@renderer/components/ui';

<Menu.Root>
  <Menu.Trigger asChild><Button>Open</Button></Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="edit">Edit</Menu.Item>
      <Menu.Item value="delete">Delete</Menu.Item>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

### Dialog / FormDialog / ConfirmationDialog

```tsx
import { Dialog } from '@renderer/components/ui';

<Dialog.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
  <Dialog.Backdrop />
  <Dialog.Positioner>
    <Dialog.Content>
      <Dialog.Header><Dialog.Title>Title</Dialog.Title></Dialog.Header>
      <Dialog.CloseTrigger />
      <Dialog.Body>Content</Dialog.Body>
      <Dialog.Footer>
        <Dialog.ActionTrigger asChild><Button variant="outline">Cancel</Button></Dialog.ActionTrigger>
        <Button colorPalette="blue">Save</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Positioner>
</Dialog.Root>
```

### CollapsibleSection

```tsx
import { CollapsibleSection } from '@renderer/components/ui';

<CollapsibleSection
  title={t('section.title')}
  description={t('section.description')}
  open={isExpanded}
  onOpenChange={onToggle}
  size="lg"
>
  <Stack gap={6}>{content}</Stack>
</CollapsibleSection>
```

### Progress

```tsx
import { ProgressRoot, ProgressBar } from '@renderer/components/ui';

<ProgressRoot value={75} colorPalette="blue">
  <ProgressBar />
</ProgressRoot>
```

### Alert / Skeleton / Image / Link / CloseButton

Passthrough wrappers — same API as Chakra but imported from `ui/`:

```tsx
import { Alert, Skeleton, Image, Link, CloseButton } from '@renderer/components/ui';
```

### Field

```tsx
import { Field } from '@renderer/components/ui';

<Field label="Email" helperText="We'll never share your email">
  <Input type="email" />
</Field>
```

### TooltipWrapper

```tsx
import { TooltipWrapper } from '@renderer/components/ui';

<TooltipWrapper label="Tooltip text">
  <Button>Hover me</Button>
</TooltipWrapper>
```

---

## Theme Recipes

Recipes are defined in `theme/index.ts` and provide consistent styling for common patterns.

### badge (recipe)

Variants: `interval`, `futures`, `spot`, `count`, `active`, `autoRotation`

```tsx
import { useRecipe } from '@chakra-ui/react';
import { badgeRecipe } from '@renderer/theme';

const badge = useRecipe({ recipe: badgeRecipe });
<Box css={badge({ variant: 'interval' })}>{interval}</Box>
```

### collapsibleSection (slot recipe)

Consumed internally by `CollapsibleSection`. Slots: `root`, `trigger`, `title`, `description`, `content`.

### filterToggle (slot recipe)

Consumed internally by `FilterToggle`. Slots: `root`, `label`, `description`.

### When to Create a New Recipe

If you find yourself copying the same set of style props across 3+ components, extract it into a recipe.

---

## Creating a New Wrapper Component

Follow the established pattern:

```tsx
import type { BadgeProps as ChakraBadgeProps } from '@chakra-ui/react';
import { Badge as ChakraBadge } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface BadgeProps extends ChakraBadgeProps {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {
  return <ChakraBadge ref={ref} {...props} />;
});

Badge.displayName = 'Badge';
```

After creating:
1. Export from `ui/index.ts`
2. Add to this guide's component catalog
3. Update `ui/README.md`

---

## Compact-style tokens (`MM`)

> Source: `apps/electron/src/renderer/theme/tokens.ts` — added in v1.1 Phase 2.1.

The MarketMind compact style is captured as TS constants under the `MM` namespace. Primitives (`Callout`, `FormSection`, `FormRow`, `typography`) consume tokens directly — no hardcoded literals.

### Spacing

| Token | Chakra value | Pixels | Use |
|---|---|---|---|
| `MM.spacing.section.gap` | `4` | 16px | Between sections in dialogs/tabs |
| `MM.spacing.row.gap` | `2.5` | 10px | Between rows in a section |
| `MM.spacing.inline.gap` | `1.5` | 6px | Inline groups (icon + label) |
| `MM.spacing.inlineTight.gap` | `1` | 4px | Compact callout body |
| `MM.spacing.dialogPadding` | `3` | 12px | Dialog body padding |
| `MM.spacing.sectionPadding` | `2.5` | 10px | Section content padding |
| `MM.spacing.calloutCompact` | `{ px: 2.5, py: 1.5 }` | 10×6px | Callout `compact` mode |
| `MM.spacing.callout` | `{ px: 3, py: 2.5 }` | 12×10px | Callout default mode |

### Typography

| Token | Size / Weight | Use |
|---|---|---|
| `MM.font.pageTitle` | `lg` / `bold` | Page heading |
| `MM.font.sectionTitle` | `sm` / `semibold` | Section heading (FormSection) |
| `MM.font.subsection` | `2xs` / `bold` uppercase | Eyebrow / rail group label |
| `MM.font.body` | `xs` / `normal` | Body text, descriptions |
| `MM.font.hint` | `2xs` / `normal` | Helper / hint / meta |

### Line-heights

| Token | Value | Use |
|---|---|---|
| `MM.lineHeight.title` | `1.2` | Headings |
| `MM.lineHeight.body` | `1.45` | Body text |
| `MM.lineHeight.hint` | `1.4` | Hints / meta |

### Buttons + radius + previews

| Token | Value | Use |
|---|---|---|
| `MM.buttonSize.primary` | `xs` | Primary action buttons |
| `MM.buttonSize.secondary` | `2xs` | Secondary / row action buttons |
| `MM.buttonSize.nav` | `2xs` | Pagination / prev-next nav buttons |
| `MM.borderRadius.badge` | `sm` (2px) | Badges |
| `MM.borderRadius.card` | `md` (4px) | Callouts, cards |
| `MM.preview.sm` | `48` (px) | Small avatar |
| `MM.preview.md` | `64` (px) | Profile avatar |

### Spinners

| Token | Value | Use |
|---|---|---|
| `MM.spinner.panel` | `{ size: 'md', py: 6 }` | Dashboard panel loading state |
| `MM.spinner.inline` | `{ size: 'sm', py: 0 }` | Inline next-to-text loading |

## Panel header pattern

For dashboard-style panels (analytics modal, stats sections) that need a visible separation between the title and the body, use `<PanelHeader>`:

```tsx
import { PanelHeader, Stack } from '@renderer/components/ui';

<Stack gap={3}>
  <PanelHeader
    title={t('panel.title')}
    description={t('panel.description')}  // optional
    action={<NavButtons />}                // optional period selector / prev-next
  />
  {/* panel body */}
</Stack>
```

What it provides:
- Title at `MM.font.sectionTitle` (sm / semibold)
- Optional description at `MM.font.hint` muted
- `pb={2}` + `borderBottomWidth="1px" borderColor="border"` separator
- Right-side `action` slot for period selectors, prev/next, etc.
- `align` flips between `flex-start` (with description) and `center` (title-only)
- Wraps on narrow widths

`PanelHeader` vs. `FormSection`:
- **`FormSection`** is for form/settings groups. **No border**.
- **`PanelHeader`** is for dashboard panels showing data. **Has bottom border**.
- Share the same title typography.

**Applied surfaces (as of v1.2):** `Trading/PerformancePanel`, `Trading/SetupStatsTable`, `Analytics/PerformanceCalendar`, `Analytics/EquityCurveChart`. New analytics-style panels should follow this pattern.

### Usage

```tsx
import { MM } from '@renderer/theme/tokens';
import { Stack } from '@chakra-ui/react';
import { FormSection, FormRow, Switch } from '@renderer/components/ui';

<Stack gap={MM.spacing.section.gap}>  {/* 16px */}
  <FormSection title="Title">
    <FormRow label="Label" helper="Help text">
      <Switch ... />
    </FormRow>
  </FormSection>
</Stack>
```

**Don't** hardcode literals where a token exists. If a value needs to change, change the token — primitives pick it up automatically.

---

## EmptyState pattern

`<EmptyState>` is the canonical empty-state primitive. Used in 8 surfaces as of v1.2.

### Usage

```tsx
import { EmptyState } from '@renderer/components/ui';

// Inline — for surfaces with their own card framing
<EmptyState size="sm" title={t('common.noData')} />

// Dashed — for surfaces without surrounding card; wraps content in dashed-border box
<EmptyState
  dashed
  title={t('tradingProfiles.watchers.empty')}
  action={{ label: t('tradingProfiles.watchers.addFirst'), onClick: handleAdd }}
/>
```

### Props
- `title` (required) — the headline copy
- `description` — optional secondary copy
- `action` — `{ label, onClick, colorPalette? }` for an outline button below
- `icon` — defaults to `LuInbox`; pass any `react-icons` component
- `size` — `'sm' | 'md' | 'lg'` (default `md`); use `sm` in compact contexts (sidebars, inline)
- `dashed` — wraps in a dashed-border box for surfaces without their own card

### Don't
- Hand-roll `<Box p={N} textAlign="center"><Text color="fg.muted">No data</Text></Box>` patterns. Use EmptyState.
- Stack EmptyState inside another card with its own border — pick one framing.

---

## Color tokens

As of v1.2, `apps/electron/src/renderer/components/` contains **0** hardcoded shade literals (`color="X.500"`, `bg="X.50"`, `borderColor="X.500"`, etc.) and **0** `_dark={{}}` overrides. Every color flows through one of these semantic tokens:

| Token | Use |
|-------|-----|
| `X.fg` | Foreground text/icon for color X (resolves to `.500` light / `.300` dark approx) |
| `X.subtle` | Background tone-on-tone for X (resolves to `.50` light / `.900` dark) |
| `X.muted` | Border or secondary text for X |
| `X.solid` | Solid fill — status dots, badges with strong tone |
| `bg.panel` | Card-style panel background (Card primitive default) |
| `bg.muted` | Subtle muted background — section panels |
| `bg.subtle` | Even more muted — hover states |
| `fg.muted` | Muted text (description, helper, captions) |
| `trading.profit` | PnL gain — prefer over generic `green.fg` for trade values |
| `trading.loss` | PnL loss — prefer over generic `red.fg` for trade values |

Adding a new shade literal in `renderer/components/` is caught by `pnpm lint:shades` (`scripts/audit-shade-literals.mjs`) and gated in CI. Always prefer a semantic token; if the design needs a new tone, add it to `theme/semanticTokens.ts` first.

### WCAG AA contrast (v1.3 F.1)

The text-on-bg pairs below clear the WCAG AA 4.5:1 floor for body text:

| Pair | Light | Dark |
|---|---|---|
| `fg.muted` over `bg.muted` | 5.16:1 ✓ | 5.00:1 ✓ |
| `fg.muted` over `bg.panel` | 5.83:1 ✓ | 11.1:1 ✓ |
| `fg` over `bg.panel` | 16.5:1 ✓ | 16.0:1 ✓ |

The `trading.profit / .loss / .warning / .info` tokens render below 4.5:1 in some pairings but consistently pass the 3:1 floor for **bold** or **large** text (WCAG AA's relaxed criterion), which matches how these tokens are used in the codebase (PnL values, status pills — always semibold or larger). If a new use site renders these tokens at body size + normal weight, prefer `green.fg / red.fg / yellow.fg / blue.fg` instead.

Borders (`border` token) intentionally fall below 3:1 against `bg.panel` — they're structural, not informational, and 3:1 borders read as "boxed-in" instead of "subtle".

---

## File References

- Theme definition: `apps/electron/src/renderer/theme/index.ts`
- **Design tokens: `apps/electron/src/renderer/theme/tokens.ts`** ← v1.1
- Component library: `apps/electron/src/renderer/components/ui/`
- Component library barrel: `apps/electron/src/renderer/components/ui/index.ts`
- Component library docs: `apps/electron/src/renderer/components/ui/README.md`
- Compact-style design language: `docs/V1_POST_RELEASE_PLAN.md` § Design language
- Extraction migration plan: `packages/ui/MIGRATION.md` ← v1.1
- Standardization plan (legacy, superseded): `docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`
- CLAUDE.md: AI assistant context with UI standards section
