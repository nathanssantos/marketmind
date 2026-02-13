# UI Components

> **Living Document:** Update this file whenever components are created, modified, or deprecated.

Reusable components based on Chakra UI v3 with consistent default configuration.

## Import Rules

Always import interactive/composite components from this library, not from `@chakra-ui/react` directly.

```tsx
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
```

See `docs/UI_STYLE_GUIDE.md` for the full import rules and style hierarchy.

## Available Components

### Button

Button with loading, variant, and size support.

```tsx
import { Button } from '@renderer/components/ui/button';

<Button>Click me</Button>
<Button loading loadingText="Saving...">Save</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button size="xs" | "sm" | "md" | "lg">Sized</Button>
<Button colorPalette="blue" | "green" | "red">Colored</Button>
```

### Input

Text input with default padding (px={3}).

```tsx
import { Input } from '@renderer/components/ui/input';

<Input placeholder="Type something..." />
<Input variant="outline" | "subtle" | "flushed" />
<Input size="xs" | "sm" | "md" | "lg" />
```

### PasswordInput

Password input with show/hide toggle button.

```tsx
import { PasswordInput } from '@renderer/components/ui/password-input';

<PasswordInput placeholder="Enter password" />
```

### NumberInput

Numeric input with min/max/step validation.

```tsx
import { NumberInput } from '@renderer/components/ui/number-input';

<NumberInput min={0} max={100} value={value} onChange={handleChange} />
```

### Select

Custom select with search, loading, and section support.

```tsx
import { Select, type SelectOption } from '@renderer/components/ui/Select';

const options: SelectOption[] = [
  { value: 'btc', label: 'Bitcoin', description: 'BTC' },
];

<Select value={selected} options={options} onChange={setSelected} enableSearch />
```

### Slider

Range slider component.

```tsx
import { Slider } from '@renderer/components/ui/slider';

<Slider value={[50]} onValueChange={(values) => setValue(values[0])} min={0} max={100} step={1} />
```

### Switch

Toggle switch component.

```tsx
import { Switch } from '@renderer/components/ui/switch';

<Switch checked={value} onCheckedChange={setValue} />
```

### Radio / RadioGroup

Radio button group.

```tsx
import { Radio, RadioGroup } from '@renderer/components/ui/radio';

<RadioGroup value={value} onValueChange={onChange}>
  <Radio value="a">Option A</Radio>
  <Radio value="b">Option B</Radio>
</RadioGroup>
```

### Checkbox

Checkbox component.

```tsx
import { Checkbox } from '@renderer/components/ui/checkbox';

<Checkbox checked={value} onCheckedChange={setValue}>Label</Checkbox>
```

### Field

Wrapper for inputs with label, helper text, and error text.

```tsx
import { Field } from '@renderer/components/ui/field';

<Field label="Email" helperText="We'll never share your email">
  <Input type="email" />
</Field>
```

### CollapsibleSection

Expandable section with title, description, badge, and header action slots. Supports controlled and uncontrolled modes.

**Props:**
- `title` (string) - Section title
- `description?` (string) - Subtitle text
- `open?` (boolean) - Controlled open state
- `onOpenChange?` (fn) - Controlled toggle callback
- `defaultOpen?` (boolean) - Initial state for uncontrolled mode
- `size?` ('sm' | 'md' | 'lg') - Size variant (default: 'md')
- `badge?` (ReactNode) - Badge element next to title
- `headerAction?` (ReactNode) - Action element in header (click doesn't toggle)
- `onToggle?` (fn) - Legacy toggle callback

```tsx
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';

// Controlled mode
<CollapsibleSection
  title={t('section.title')}
  description={t('section.description')}
  open={isExpanded}
  onOpenChange={onToggle}
  size="lg"
>
  <Stack gap={6}>{content}</Stack>
</CollapsibleSection>

// Uncontrolled mode
<CollapsibleSection title="Settings" defaultOpen={false} size="md">
  {content}
</CollapsibleSection>
```

### Dialog / FormDialog / ConfirmationDialog

Modal dialog components.

```tsx
import { Dialog } from '@renderer/components/ui/dialog';

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

### Tabs

Tab system with variants and visual indicator.

```tsx
import { Tabs } from '@renderer/components/ui/tabs';

<Tabs.Root defaultValue="tab1">
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Content value="tab1">Content 1</Tabs.Content>
  <Tabs.Content value="tab2">Content 2</Tabs.Content>
</Tabs.Root>
```

### TooltipWrapper

Tooltip component for hover information.

```tsx
import { TooltipWrapper } from '@renderer/components/ui/tooltip';

<TooltipWrapper label="Tooltip text">
  <Button>Hover me</Button>
</TooltipWrapper>
```

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

Consumed internally by `CollapsibleSection` component. Slots: `root`, `trigger`, `title`, `description`, `content`.

### filterToggle (slot recipe)

Consumed internally by `FilterToggle` component. Slots: `root`, `label`, `description`.

## Chakra UI v3 Direct Imports

These are imported directly from `@chakra-ui/react` (not from the UI library):

- **Layout:** `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`
- **Typography:** `Text`
- **Visual:** `Separator`, `Badge`, `Spinner`, `Portal`
- **Menu:** `MenuRoot`, `MenuTrigger`, `MenuContent`, `MenuItem`
- **Other:** `IconButton`, `Group`, `Collapsible`

## References

- [Chakra UI v3 Docs](https://www.chakra-ui.com/docs/components)
- Style Guide: `docs/UI_STYLE_GUIDE.md`
- Theme: `src/renderer/theme/index.ts`
