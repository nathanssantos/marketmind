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
- `bg.*` - Background colors
- `fg.*` - Foreground/text colors
- `border` - Border colors
- `chart.*` - Chart visualization colors
- `trading.*` - Trading UI colors (profit/loss/long/short)
- `canvas.*` - Canvas rendering colors

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

## File References

- Theme definition: `apps/electron/src/renderer/theme/index.ts`
- Component library: `apps/electron/src/renderer/components/ui/`
- Component library barrel: `apps/electron/src/renderer/components/ui/index.ts`
- Component library docs: `apps/electron/src/renderer/components/ui/README.md`
- Standardization plan: `docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`
- CLAUDE.md: AI assistant context with UI standards section
