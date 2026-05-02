# v1.9 — Settings polish + deferred Track Q

> **One sentence:** finish the small fix that's already in flight (Settings tab widths + scroll behavior) and pick up the optional polish tracks deferred from v1.8.
>
> **Authored:** 2026-05-02, immediately after v1.8.0 ships.

## Why

v1.8.0 just shipped. Two unfinished threads:

1. **PR #411 (Settings dialog fix)** is open against `develop` but not yet merged. It fixes width + bottom-padding + dialog-level-scroll bugs in the Settings dialog. Will roll forward into v1.9.0 (or ship as v1.8.1 patch — TBD).
2. **Track Q (optional polish)** was flagged in `V1_8_PLAN.md` but skipped because it needed user input on which items to pursue. The 3 candidates (dialog header copy review, loading-state coherence audit, empty-state inventory) are still relevant.

v1.9 is intentionally narrower than v1.6/v1.7/v1.8 — it's housekeeping before a bigger architectural cycle (see [V1_10_PLAN.md](./V1_10_PLAN.md) for the "sidebars → grid panels" rework).

## Tracks

### Track S — Settings fix (in flight)
**PR #411** — `fix(settings): tab content fills full width + Chart Display Options switches + bodyFill mode`
- Adds `flex={1}` to the inner `<Flex>` inside `<Tabs.Root>` so content area no longer collapses to rail width (~220px).
- Migrates `ChartSettingsTab` Display Options switches from `<Switch>{label}</Switch>` (squashed left) to `<FormRow label><Switch /></FormRow>` (label-left, switch-right).
- `<HStack>` patterns get `w="100%"` defensively so Buttons/Fields share the row evenly.
- Bumps content padding: `px=5 → px=6`, `pb=8 → pb=10` (40px). Padding moved INSIDE the scroll container so WebKit doesn't eat it on overflow.
- New `<DialogShell bodyFill>` mode: body becomes flex column with `overflow=hidden`, no inner Stack wrapper, dialog locks at `h={contentMaxH ?? '90vh'}` so small tabs (General/About/Notifications) don't shrink the modal AND don't trigger modal-level scroll (which was dragging the rail with content).

**Status:** awaiting CI + merge. Once green, decide:
- **(a) Patch release v1.8.1** — just this fix on top of v1.8.0
- **(b) Roll into v1.9.0** — bundle with Track Q items if any of those land here

### Track Q.1 — Dialog header copy review
Audit dialog titles + descriptions for consistency:
- "Settings" vs "Settings — Wallets" vs "Wallet Settings" — pick a pattern (e.g. always "Settings" with a section badge in the header)
- Consistent capitalization (Title Case vs Sentence case)
- Description consistency (always present? sometimes?)
- i18n key naming consistency (`settings.title` vs `dialog.settings.title`)

Pure copy review, not structural. ~2-3h. Result: a doc table mapping each dialog → current copy → proposed copy → i18n change.

### Track Q.2 — Loading-state coherence audit
Inventory every loading-state in the renderer. Today there are at least 4 sanctioned shapes:
- `MM.spinner.panel` — `<Spinner size=md py=6>` for panel-internal loading
- `MM.spinner.inline` — inline next-to-text loading
- Page-level `<Spinner>` (full-screen, e.g. AuthGuard)
- Skeleton (rare, table rows)

Audit: are all panel loading states using `MM.spinner.panel`? Any holdouts using bare `<Spinner>` without the token? Any using `<EmptyState title="Loading...">` (which the FuturesPositionsPanel fix in v1.8 P revealed as a misuse)?

Could become an audit script (`audit-loading-states.mjs`) catching:
- `<Spinner>` not wrapped in `<Flex>` with the standard `py`
- `<EmptyState>` with `title` containing translated "loading" key

### Track Q.3 — Empty-state inventory
`<EmptyState>` is used for both:
- "No items yet" (empty list)
- "No search match" (filtered list)
- "Loading" (misuse — see v1.8 P FuturesPositionsPanel fix)
- "Permission denied" / "Connection error" (misuse — should be Callout/Alert)

Pick a sanctioned set (probably just "no items" + "no search match") and migrate misuses to the right primitive (Callout, Alert, Spinner panel combo).

### Track D — Decoupled cleanup
Catch-all for whatever surfaces while doing the above. Examples:
- Sometimes `<DialogShell>` callsites pass `description` ending in a period, sometimes not. Standardize.
- Toast styling consistency
- Tab trigger label capitalization

## Sequencing

| # | Track | What | Effort | Status |
|---|---|---|---|---|
| 1 | S | Merge PR #411 (Settings fix) | done-ish | **Awaiting CI** |
| 2 | Q.1 | Dialog header copy review (audit doc) | 2-3h | Queued |
| 3 | Q.2 | Loading-state coherence audit | 3-4h | Queued |
| 4 | Q.3 | Empty-state inventory + migrations | 2-4h | Queued |
| 5 | D | Catch-all polish | TBD | Opportunistic |

**Total estimated: 7-12h.**

## Out of scope (for v1.9; deferred to v1.10+)

- **Sidebars → grid panels rework** (the user's big architectural ask) — see [V1_10_PLAN.md](./V1_10_PLAN.md). v1.9 stays narrow so v1.10 can be all-in on the panel migration.
- **Header redesign** (the app-wide top header) — folds into v1.10 since `+ Add panel` and `Organize grid` buttons join the header there.
- **Mobile / tablet adaptations** — entire viewport rethink.
- **MCP-trading expansion** — feature work, not design system.

## Acceptance

- PR #411 merged, settings dialog passes manual smoke test on all 9 tabs:
  - Small tabs (General, About, Notifications) stay at 90vh, no modal scroll, content with breathing room
  - Large tabs (Security, Chart, Data, etc.) scroll inner content, rail stays put
  - Display Options switches in Chart tab use FormRow shape
- Track Q items either ship or get explicitly punted to a future cycle with a note in the plan.
- Tests stay at 2332/2332 + 108/108 throughout.

## Notes

- Each Track Q item ships as one PR off `develop` per memory's one-branch-at-a-time policy.
- CHANGELOG entries land in the same PR as the work.
- Release happens at the end of the cycle.
