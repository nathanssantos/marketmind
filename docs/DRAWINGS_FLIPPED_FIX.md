# Drawings × flipped chart — investigation + fix plan

**Status:** plan-only.
**Last updated:** 2026-05-10.
**Task:** #508.

## The bug

With `chartFlipped: true` (chart preference, inverts the y-axis so price grows
downward — useful for short-bias analysis), drawing primitives render at the
wrong y-position. Visible symptom: rectangles, fib retracements, channels,
position boxes, etc. **overlap parts of the candles** instead of sitting where
the user placed them. Candle rendering is correct; only the drawing layer is
off.

## Likely root cause

`CanvasManager` has `setFlipped(bool)` and `priceToY` already accounts for the
flip — that's why candles render correctly. But the drawings pipeline doesn't
use `manager.priceToY` directly; it uses a custom mapper (`mapper`) passed into
each renderer (`renderLine`, `renderRectangle`, `renderFibonacci`, etc.). That
mapper is likely built without consulting `manager.isFlipped()`, so it returns
non-flipped y values even when the chart is flipped.

Quick check (suspected smoking gun):

```bash
grep -rn "priceToY\|mapper\.priceToY\|createMapper" \
  apps/electron/src/renderer/components/Chart/drawings/ | head
```

Look at how `mapper` is constructed and whether it threads `flipped` through.

## Investigation steps

1. **Reproduce locally** — open the app, draw a rectangle, toggle Settings →
   chart flip, confirm the rectangle moves off the candles. Capture before/after
   coordinates (left/top via DevTools) for one drawing on one symbol — gives a
   concrete delta to verify the fix against.
2. **Trace the mapper** — `useDrawingsRenderer.ts` and the per-shape renderers
   under `drawings/renderers/` (or wherever they live). Find where the mapper
   is created and where it computes `y`. Compare to how candle rendering does
   it.
3. **Confirm the math** — when flipped, the price-to-y formula should mirror
   around the chart's vertical midline:
   `y = flipped ? (chartHeight - normalY) : normalY` (roughly — check what
   `CanvasManager.priceToY` does and copy that semantics exactly).
4. **Identify all affected shapes** — every renderer that draws on the y-axis
   needs the fix. Likely list:
   - Line / Ray / Trend Line / Horizontal Line
   - Rectangle / Area / Channel
   - Fibonacci (levels are y-bound)
   - Pencil / Highlighter (points have y)
   - Position (entry / SL / TP horizontal lines)
   - Pitchfork, Gann Fan, Ellipse, Price Range, Vertical Line (vertical-only —
     unaffected, but verify)
5. **Hit-testing** — if the renderer math is fixed, hit-testing must follow
   (selecting a drawing on a flipped chart should still click where it visually
   sits). Check `hitTest` in chart-studies for the same flip blind spot.
6. **Snap indicators** — OHLC snap markers when drawing also use coordinates
   relative to the chart. They likely have the same bug.

## Implementation strategy

Two clean options:

**Option A — fix at the mapper boundary.** Have whatever builds the mapper
read `manager.isFlipped()` and either:
- Return a `priceToY` that already flips when needed, or
- Wrap the existing mapper in a thin "flipped-aware" decorator.

Pros: single source of truth — every renderer downstream gets it for free.
Cons: hit-testing might need a corresponding tweak (it consumes the same
mapper or computes y from rect.top).

**Option B — fix per-renderer.** Each renderer reads `flipped` from a context
prop and applies the flip inline.

Pros: localized changes.
Cons: 14+ renderers to touch, easy to miss one, behaves like every other
"flag-driven branch through render code" we've cleaned up before.

**Recommend Option A** — single mapper change, single hit-test change. ~30
lines + tests.

## Test plan

- Unit: synthesize a mapper with `flipped: true` and assert `priceToY(p)` returns
  the mirrored y for several p values.
- Visual / manual: every drawing kind in the toolbar — place on normal chart,
  flip, confirm visual position is stable relative to the candle it's attached
  to.
- Hit-test: select each drawing on a flipped chart; verify the handle hit-test
  still works at the correct screen position.

## Out of scope

- Drawings persisted with old `flipped` state — drawings are stored with
  `startPrice / startIndex` semantics (price-space), not screen-space, so
  existing saved drawings should "just work" once the mapper is fixed. No
  migration needed.
- The `flipped` toggle itself — unchanged.
