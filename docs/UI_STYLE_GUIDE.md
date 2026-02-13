# UI Style Guide - MarketMind

Central reference for UI standardization across the MarketMind application.

> **Living Document:** This guide must be updated whenever components are created, modified, or deprecated. Keep it in sync with the actual codebase.

## Import Rules

### Custom Components (from `@/renderer/components/ui/`)

Always import interactive and composite components from the custom library:

`Button`, `Input`, `NumberInput`, `PasswordInput`, `Select`, `Slider`, `Switch`, `Checkbox`, `Radio`/`RadioGroup`, `Field`, `CollapsibleSection`, `Dialog`/`FormDialog`/`ConfirmationDialog`, `Tabs`, `Tooltip` (`TooltipWrapper`), `Popover`, `Table`, `Card`

```tsx
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
```

### Chakra UI Direct (from `@chakra-ui/react`)

Layout primitives and simple visual elements:

- **Layout:** `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`
- **Typography:** `Text`
- **Visual:** `Separator`, `Badge`, `Spinner`, `Portal`
- **Menu:** `MenuRoot`, `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuPositioner`
- **Other:** `IconButton`, `Group`, `Collapsible`

```tsx
import { Box, Flex, Stack, Text, Separator } from '@chakra-ui/react';
```

### Never Do

```tsx
// BAD - importing Button from Chakra directly
import { Button } from '@chakra-ui/react';

// GOOD - importing from custom library
import { Button } from '@renderer/components/ui/button';
```

---

## Style Hierarchy

Apply styles in this priority order:

1. **Semantic tokens** - All colors must come from semantic tokens. Never hardcode color values.
2. **Recipes** - Reusable component patterns (badge variants, collapsible sections, filter toggles).
3. **Props** - Component variant props (`size`, `variant`, `colorPalette`).
4. **Inline styles** - Only for layout-specific context (spacing, positioning, dimensions).

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

### Recipes

Use theme recipes for repeated component patterns. Recipes are defined in `theme/index.ts` under `recipes` and `slotRecipes`.

Available recipes:

- `badge` - Status/category badges with variants: `interval`, `futures`, `spot`, `count`
- `collapsibleSection` (slot recipe) - Expandable sections with slots: `trigger`, `title`, `description`, `content`
- `filterToggle` (slot recipe) - Toggle switches with labels and descriptions

### When to Create a New Recipe

If you find yourself copying the same set of style props across 3+ components, extract it into a recipe.

---

## Component Patterns

### Collapsible Sections

Use `CollapsibleSection` from the UI library for all expandable sections.

```tsx
// Controlled mode (parent manages state)
<CollapsibleSection
  title={t('section.title')}
  description={t('section.description')}
  open={isExpanded}
  onOpenChange={onToggle}
  size="lg"
>
  <Stack gap={6}>{content}</Stack>
</CollapsibleSection>

// Uncontrolled mode (internal state)
<CollapsibleSection
  title="Settings"
  defaultOpen={false}
  size="md"
>
  {content}
</CollapsibleSection>
```

### Filter Toggles

Use `FilterToggle` for boolean configuration switches with label and description.

```tsx
<FilterToggle
  label={t('filter.title')}
  description={t('filter.description')}
  checked={value}
  onChange={onChange}
  disabled={isPending}
  tag="Futures"
  tagColorPalette="purple"
/>
```

### Badges

Use the badge recipe variants for consistent badge styling.

```tsx
// Interval badge
<Box css={badgeRecipe({ variant: 'interval' })}>{interval}</Box>

// Market type badge
<Box css={badgeRecipe({ variant: marketType === 'FUTURES' ? 'futures' : 'spot' })}>
  {marketType}
</Box>
```

---

## Theme Preparation for Multiple Palettes

All visual styling flows through semantic tokens. To add a new theme:

1. Define new token values in `theme/index.ts`
2. Recipes automatically adapt via token references
3. No component changes needed

Current token categories:
- `bg.*` - Background colors
- `fg.*` - Foreground/text colors
- `border` - Border colors
- `chart.*` - Chart visualization colors
- `trading.*` - Trading UI colors (profit/loss/long/short)
- `canvas.*` - Canvas rendering colors

---

## File References

- Theme definition: `apps/electron/src/renderer/theme/index.ts`
- Component library: `apps/electron/src/renderer/components/ui/`
- Component library docs: `apps/electron/src/renderer/components/ui/README.md`
- CLAUDE.md: AI assistant context with UI standards section
