# v1.8 — Audit gate + design-system completion

> **One sentence:** turn the v1.7 design-language sweep into something the codebase enforces (CI gate) instead of relying on review, and finish the last few v1.7-deferred surfaces (`FuturesPositionsPanel`, the position-card pattern, anything the new audit reveals).
>
> **Authored:** 2026-05-01, immediately after v1.7.0 ships.

## Why

v1.7 brought every non-dialog surface up to the v1.6 design language but **deferred Track A** (the panel-rules audit). Without the audit running in CI, the rules are documented but not enforced — drift will creep back in within a few PRs. v1.8 closes that loop and finishes one v1.7-deferred surface (`FuturesPositionsPanel`) plus whatever else the new audit shines a light on.

Smaller in scope than v1.6 / v1.7 by design — those were big sweeps; this is the **enforcement + last-mile cleanup** cycle.

## Track structure

### Track A — Audit gate + sweep (in flight: PR #406)
- New `scripts/audit-panel-rules.mjs` with two rules:
  - `bespoke-record-row` — catches `<Box borderWidth=1 borderColor=border borderRadius=md p={N}>` outside `<RecordRow>`
  - `bespoke-loading-text` — catches `<Text>{t('common.loading')}</Text>` next to `<Spinner>`
- `<RecordRow>` extended with `tone='default'|'muted'|'panel'` and `onClick` (interactive variant) so the primitive can absorb every shape the audit catches.
- 13-callsite sweep: MarketIndicatorCharts (6), MarketIndicatorSections (4), FuturesPositionInfo, MarginInfoPanel, FiltersTab, EquityCurveChart tooltip, RecentRunsPanel, AuthGuard.
- CI gate: `lint:dialogs:strict` + `lint:panels:strict` wired into `ci-cd.yml`.
- Bonus: cleared 2 pre-existing eslint errors in `useChartTradingData.ts` + `SymbolSelector.tsx` so the gate actually gates.

### Track P — FuturesPositionsPanel rewrite (deferred from v1.7 P)
The card uses a `<Box p=3 bg="bg.muted" borderRadius=md borderLeft="4px solid" borderColor={side === 'LONG' ? 'trading.long' : 'trading.short'}>` shape — the colored 4px left border is intentional UX (side-coded). `<RecordRow>` doesn't model that, and absorbing it into `RecordRow` would over-broaden the API.

**Approach options:**
1. Co-locate a `<FuturesPositionCard>` primitive in `apps/electron/src/renderer/components/Trading/` that wraps `<RecordRow density="card" tone="muted">` and stamps the colored left border via a `accentSide` prop. Keeps the side-coded shape semantic.
2. Extend `<RecordRow>` with `accentBorder?: { side: 'left' | 'right' | 'top' | 'bottom'; color: string; width: number }` — feels too specific for one consumer.

**Pick (1)**, but only after Track A lands. If the audit catches similar accent-bordered `<Box>` patterns elsewhere (long/short tags, alerts), revisit.

Also — `FuturesPositionsPanel`'s `isLoadingPositions` branch returns `<EmptyState size="sm" title={t('common.loading')} />` which is a misuse (EmptyState is for "nothing here", not "loading"). Replace with the `<Spinner>` panel combo.

### Track D — Decoupled / opportunistic
Items that surface during Track A/P that warrant their own small PR rather than expanding scope:
- Anything the audit catches in files I haven't reviewed (chart legends, indicator panels, etc.)
- A 3rd `<RecordRow>` variant if a non-card pattern keeps recurring
- Documentation: `<RecordRow>` API matrix in `docs/UI_STYLE_GUIDE.md`

### Track Q (maybe) — Quality polish
Open question for the user — would they like:
- **Dialog header standardization audit**: `lint:dialogs` covers the body/structure but doesn't lint header strings ("Settings" vs "Settings — Wallets" vs "Wallet Settings"). Pure copy review, not structural.
- **Loading-state coherence audit**: across all panels — make sure every loading state uses one of the 3 sanctioned shapes (page Spinner, panel Spinner+py, skeleton).
- **Empty-state inventory**: `<EmptyState>` exists but call-sites are inconsistent — sometimes used for "no items yet", sometimes for "no search match". Standardize.

Not auto-included; flag to user before adding.

## Sequencing

| # | Track | What | Effort | Status |
|---|---|---|---|---|
| 1 | A | `audit-panel-rules.mjs` + RecordRow extensions + 13-callsite sweep + CI gate | 4h | **In flight (PR #406)** |
| 2 | P | `FuturesPositionCard` primitive + loading-state fix in `FuturesPositionsPanel` | 2h | Queued |
| 3 | D | Sweep whatever Track A surfaces in non-priority files | 2-3h | Queued |
| 4 | Q | Optional polish tracks (need user input) | TBD | Awaiting input |

**Total estimated: 8-9h** (much smaller than v1.6/v1.7).

## Out of scope (deferred to v1.9 or later)

- **Header redesign** (the app-wide top header) — bigger conversation about navigation.
- **Mobile / tablet adaptations** — entire viewport rethink.
- **Chart canvas drawing primitives** — separate concern from the design system.
- **Settings tabs internal restructure** — already done in v1.6 G/S; no further work.
- **MCP-trading expansion** — feature work, not design system.

## Acceptance

- `audit-panel-rules.mjs --strict` is in CI and clean.
- `audit-dialog-rules.mjs --strict` is in CI and clean.
- `<RecordRow>` API documented in `docs/UI_STYLE_GUIDE.md` covers all four shapes (compact/card × default/muted, plus `tone="panel"` for tooltips, plus `onClick` for clickable rows).
- `FuturesPositionsPanel` migrated to a co-located `<FuturesPositionCard>` primitive.
- All Track A/P PRs ship without breaking the 2332/2332 + 108/108 test count.
- Lint baseline still ~1969 warnings (no NEW warning categories introduced).

## Notes

- **Each track ships as one PR off `develop`.** Memory: one-branch-at-a-time policy — no stacked PRs.
- **CHANGELOG entries land in the same PR as the work**, not in a batch at release time.
- **Release happens at the end of the cycle** (per user's earlier "vamos deixar a release para o final do plano todo").
