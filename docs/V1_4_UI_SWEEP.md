# v1.4 — UI consistency sweep

After v1.2 (color tokens) and v1.3 (perf, lazy-load, test coverage, doc drains), the next focus is **structural visual consistency**: making every surface feel like the same app. Same section header pattern, same control sizing, same spacing, same width per row, same way of grouping help-text + controls.

The v1.2 sweep was mechanical — `color="X.500"` → `X.fg`, `_dark={{}}` removal. Visual consistency is structural — `<FormSection>` vs raw `<Stack>`, ad-hoc `<Box bg="green.subtle">` vs `<Callout>`, `<Switch>` floating vs inside `<FormRow>`, inconsistent inner padding/spacing, dialog body widths.

The user's report after seeing the live app:
> "tem que padronizar... a pior de todas é a de autotrade que nao tem padrão nenhum, cada parte de um jeito diferente, componentes grandes que poderiam ser menores, caixas coloridas que nao deveriam existir, cada aba tem o conteudo de uma largura diferente, tudo misturado estranho e feio."

## Scope

### Phase 1 — Settings dialog (13 tabs)

**Priority 1 — AutoTrading tab (the worst)**

Surface: `apps/electron/src/renderer/components/Trading/WatcherManager/` (rendered by `Settings/AutoTradingTab.tsx`).

Inconsistencies found in the structural audit:
1. **Inline "Trading mode" block** (`WatcherManager/index.tsx` ~L197-L224) is a raw `<Box>` with manual `<Text>` + `<HStack>` of `<Button>`s — not wrapped in a section; sits between EmergencyStopSection and WatchersList without consistent header treatment.
2. **Ad-hoc empty-wallet state** (`WatcherManager/index.tsx` L177-L184) uses `<Box p={4} textAlign="center"><Text color="fg.muted">{t('tradingProfiles.noWallet')}</Text></Box>` instead of `<EmptyState>`.
3. **Colored container boxes** that shouldn't exist:
   - `QuickStartSection.tsx`: `<Box p={3} bg="green.subtle" borderRadius="md" borderWidth="1px" borderColor="green.muted">` wrapping the whole quick-start panel (greens for an info container).
   - `StockPresetsSection.tsx`: identical green-tinted wrapper.
   - These should be `<Callout tone="info" compact>` or just plain `<Box>` with no tint.
4. **`<Separator />` peppered between sections** even though `CollapsibleSection variant="static"` already provides visual structure — double separation, visual noise.
5. **Inner spacing varies per section**: PositionSize uses `Stack gap={6}`, Pyramiding uses `Grid gap={3}` + `Stack gap={2}`, TrailingStop uses `VStack gap={3}` + ad-hoc inner `<Box>` rows. The `MM.spacing` token system has standard values (`section.gap = 16px`) — sections should align to it.
6. **Action buttons inline vs in section header**: trading mode toggle is two buttons inline; auto-rotation toggle is in DynamicSelection's badge; "Trigger rotation" button placement varies.

Refactor target for AutoTrading:
- Drop the inline Trading-mode block; create `TradingModeSection` (CollapsibleSection variant="static") OR demote to a `<FormRow>` inside an existing section.
- Replace the empty-wallet `<Box>` with `<EmptyState size="sm" title=...>`.
- Strip ad-hoc green-tinted wrappers; QuickStartSection/StockPresetsSection content sits inside the section body with no extra tint.
- Remove `<Separator />` between sections (CollapsibleSection already separates). If a hard divider is wanted, use one consistent rule.
- Standardize inner spacing per the `MM.spacing.section.gap` token; commit to `<Stack gap={MM.spacing.section.gap}>` as the section body wrapper.
- Audit each section's control density — switches in `<FormRow>`, sliders with consistent label+helper, number inputs at consistent size.

**Priority 2 — TradingProfiles, Wallets, Indicators, CustomSymbols** (also dense, similar issues)
**Priority 3 — Account, Security, Notifications** (account/security forms; usually less of a mess)
**Priority 4 — General, Chart, Data, Updates, About** (smallest/simplest)

