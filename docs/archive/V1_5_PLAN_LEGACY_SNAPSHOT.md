# v1.5 — Outstanding work (archived)

> **Status:** All autonomous-scope items shipped on develop. Archived for
> the historical record. v1.3.0 release (D.1) remains gated on user
> signal and is the only item still pending.
>
> **Shipped**: A.1 (#270), A.2 (#271), B.1 (#279), B.2 (#280), B.3 (#283),
> C.1 (#274). Plus follow-up sweeps that emerged during execution:
> Settings dialog widths fix (#275), mcp-screenshot timing fix (#276),
> WatcherManager Select migration (#277), SetupToggle + WatcherCard rows
> + OpportunityCost Select (#278), template-string shade leak audit rule
> + cosmetic stripe sweep (#282).
>
> **Skipped**: C.2 (visual review automation) — explicitly skipped per
> the original plan's decision.
>
> **Deferred**: D.1 (v1.3.0 release) — gated on user.

Snapshot of what remained after the v1.4 sweep (20 PRs, #246–#268) when
the plan was written. v1.4 shipped the structural + semantic-token
cleanup; v1.5 picked up the deferred items from V1_3_PLAN that were
autonomous-friendly, plus a few new ones surfaced during the sweep.

The v1.3.0 release is gated on this plan reaching a natural pause point.

## A — Primitives + form polish

### A.1 — `<DataCard>` primitive (deferred from V1_3 / V1_2)
- Several surfaces render the same "label + value + optional subtext"
  stat-card pattern with ad-hoc `<Box p={3} bg="bg.muted" borderRadius>`
  wrappers. Examples:
  - `RiskDisplay` (4 cards: Open Positions, Total Exposure, Daily PnL,
    Size per Watcher)
  - `PerformancePanel`'s internal `MetricCard`
  - `OrdersDialog` stats bar (totals row)
  - `PortfolioSummary` (per-position aggregates)
- Goal: a single `<DataCard label value subtext valueColor>` primitive in
  `ui/`, replace the inlined patterns, drop ~50 LOC across surfaces.
- **Effort**: ~3h. **Risk**: low (visual-token-equivalent).

### A.2 — Custom Symbols "Create New" form rows (deferred from V1_3)
- `CustomSymbolsTab.tsx`'s create-new section uses raw `<Box>`/`<HStack>`
  for label/control rows; should align to `<Field>` / `<FormRow>`
  primitives like every other settings tab.
- **Effort**: ~2h. **Risk**: low.

## B — Test + CI infra

### B.1 — Browser tests for `renderOverlayBands` + `renderPivotPoints`
- #264 added browser tests for `renderOverlayLine` to lock in the
  #256/#262 regression. The companion renderers also benefit from
  pixel-sampling tests on the right-axis tag (bands) or pivot markers.
- Pivot points: no tags currently — separate decision (do we want them?).
  Bands: tags shipped in #262, no test.
- **Effort**: ~2h for bands. **Risk**: low.

### B.2 — pixelmatch HTML gallery for CI artifacts (V1_3 E.3)
- `scripts/visual-diff.mjs` writes red-overlay PNGs to `<session>/diffs/`.
  CI uploads them as artifacts but the user has to download + view.
  Extending `renderGalleryHtml` to read `diffs/` and add a third image
  column ("diff") would beat that.
- **Effort**: ~2h. **Value**: medium — only relevant when visual
  regression is failing, but speeds the diff-investigation loop.

### B.3 — Empty-state + EmptyState test coverage holes
- C.3 in V1_3 said `Portfolio` and `OrdersList` empty-state tests were
  skipped (too many hooks/global state to mock cleanly). Worth
  revisiting now that the renderer is more stable; the visual-regression
  baseline catches them but a focused unit test would document intent.
- **Effort**: ~half-day. **Risk**: low.

## C — Style guide + tooling

### C.1 — Document the v1.4 sweep rules in `UI_STYLE_GUIDE.md`
- `docs/UI_STYLE_GUIDE.md` documents primitives but doesn't yet capture
  the V1_4 anti-patterns the audit script enforces:
  - Static shade literals (rule #1)
  - `_dark={{}}` JSX prop overrides (rule #2)
  - Nested `_dark: {}` overrides in object literals (rule #3)
  - Tinted-card `<Box bg="X.subtle" borderColor="X.muted">` (rule #4)
  - Dynamic shade pair `color={cond ? 'green.NNN' : 'red.NNN'}` (rule #5)
- Each rule needs a "Don't / Do" pair pointing at the right semantic
  token (`trading.long/short`, `trading.profit/loss`, `trading.warning`,
  `trading.info`, `accent.solid`, `bg.muted` etc.).
- **Effort**: ~3h. **Risk**: zero (docs only).

### C.2 — Visual review automation (V1_3 G.2)
- A `pnpm visual:review` script that walks the renderer + flags
  candidate issues:
  - Headings >`fontSize="md"` outside known section headers
  - Spacing values not in `MM.spacing.*` tokens
  - Components not consuming any semantic token
- The audit script already handles the worst patterns; this is a tier
  below — speculative value, may be too noisy.
- **Effort**: ~1d. **Risk**: low (script-only, no source changes).
- **Decision**: skip unless we hit a wave of token-style regressions.

## D — Release prep (gated on user)

### D.1 — v1.3.0 release
- The user said the release should land at the end of the plan. Once
  A.1 + A.2 + B.1 + C.1 are done (or sooner if the user calls it),
  follow `docs/RELEASE_PROCESS.md`:
  1. Bump version in 3 `package.json`s (root, electron, backend)
  2. Update README badge
  3. CHANGELOG: `[Unreleased]` → `[1.3.0] - YYYY-MM-DD`
  4. Update CLAUDE.md `Project Version`
  5. Update landing site repo (separate)
  6. Tag + release

## E — Out of autonomous scope (need user signal)

- **F.2 keyboard nav in chart** (~1d) — UX hands-on
- **F.3 screen-reader pass on dialogs** (~half-day) — needs screen reader
- **E.1 mcp-app flow tools** (~4h) — design decision
- **E.2 mcp-trading** (~1 week) — product decision

## Sequencing (proposed)

1. A.1 DataCard primitive — biggest visible payoff
2. A.2 Custom Symbols form rows — small finishing touch
3. B.1 Browser tests for bands — defends the #262 fix
4. C.1 UI_STYLE_GUIDE update — documents what just shipped
5. B.2 pixelmatch HTML gallery — devx
6. B.3 Empty-state holes — coverage closure
7. **D.1 v1.3.0 release** — gated on user

C.2 (visual review automation) skipped unless needed.

## Acceptance

A v1.5 phase is "done" when:
- The deliverable lands on develop with green CI
- The audit script still reports 0 forbidden patterns
- No visual-regression baseline drift (or baseline refreshed
  intentionally)
