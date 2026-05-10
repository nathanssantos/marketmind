# Candle patterns plan

**Status:** plan-only. Implementation lands as a feature-branch PR series.
**Last updated:** 2026-05-10.

A new chart layer that highlights classical candlestick patterns (Hammer, Shooting Star, Engulfing, …) as glyphs above/below the matching candle. Patterns are stored as **data, not code**, so users can register their own patterns from the UI without shipping a release.

---

## Goals

- Render visual markers for ~25 built-in candlestick patterns on the chart.
- Per-panel scoping (matches the layer/indicator scoping landed in #583).
- Layer on/off toggle in the existing Layers popover.
- Dedicated catalog popover next to Indicators, modeled on the same UX.
- Custom-pattern creation from a dialog (mirrors the indicator config flow).
- Detection runs client-side, in real time on the displayed kline window.

## Non-goals

- Auto-trading on detected patterns. The detection layer is **annotation-only** in v1; setups stay in the existing strategy-detection pipeline.
- Pattern backtesting. Could come later but is out of scope.
- Cross-timeframe pattern confluence. Single-timeframe per chart panel.
- Statistical confidence scoring. Patterns are binary "match / no-match" in v1.

---

## Architecture overview

Four loosely-coupled pieces, each ownable independently:

```
┌──────────────────────────────────────────────────────────────────┐
│ packages/trading-core/src/patterns/                              │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ DSL types   │  │ DSL evaluator  │  │ Built-in catalog     │  │
│  │             │  │ (eval.ts)      │  │ (~25 .json defs)     │  │
│  └─────────────┘  └────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            ▲
                            │ pure deps
                            │
┌──────────────────────────────────────────────────────────────────┐
│ apps/backend                                                     │
│  - user_patterns table + router (CRUD, seedDefaultUserPatterns)  │
└──────────────────────────────────────────────────────────────────┘
                            ▲
                            │ tRPC
                            │
┌──────────────────────────────────────────────────────────────────┐
│ apps/electron                                                    │
│  - usePatternStore (per-panel: enabledPatternIdsByPanelId)       │
│  - usePatternMarkers (run detection on visible klines)           │
│  - PatternTogglePopover (wraps generic CatalogTogglePopover)     │
│  - PatternConfigDialog (clone of IndicatorConfigDialog)          │
│  - Renderer: glyph above (bullish) / below (bearish) the bar     │
│  - LayersTogglePopover gains a `candlePatterns` flag             │
└──────────────────────────────────────────────────────────────────┘
```

Two refactors enable reuse:
- **`IndicatorTogglePopoverGeneric` → `CatalogTogglePopover`** — extract a truly generic catalog popover (items + categories + active set + create/edit/delete actions). `IndicatorTogglePopover` becomes a thin wrapper; `PatternTogglePopover` is another wrapper with a different catalog source.
- **`useChartLayerFlags`** gains `candlePatterns: boolean`. The render-pipeline gate is identical to how `setupMarkers` and `orderLines` are gated today.

---

## Pattern DSL

A pattern is a JSON definition over a window of N candles (`b0` is the most recent, `b1` the previous, …). The evaluator returns `true` iff every constraint matches.

### Primitives (per bar)

| Primitive | Definition | Example |
|---|---|---|
| `open(b)`, `high(b)`, `low(b)`, `close(b)` | Raw OHLC | `close(b0)` |
| `body(b)` | `abs(close − open)` | `body(b0)` |
| `range(b)` | `high − low` | `range(b0)` |
| `upperWick(b)` | `high − max(open, close)` | `upperWick(b0)` |
| `lowerWick(b)` | `min(open, close) − low` | `lowerWick(b0)` |
| `topBody(b)` | `max(open, close)` | `topBody(b1)` |
| `bottomBody(b)` | `min(open, close)` | `bottomBody(b1)` |
| `midBody(b)` | `(open + close) / 2` | `midBody(b1)` |
| `direction(b)` | `'up' \| 'down' \| 'flat'` | `direction(b0) = 'up'` |
| `volume(b)` | Bar volume | `volume(b0) > 1.5 * volume(b1)` |

### Operators

| Operator | Use |
|---|---|
| `+ - * /` | Arithmetic on numeric expressions |
| `< <= > >= = !=` | Comparisons |
| `and or not` | Boolean composition (constraints joined `and` by default) |

### Pattern shape

```ts
interface PatternDefinition {
  id: string;                                  // 'hammer'
  label: string;                               // 'Hammer'
  category: 'reversal-single' | 'reversal-multi' | 'continuation' | 'indecision';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  bars: 1 | 2 | 3 | 4 | 5;                    // window size
  /** Optional tunables surfaced in the UI; expressions can reference `params.X`. */
  params: Array<{
    key: string;
    label: string;
    type: 'number';
    default: number;
    min?: number; max?: number; step?: number;
  }>;
  /** All constraints AND-ed together. Each is a boolean expression. */
  constraints: string[];
  /** Optional description for the popover tooltip. */
  description?: string;
}
```

Hammer example:

```json
{
  "id": "hammer",
  "label": "Hammer",
  "category": "reversal-single",
  "sentiment": "bullish",
  "bars": 1,
  "params": [
    { "key": "wickRatio",   "label": "Min lower wick / body", "type": "number", "default": 2.0, "min": 1.0, "max": 4.0, "step": 0.1 },
    { "key": "topWickRatio","label": "Max upper wick / body", "type": "number", "default": 0.3, "min": 0.0, "max": 1.0, "step": 0.05 }
  ],
  "constraints": [
    "body(b0) > 0",
    "lowerWick(b0) >= params.wickRatio * body(b0)",
    "upperWick(b0) <= params.topWickRatio * body(b0)"
  ],
  "description": "Long lower wick, small body near the top, marginal upper wick. Bullish reversal at support."
}
```

Bullish Engulfing:

```json
{
  "id": "bullish-engulfing",
  "label": "Bullish Engulfing",
  "category": "reversal-multi",
  "sentiment": "bullish",
  "bars": 2,
  "params": [],
  "constraints": [
    "direction(b1) = 'down'",
    "direction(b0) = 'up'",
    "open(b0) <= close(b1)",
    "close(b0) >= open(b1)"
  ]
}
```

### Evaluator

A small recursive-descent parser (~150 LOC) tokenizes and parses each constraint string into an AST once at load time. The runtime evaluator walks the AST against `bars[]` + `params`. No `eval`, no sandbox needed — every leaf is a known primitive or numeric literal, so injection is impossible by construction.

Performance: evaluator is pure-numeric, ~10 µs per pattern per bar. With 25 patterns × 500 visible bars = 12 500 evaluations per render, ~125 ms worst case. Mitigation: cache last-evaluated kline-array signature per pattern; only re-evaluate the rightmost bar when the live tick updates the in-flight candle.

---

## Built-in catalog (v1)

Twenty-five patterns split across four categories. Each ships as a `.json` file under `packages/trading-core/src/patterns/builtin/`.

### Reversal — single bar (10)
1. Hammer (bullish)
2. Inverted Hammer (bullish)
3. Hanging Man (bearish)
4. Shooting Star (bearish)
5. Doji (indecision)
6. Dragonfly Doji (bullish)
7. Gravestone Doji (bearish)
8. Spinning Top (indecision)
9. Marubozu White (bullish-continuation)
10. Marubozu Black (bearish-continuation)

### Reversal — two bars (8)
11. Bullish Engulfing
12. Bearish Engulfing
13. Bullish Harami
14. Bearish Harami
15. Piercing Line (bullish)
16. Dark Cloud Cover (bearish)
17. Tweezer Bottom (bullish)
18. Tweezer Top (bearish)

### Reversal — three bars (5)
19. Morning Star (bullish)
20. Evening Star (bearish)
21. Three White Soldiers (bullish)
22. Three Black Crows (bearish)
23. Three Inside Up (bullish)

### Continuation (2)
24. Rising Three Methods (bullish)
25. Falling Three Methods (bearish)

**Defaults enabled on first run** (kept tight to avoid noise): Hammer, Shooting Star, Bullish Engulfing, Bearish Engulfing, Doji. The other 20 are available but disabled.

---

## Storage

### Backend — `user_patterns` table

Mirror of `user_indicators` for symmetry:

```sql
CREATE TABLE user_patterns (
  id           VARCHAR(255) PRIMARY KEY,
  user_id      VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id   VARCHAR(64)  NOT NULL,        -- 'hammer' / custom slug
  label        VARCHAR(120) NOT NULL,
  definition   TEXT         NOT NULL,        -- full JSON PatternDefinition
  is_custom    BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX user_patterns_user_id_idx ON user_patterns (user_id);
```

`definition` stores the full `PatternDefinition` JSON so user-customized params survive without a separate params column.

`seedDefaultUserPatterns(userId)` runs once per new user, mirroring `seedDefaultUserIndicators` — reads `BUILT_IN_PATTERNS` from `@marketmind/trading-core/patterns`, inserts a row per built-in for the user, with `is_custom: false`.

tRPC router `userPatterns`:
- `list()` — list user's patterns
- `create(definition)` — register a custom pattern (sets `is_custom: true`)
- `update({ id, definition })` — edit any (built-in or custom)
- `duplicate({ id, newLabel? })` — clone with new id
- `delete({ id })` — only allowed when `is_custom === true` (built-ins can be hidden via toggle, not deleted)
- `reset()` — re-seed defaults (drops user customizations of built-ins)

### Frontend — `usePatternStore`

Per-panel scoping (matches `chartLayersStore` / `indicatorStore`):

```ts
interface PatternState {
  /** Per-panel: which user-pattern ids are highlighted on this chart. */
  enabledIdsByPanelId: Record<string, Set<string>>;
  enableForPanel: (panelId: string, userPatternId: string) => void;
  disableForPanel: (panelId: string, userPatternId: string) => void;
  toggleForPanel: (panelId: string, userPatternId: string) => void;
  getEnabledForPanel: (panelId: string) => Set<string>;
  pruneRemovedPanels: (knownIds: Set<string>) => void;
}
```

Persisted via `usePreferencesStore.set('chart', 'patternsByPanel', state)` — same write-through pattern as indicator instances.

### Default-layout seed

Extend `apps/electron/src/renderer/store/seed/defaultLayoutSeed.ts` with a `patternBindings` array — same shape as `indicatorBindings` but pointing at user-pattern ids. Default Hammer/Shooting Star/Engulfings on every chart panel of every layout (matches the indicator-binding flow landed in #583).

---

## UI

### 1. Refactor: `CatalogTogglePopover` (generic)

Extract `IndicatorTogglePopoverGeneric` to a reusable shell that takes config:

```ts
interface CatalogTogglePopoverProps<T extends { id: string; label: string }> {
  /** Trigger button text + icon. */
  trigger: { label: string; icon: ReactNode };
  /** All available items, grouped by `group`. */
  items: T[];
  groupBy: (item: T) => string;
  /** Per-panel active set. */
  activeIds: Set<string>;
  onToggle: (item: T) => void;
  /** Optional CRUD actions — when omitted, the row's "⋯" menu hides them. */
  onCreate?: () => void;
  onEdit?: (item: T) => void;
  onDuplicate?: (item: T) => void;
  onDelete?: (item: T) => void;
  /** Right-rail badge count, optional helper text. */
  emptyState?: ReactNode;
}
```

Both `IndicatorTogglePopover` and `PatternTogglePopover` become 30-line wrappers that bind the right store + actions to this generic.

**Constraint**: keep the generic in `apps/electron/src/renderer/components/ui/` so it can later move into `@marketmind/ui` (per `UI_EXTRACTION_PLAN.md`).

### 2. New: `PatternTogglePopover`

Lives in toolbar between Indicators and Layers — placement requested by user.

- Trigger: `<LuFlag /> Patterns` (or `<LuChartCandlestick />` if available in `lucide-react`)
- Categories rendered in this order: **Reversal Single-Bar**, **Reversal Multi-Bar**, **Continuation**, **Indecision**.
- Each row: pattern label · sentiment dot (green/red/grey) · toggle switch · ⋯ menu (Edit, Duplicate, Delete-if-custom).
- Footer: `+ New pattern` button → opens `PatternConfigDialog` (Create mode).

### 3. New: `PatternConfigDialog`

Clone of `Indicators/IndicatorConfigDialog.tsx` style. Three sections:

1. **Identity** — Label, category dropdown, sentiment dropdown, bars (1-5).
2. **Parameters** — list of params with `+ Add param` button; each row has key, label, default, min/max/step (matches `IndicatorParamValue` shape).
3. **Constraints** — list of textual constraints with `+ Add constraint`. Each constraint has a small textarea + a "Validate" inline check that runs the parser and shows an error if the expression is invalid.

A **Live preview** strip below the form: the currently-focused chart panel is sampled, the pattern is evaluated against the last 200 bars, matching bar indices are listed (e.g. "Matches: 4 bars in last 200"). Helps users tune constraints before saving.

### 4. Layer toggle: `LayersTogglePopover`

Add a fifth row to `LAYER_ROWS` in `LayersTogglePopover.tsx`:

```ts
{ key: 'candlePatterns', icon: <LuFlag />, labelKey: 'chart.layers.candlePatterns' }
```

`ChartLayerFlags` gains `candlePatterns: boolean` (default `true`). Render-pipeline gate gates the marker render call same way `setupMarkers` is gated today.

---

## Render pipeline

### Detection: `usePatternMarkers`

```ts
function usePatternMarkers(panelId: string | undefined, klines: Kline[]): PatternHit[]
```

- Reads enabled pattern ids for `panelId` from `usePatternStore`.
- Reads pattern definitions from `useUserPatterns()` (tRPC query, cached).
- **Evaluates only closed bars** — the in-flight candle (last index) is skipped. See *Decision 1* below.
- For each enabled pattern, evaluates against `klines[i-bars+1 .. i]` for each closed `i`.
- Returns `[{ index, patternId, sentiment, label }]`.
- Memoized on `(closedKlinesLength, klines[lastClosed].close, enabledIds, definitions.version)`. The live tick mutates `klines[last]` (the in-flight bar) but never the closed-bar array signature, so the memo stays warm tick-to-tick — re-eval only fires on candle rotation.

### Rendering

A new renderer in `apps/electron/src/renderer/components/Chart/ChartCanvas/renderers/renderCandlePatterns.ts`:

- For each hit, draw a small glyph **above the high** (bearish) or **below the low** (bullish), or **at midprice** (neutral).
- Glyph: filled triangle (▲ bullish / ▼ bearish) or open circle (◯ indecision), 8 px, sentiment-colored from semantic tokens (`trading.profit`, `trading.loss`, `fg.muted`).
- Stack vertically when multiple patterns hit the same bar.
- Hover shows a tooltip with the pattern label.

Integrated into `ChartCanvas` next to where `renderOrderLines` and `setupMarkers` already render. Gated by `layerFlags.candlePatterns`.

---

## Phasing

### M1 — built-ins + catalog popover + layer + render (one PR, ~1 week)

- `packages/trading-core/src/patterns/`: types, evaluator, 25 built-in `.json` defs, tests for the evaluator + each pattern.
- `apps/backend`: `user_patterns` table + migration, router, `seedDefaultUserPatterns`, integration tests.
- `apps/electron`: `usePatternStore`, `useUserPatterns`, `usePatternMarkers`, `renderCandlePatterns`, layer flag, `defaultLayoutSeed.ts` extension.
- Refactor `IndicatorTogglePopoverGeneric → CatalogTogglePopover`. New `PatternTogglePopover` wrapper.
- **Defer**: custom-pattern creation UI (M2). M1 ships only the built-ins; "+ New pattern" button is hidden.

### M1.1 — pattern hit popover on glyph click (one small PR, ~half a day)

User clicks a pattern glyph on the chart → small popover anchored at the
glyph showing:

- Pattern label (e.g. "Bullish Engulfing")
- Sentiment dot + category badge
- Description from the pattern definition
- Bar timestamp (so the user can correlate with the chart x-axis)
- (Added in M2) "Edit pattern" button → opens `PatternConfigDialog`.

Implementation:

- Hit-test glyph positions against mouse coords. The renderer already
  exposes a `findPatternHitAtPosition` stub in
  `apps/electron/src/renderer/components/Chart/ChartCanvas/renderers/renderCandlePatterns.ts`
  — wire it into the chart's mousedown handler.
- Hits are already in memory via `usePatternMarkers`; no backend / store
  changes needed.
- Open a Chakra `Popover` positioned at the click point; close on
  outside-click / Escape.

Click chosen over hover because the popover content (label + description
+ sentiment + future "Edit" button) deserves a stable surface, not a
transient tooltip.

Ships as a polish follow-up to M1 so the layer launches with discoverable
UX before M2's larger dialog work begins.

### M2 — custom-pattern creation (one PR, ~3-4 days)

- `PatternConfigDialog` with constraint editor + live preview strip.
- Show "+ New pattern" button in popover.
- Allow Edit/Duplicate/Delete on existing patterns (built-ins: edit-only; custom: full CRUD).
- E2E test: create a custom pattern, toggle it on a chart, verify glyph renders.

### M3 — polish (one PR)

- Tune defaults based on dogfooding.
- Add 5-10 more patterns based on user requests.
- Performance pass (worker-offload detection if mainthread budget gets tight).
- i18n for all pattern labels + descriptions in en/pt/es/fr.

Total estimate: **~2 weeks elapsed** for the full feature.

---

## Testing

### Unit (`packages/trading-core/src/patterns/__tests__/`)
- DSL parser: tokenization, AST, error handling for malformed expressions.
- Evaluator: each primitive returns the expected value on a hand-built kline.
- Per built-in pattern: at least one positive case (clear match) and one near-miss (small param-tuning case).

### Backend integration (`apps/backend/src/__tests__/routers/user-patterns.router.test.ts`)
- Create / list / update / delete CRUD.
- `seedDefaultUserPatterns` runs once per user, idempotent.
- Built-ins cannot be deleted; custom can.

### Frontend unit (vitest jsdom)
- `usePatternStore` per-panel scoping (toggle in panel A, not affecting panel B — mirrors the test pattern from #583).
- `usePatternMarkers` memoization + tick path.
- `PatternTogglePopover` wraps `CatalogTogglePopover` correctly.

### Frontend browser (vitest browser)
- `renderCandlePatterns` draws expected glyph counts on a synthetic kline series.

### E2E (Playwright)
- Toggle Patterns layer off → all glyphs disappear.
- Open Patterns popover → enable Hammer → glyphs appear on hammer bars.
- Create a custom pattern via dialog → matches expected bars.

---

## Design decisions

Locked in before implementation begins:

### 1. Detection runs on closed bars only

The in-flight candle is **never** evaluated. Justification:

- **Trader convention** — every classical reference describes patterns as forming "on close." A Hammer with a long lower wick mid-bar can still close as a different shape entirely; calling it early is misleading.
- **No flicker** — the live wick extends and retracts every tick; live evaluation would make markers blink in and out, which reads as noise rather than signal.
- **Cheaper** — the closed-bar signature only changes on candle rotation (~once per timeframe), so the memo holds tick-to-tick. Per-tick eval would be 25× more work for misleading output.
- **Reversible if needed** — users who want live preview can run M2's "Live preview" panel inside the create-pattern dialog, which evaluates against the in-flight bar explicitly.

### 2. Detection is binary in v1 — no confidence scoring

A pattern either matches or it doesn't. No per-constraint weights, no "match strength" percent, no probabilistic threshold. Justification:

- **Honesty** — assigning a "70% confidence" to a Hammer requires backtest data to calibrate; without that, weights are made-up numbers that look authoritative.
- **DSL stays simple** — the user-creation dialog (M2) shows a flat list of constraints. Adding weight sliders multiplies the UI surface for no validated benefit.
- **Tunability still available** — the `params` mechanism (e.g. `wickRatio`) lets users adjust how strict a pattern is; that's the right knob.
- **Not load-bearing** — the chart-annotation use case doesn't need scoring. Auto-trading on patterns is explicitly out of scope (see decision 4).

If we later wire patterns into the strategy DSL, scoring lives there (the strategy decides how to weight a pattern signal alongside indicators), not in the pattern itself.

### 3. Multiple patterns on the same bar stack vertically

A bar that satisfies both Hammer and Bullish Engulfing shows both glyphs, stacked above-or-below the bar. No priority, no suppression. Justification:

- **No information loss** — both detections are valid; picking one would hide a real signal.
- **Visual cost is low** — glyphs are 8 px; stacking 2-3 fits inside the existing wick-margin.
- **Tooltip already disambiguates** — hovering shows all matching pattern labels.

### 4. Patterns are annotation-only in v1 — no setup-pipeline hook

A detected pattern does not participate in checklist evaluation, setup detection, or auto-trade entry. Justification:

- **Responsibility split stays clean** — patterns are *visual*; setups are *decisions*. Coupling them prematurely makes both harder to evolve.
- **The strategy DSL already covers cross-signal logic** — a strategy author can express "RSI oversold AND price made a new low" without needing pattern primitives.
- **v2 escape hatch exists** — if dogfooding shows a real need ("I want to checklist-condition on 'Hammer on this bar'"), we add a single primitive `pattern.detected('hammer')` to the checklist DSL. That is one well-scoped addition, not an architectural change.

### 5. Cross-timeframe pattern logic stays in the strategy DSL

"Hammer on 1h while RSI < 30 on 15m" is a setup, not a pattern. Pattern definitions look at one bar window on one timeframe. Justification:

- **The strategy DSL is exactly the right tool** — it already handles multi-timeframe condition stacking via `timeframe: '1h'` per checklist row.
- **Keeping patterns single-timeframe keeps the DSL evaluator simple** — primitives operate on a flat `bars[]` array, which is what every classical pattern needs.
- **If the strategy DSL gains pattern primitives (decision 4 / v2)**, multi-timeframe falls out for free — strategies already address timeframes, so `pattern.detected('hammer', '1h')` reads naturally there.

---

## Code-quality directives

- Pattern definitions live as `.json` files (one file per pattern) under `packages/trading-core/src/patterns/builtin/` so the catalog is editable without touching TypeScript.
- No `any` in the evaluator AST. Every node has a discriminated `type` field.
- All UI strings i18n-keyed under `chart.patterns.*`.
- All glyph colors via semantic tokens — no hardcoded hex.
- Render call is `O(visible_bars × enabled_patterns)`; memoize aggressively, never call from a non-throttled subscribe.
- The DSL evaluator must reject any expression containing identifiers not in the primitive whitelist — defense against future "extend the DSL with a `read_file()` op" misadventures.