For each tab the deliverable is:
- Before/after screenshots in light + dark (via `pnpm --filter @marketmind/mcp-screenshot dev` once gallery driving lands or by running mcp-screenshot manually).
- Source-code diff aligning to the rules below.
- Visual-regression baseline refresh for the tab.

### Phase 2 — Sidebars

`Trading`, `AutoTrading`, `Market`, `OrderFlow` sidebars. Same structural rules. Likely fewer issues since they're newer.

### Phase 3 — Modals

`BacktestModal`, `AnalyticsModal`, `ScreenerModal`, `OrdersDialog`, flow modals (`AddWatcher`, `CreateWallet`, `StartWatchers`, `ImportProfile`, `TradingProfiles`).

### Phase 4 — Layout/Toolbar/Chart UI

`QuickTradeToolbar`, header bar, chart UI overlays (`TrailingStopPopover`, `LeveragePopover`, `GridOrderPopover`, etc.). These are higher-density and harder to standardize without affecting muscle memory.

## Rules to codify

The output of this sweep should be a set of rules that get added to `docs/UI_STYLE_GUIDE.md` and (where automatable) an audit script:

1. **Section wrapper**: every settings/config section uses `<CollapsibleSection variant="static">` (collapsible) or `<FormSection>` (always-open form group). Never raw `<Box>` + `<Text fontWeight=...>` for section titles.
2. **Section body wrapper**: `<Stack gap={MM.spacing.section.gap}>` (16px standard). Override only with explicit reason.
3. **Switches**: always inside `<FormRow label= helper=>`. Never floating. Single-line switches are an exception only when they're `Switch + label` inline as a compact toggle.
4. **Inline messages**: `<Callout tone= compact>` — never `<Box bg="X.subtle" borderRadius="md" borderWidth="1px" borderColor="X.muted">`. Add an audit-script rule that flags this anti-pattern.
5. **Empty states**: always `<EmptyState>` — never ad-hoc `<Box p textAlign="center"><Text color="fg.muted">No data</Text></Box>`. Already an existing rule from v1.2; audit script can be extended to flag this pattern.
6. **No `<Separator />` between `<CollapsibleSection variant="static">` siblings** — the section header already provides visual separation. Reserve `<Separator />` for transitions between fundamentally different content groups (e.g. above the action footer).
7. **Dialog body width**: settings dialog content is `maxW="1100px"`; tabs render inside a fixed inner column. Sub-content should not exceed that width or override it.
8. **Action buttons in section headers**: when an action belongs to a section, place it in the `action` slot of `<FormSection>` / `<PanelHeader>` — not inline before/after the section.

## Acceptance per phase

A phase is "done" when:
- Every surface in the phase passes the structural rules above.
- The audit script (extended in this sweep) catches regressions.
- The visual-regression baseline reflects the post-sweep state.
- The Style Guide section for that phase area lists what was unified.

## Out of scope

- Reworking the underlying logic of any section (this is purely visual/structural).
- Adding new features (e.g. new filters, new section types).
- Backend changes.

## Sequencing inside Phase 1 (proposed)

| PR | Tab | Effort | Risk |
|---|---|---|---|
| 1 | `docs/V1_4_UI_SWEEP.md` (this doc) | 2h | low |
| 2 | AutoTrading — pass 1 (drop inline blocks, ad-hoc colored containers, empty-state, separator de-noise) | half-day | medium (lots of moving parts) |
| 3 | AutoTrading — pass 2 (per-section spacing/control density alignment) | half-day | low |
| 4 | TradingProfiles + Wallets — same passes batched | half-day | medium |
| 5 | Indicators + CustomSymbols — same passes batched | half-day | low |
| 6 | Account + Security + Notifications | ~3h | low |
| 7 | General + Chart + Data + Updates + About | ~3h | low (smallest tabs) |
| 8 | Style guide section for the unified rules + audit-script extensions | ~3h | low |

## What this doc is not

A specification of every pixel change. The intent is to align on *what kinds of changes* the sweep makes so each tab refactor PR is a focused execution of these rules, not a re-litigation of approach.
