# Chart Drawing Toolbar Icons

Custom SVG icon components for the MarketMind chart drawing toolbar, designed to match the Lucide icon style.

## Lucide Style Guide

All icons in this directory follow the Lucide design system to ensure visual consistency with the rest of the application.

### SVG Attributes

| Attribute       | Value          |
|-----------------|----------------|
| viewBox         | `0 0 24 24`    |
| width           | `1em`          |
| height          | `1em`          |
| fill            | `none`         |
| stroke          | `currentColor` |
| strokeWidth     | `2`            |
| strokeLinecap   | `round`        |
| strokeLinejoin  | `round`        |

### Design Constraints

- **Content area**: Keep all paths and shapes within the 2-22 coordinate range (1px padding from each edge of the 24x24 grid).
- **Element count**: Aim for 4-6 path/line/shape elements maximum per icon to maintain clarity at small sizes (16-20px).
- **Strokes only**: No filled shapes, gradients, or shadows. Use `stroke="currentColor"` exclusively.
- **Clean geometry**: Prefer straight lines, simple arcs, and basic geometric primitives. Avoid complex bezier curves.
- **Minimalist**: Each icon should communicate its tool's purpose with the fewest possible elements.

## Component Pattern

Every icon file exports a single named component that accepts standard SVG props:

```tsx
import type { SVGProps } from 'react';

export const ExampleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="4" y1="4" x2="20" y2="20" />
  </svg>
);
```

The `{...props}` spread on the `<svg>` element allows consumers to override any attribute (size, color, className, etc.).

## File Naming

- One component per file.
- File name matches the exported component name in PascalCase: `FibonacciIcon.tsx` exports `FibonacciIcon`.
- All icons are re-exported from `index.ts`.

## Importing Icons

Always import from the barrel file:

```tsx
import { LineIcon, FibonacciIcon, PitchforkIcon } from '@renderer/components/icons';
```

## Available Icons (19)

| Icon                | File                    | Description                                          |
|---------------------|-------------------------|------------------------------------------------------|
| `PencilIcon`        | `PencilIcon.tsx`        | Pencil for freehand drawing                          |
| `LineIcon`          | `LineIcon.tsx`          | Simple diagonal line segment                         |
| `HorizontalLineIcon`| `HorizontalLineIcon.tsx`| Horizontal line with end marks                      |
| `VerticalLineIcon`  | `VerticalLineIcon.tsx`  | Vertical line with end marks                        |
| `ArrowIcon`         | `ArrowIcon.tsx`         | Diagonal line with arrowhead                         |
| `RayIcon`           | `RayIcon.tsx`           | Line with origin dot and extending arrowhead         |
| `TrendLineIcon`     | `TrendLineIcon.tsx`     | Line extending beyond both endpoints                 |
| `ChannelIcon`       | `ChannelIcon.tsx`       | Two parallel diagonal lines                          |
| `TextIcon`          | `TextIcon.tsx`          | Letter T for text annotation                         |
| `RectangleIcon`     | `RectangleIcon.tsx`     | Simple rectangle outline                             |
| `EllipseIcon`       | `EllipseIcon.tsx`       | Oval/ellipse shape                                   |
| `FibonacciIcon`     | `FibonacciIcon.tsx`     | Right triangle with horizontal retracement lines     |
| `RulerIcon`         | `RulerIcon.tsx`         | Diagonal ruler with tick marks                       |
| `AreaIcon`          | `AreaIcon.tsx`          | Dashed rectangle with corner scan marks              |
| `PriceRangeIcon`    | `PriceRangeIcon.tsx`    | Two horizontal lines with vertical bracket/arrows    |
| `AnchoredVwapIcon`  | `AnchoredVwapIcon.tsx`  | Anchor pin with a curved line extending right        |
| `HighlighterIcon`   | `HighlighterIcon.tsx`   | Thick marker pen at an angle                         |
| `PitchforkIcon`     | `PitchforkIcon.tsx`     | Three-pronged fork from apex                         |
| `GannFanIcon`       | `GannFanIcon.tsx`       | Multiple lines radiating from a corner               |

## Adding a New Icon

1. Create `NewIconName.tsx` following the component pattern above.
2. Export it from `index.ts`: `export { NewIconName } from './NewIconName';`
3. Update the table in this README.
4. Verify it renders clearly at 16px and 20px sizes.
