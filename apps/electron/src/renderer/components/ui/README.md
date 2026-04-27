# UI Components (`@renderer/components/ui`)

> **Living Document:** Update this file whenever components are created, modified, or deprecated.

Single source of truth for all reusable UI components. Designed for future extraction into `@marketmind/ui`.

## Import Rule

Always use the barrel import:

```tsx
import { Button, IconButton, Badge, Switch, Tabs } from '@renderer/components/ui';
```

Never import interactive components directly from `@chakra-ui/react`. Only layout primitives (`Box`, `Flex`, `Stack`, `Text`, `Grid`, `Spinner`, `Portal`) come from Chakra directly.

See `docs/UI_STYLE_GUIDE.md` for the full import rules and style hierarchy.

## Component Catalog

### Buttons

| Component | Description |
|-----------|-------------|
| `Button` | Button with loading, variant, size, colorPalette support |
| `IconButton` | Icon-only button |
| `ToggleIconButton` | Toggle button for toolbars (`active` prop controls `variant`/`colorPalette`) |
| `CloseButton` | Close/dismiss button |

### Form Inputs

| Component | Description |
|-----------|-------------|
| `Input` | Text input (default `px={3}`) |
| `NumberInput` | Numeric input with min/max/step |
| `PasswordInput` | Password with show/hide toggle |
| `Textarea` | Multi-line text input |
| `Select` | Custom select with search, loading, sections |
| `Slider` | Range slider |
| `Switch` | Toggle switch |
| `Checkbox` | Checkbox |
| `Radio` / `RadioGroup` | Radio button group |
| `ColorPicker` | Hex color picker with preset swatches + custom hex input (`DEFAULT_COLOR_PRESETS` export) |
| `Field` | Input wrapper with label, helper, error text |

### Data Display

| Component | Description |
|-----------|-------------|
| `Badge` | Status/category badge |
| `Card` | Card container (`Card.Root`, `Card.Header`, `Card.Body`) |
| `Table` | Data table (`Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.ColumnHeader`, `Table.Cell`) |
| `Stat` / `StatRow` | Statistic display |
| `PnLDisplay` | Profit/loss colored display |
| `MetricCard` | Metric card with label/value |
| `CryptoIcon` | Cryptocurrency icon |

### Feedback

| Component | Description |
|-----------|-------------|
| `Alert` | Alert/notification banner (Chakra-based, multi-part API) |
| `Callout` | **Compact toned banner** — single component, `tone="info"\|"success"\|"warning"\|"danger"\|"neutral"`, optional `title` + body, `compact` prop. Prefer this over `Alert` for inline contextual messages in dialogs and tabs. |
| `Skeleton` | Loading placeholder |
| `ProgressRoot` / `ProgressBar` | Progress indicator |
| `LoadingSpinner` | Spinner with optional label |
| `ErrorMessage` | Error display |
| `EmptyState` | Empty state placeholder |

### Navigation

| Component | Description |
|-----------|-------------|
| `Tabs` | Tab system (`Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`, `Tabs.Indicator`) |
| `Menu` | Dropdown menu (`Menu.Root`, `Menu.Trigger`, `Menu.Positioner`, `Menu.Content`, `Menu.Item`) |
| `Link` | Anchor/link element |

### Overlay

| Component | Description |
|-----------|-------------|
| `Dialog` | Modal dialog (compound: `Root`, `Backdrop`, `Positioner`, `Content`, `Header`, `Title`, `Body`, `Footer`, `CloseTrigger`, `ActionTrigger`) |
| `FormDialog` | Form-specific dialog |
| `ConfirmationDialog` | Confirm/cancel dialog |
| `Popover` | Popover overlay |
| `TooltipWrapper` | Tooltip on hover |

### Layout

| Component | Description |
|-----------|-------------|
| `FormSection` | **Standard form section** — header (title / description / optional action) + content stack. Use for all section blocks in dialogs and settings tabs. |
| `FormRow` | **Standard form row** — left label + helper, right control + optional action. Use for switch/select rows where label/control are inline. |
| `CollapsibleSection` | Expandable section with title, badge, header action. New `variant="static"` renders without chevron (always-open) — use for non-accordion contexts (default `"collapsible"` keeps backwards-compat). |
| `Separator` | Visual divider |
| `SidebarContainer` / `SidebarHeader` | Sidebar layout components |

### Typography

| Component | Description |
|-----------|-------------|
| `PageTitle` | Page heading (`fontSize="lg"`, bold) |
| `SectionTitle` | Section heading (`fontSize="sm"`, semibold) — already provided by `FormSection` |
| `SubsectionTitle` | Eyebrow heading (`fontSize="2xs"`, uppercase, muted) — for rail/group labels |
| `SectionDescription` | Section helper text (`fontSize="xs"`, muted) — already provided by `FormSection` |
| `FieldHint` | Inline field helper (`fontSize="2xs"`, muted) |
| `MetaText` | Tertiary metadata (`fontSize="2xs"`, muted) |

### Media & Theme

| Component | Description |
|-----------|-------------|
| `Image` | Image element |
| `Logo` | App logo |
| `useColorMode` / `ColorModeProvider` | Theme mode management |

## Theming

All components follow Chakra's theming system:
- Colors via **semantic tokens** (never hardcoded)
- Variants via **`colorPalette`** prop
- Repeated patterns via **theme recipes**

### Available Recipes

| Recipe | Type | Variants |
|--------|------|----------|
| `badge` | recipe | `interval`, `futures`, `spot`, `count`, `active`, `autoRotation` |
| `collapsibleSection` | slot recipe | `root`, `trigger`, `title`, `description`, `content` |
| `filterToggle` | slot recipe | `root`, `label`, `description` |

## Creating a New Wrapper

```tsx
import type { XProps as ChakraXProps } from '@chakra-ui/react';
import { X as ChakraX } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface XProps extends ChakraXProps {}

export const X = forwardRef<HTMLElement, XProps>((props, ref) => {
  return <ChakraX ref={ref} {...props} />;
});

X.displayName = 'X';
```

After creating: export from `index.ts`, update this file, update `docs/UI_STYLE_GUIDE.md`.

## References

- [Chakra UI v3 Docs](https://www.chakra-ui.com/docs/components)
- Style Guide: `docs/UI_STYLE_GUIDE.md`
- Theme: `src/renderer/theme/index.ts`
- Standardization Plan: `docs/UI_COMPONENTS_STANDARDIZATION_PLAN.md`
