# v1.10 — Sidebars → Grid Panels

> **One sentence:** retire all sidebars; everything that lives in them today (ticket, checklist, watchers, market indicators, exposure cards, portfolio, positions, etc.) becomes a panel that the user adds to the grid via a `+` dropdown in the header — same grid that already holds the chart(s).
>
> **Authored:** 2026-05-02 in response to user direction:
>
> > "o botão de + no header principal do app vai ter um dropdown menu com gráficos (pode ser mais de um), boleta (que vai continuar com a funcionalidade de poder ser colocada em cima do gráfico), checklist separada da boleta, exposição margin stop protected etc, aquele card do portfolio vai ser outro, lista de posições etc etc. TUDO que hoje está em sidebars vai virar painéis que serão possíveis de colocar no grid junto dos gráficos. gráficos não têm limite, os demais componentes apenas um de cada."

## Vision

The app's information architecture today is a hybrid: the central canvas is a `react-grid-layout` of charts, and four sidebars (Market, Trading, Auto-Trading, Order Flow) hold everything else. Users can't move sidebar content into the grid, can't have more than one of anything sidebar-side, and the sidebar gray clashes with the chart's dark canvas.

v1.10 unifies the model: **every interactive component is a grid panel.** Charts are unlimited; non-chart panels are single-instance. Users compose their own workspace via a `+` button in the header.

## Goals

1. **One mental model, two cardinalities** — charts (multi) + named panels (single).
2. **User-driven workspaces** — add via `+ Add panel` menu, remove via right-click "Close", organize via `Organize grid` menu.
3. **Larger working canvas** — grid scrolls vertically (and horizontally) so a workspace can be bigger than the viewport.
4. **Visual cohesion** — every panel uses the same dark background as the chart (no more sidebar gray).

## Components to migrate

### From `MarketSidebar` (3 tabs today)
| Today | Becomes |
|---|---|
| Indicators tab | `<IndicatorsPanel>` |
| Charts tab (FearGreed, BTC.D, MVRV, ETF, Funding, OI cards) | `<MarketIndicatorsPanel>` (one panel containing the existing scrollable list) — or split per indicator if user prefers; default = one consolidated panel |
| Sections tab (regulatory / macro overlays) | `<MarketSectionsPanel>` |

### From `TradingSidebar` (4-5 tabs today)
| Today | Becomes |
|---|---|
| Quick-trade ticket | `<TicketPanel>` — keeps current "drag onto chart to overlay" affordance |
| Checklist (currently bundled with ticket) | `<ChecklistPanel>` — split out as a separate panel |
| Orders list | `<OrdersPanel>` |
| Portfolio card | `<PortfolioPanel>` (split if today's card is multi-stat) |
| Positions list | `<PositionsPanel>` |
| Exposure / Margin / Stop / Protected cards | `<ExposurePanel>` (group) or split (TBD during 4.3) |

### From `AutoTradingSidebar`
| Today | Becomes |
|---|---|
| Watchers list | `<WatchersPanel>` |
| Setup detection | `<SetupDetectionPanel>` |
| Activity log | `<AutoTradingActivityPanel>` |

### From `OrderFlowSidebar`
| Today | Becomes |
|---|---|
| Order flow metrics | `<OrderFlowMetricsPanel>` |

### Charts (already grid panels)
- Stay as-is. Multiple instances allowed (today's pattern).

## New header controls

### `+ Add panel` button (replaces sidebar toggle buttons)
Dropdown menu listing every registered panel type:
- **Charts** group: "Add chart" — always enabled (unlimited)
- **Trading** group: Ticket, Checklist, Orders, Portfolio, Positions, Exposure — each greyed when its single instance is already on the grid
- **Market** group: Indicators, Market Indicators, Sections
- **Auto-Trading** group: Watchers, Setup Detection, Activity
- **Order Flow** group: Metrics

Click → instantiate a panel with its `defaultLayout` (size + suggested position) into the grid.

### `Organize grid` button (next to `+`)
Dropdown menu with classic layout algorithms applied to whatever's currently in the grid:
- **Compact** — snap all panels to top-left, no gaps
- **By columns** — vertical stack, equal widths
- **By rows** — horizontal stack, equal heights
- **Tile** — square tiling that minimizes whitespace
- **Restore last saved** — load most recent layout snapshot (we already have layout snapshots since v1.5)

Each algorithm reads the current panel list and computes new `{x, y, w, h}` for each. No new panels added; no panels removed.

## Right-click behavior

### Non-chart panels
Right-click anywhere on the panel header (not the body, since some bodies have their own context menus like Orders) opens a context menu:
- **Close** — removes the panel from the grid (the user can re-add via `+`)
- **(Future)** — Resize presets, pin/unpin, etc.

`onContextMenu` with `preventDefault()` on Electron + web. Context menu uses `<Menu>` from the design system.

### Charts
Existing right-click context menu (drawing tools, snapshot, etc.) stays — chart's own UX, not the panel-close pattern.

## Grid changes

### Unbounded vertical scroll
Today: `react-grid-layout` clamps row count, panels can't extend below the viewport. Workspace is a single screen.

Tomorrow: grid scrolls vertically. User can stack panels into a tall workspace.

### Optional horizontal scroll
Less common but requested: workspace wider than the viewport. May or may not ship in v1.10.

### Panels larger than viewport
Resize handle stops clamping at viewport bounds. A 2000px-tall chart is allowed.

## Visual changes

### Panel background
- Today's sidebars: light gray (`bg.subtle`)
- Tomorrow's panels: dark like chart canvas (probably `bg.panel` or a new token `bg.panelDark`)

Audit: which existing surfaces need re-toning? Probably a new semantic token to allow theme flexibility.

### Panel framing
New `<GridPanel>` primitive:
- Header bar: `<GridPanelHeader title actions>` with optional close button (or rely on right-click)
- Body: scrollable area with the panel's component
- Border: matches chart panel border
- Resize handle: inherited from `react-grid-layout`

### Header cleanup
Remove from main header:
- Market sidebar toggle
- Trading sidebar toggle
- Auto-Trading sidebar toggle
- Order Flow sidebar toggle

Add to main header:
- `+ Add panel` button (with dropdown)
- `Organize grid` button (with dropdown)

## Track structure

### Track 1 — Foundation: panel registry + GridPanel primitive
- New `apps/electron/src/renderer/grid/panel-registry.ts`:
  ```ts
  export interface PanelDef {
    id: string; // 'ticket' | 'checklist' | ...
    title: string; // i18n key
    icon: ReactNode;
    component: ComponentType;
    cardinality: 'single' | 'multi';
    defaultLayout: { w: number; h: number };
    group: 'charts' | 'trading' | 'market' | 'autoTrading' | 'orderFlow';
  }
  ```
- New `<GridPanel>` primitive in `@renderer/components/ui/grid-panel.tsx`:
  - Dark bg via `bg.panel` (or new token)
  - Header with title + optional actions slot
  - Right-click handler on header → onClose callback
  - Body slot with scroll
- Wire to `react-grid-layout` (extend `useLayoutStore`)
- Tests: cardinality enforcement, registry lookup, default layout

### Track 2 — Grid scroll + sizing
- Configure `react-grid-layout`:
  - `autoSize=true`, no `maxRows`, allow overflow-y on container
  - Investigate horizontal scroll feasibility (probably needs custom container)
- Resize bounds: drop the viewport-clamp, allow large panels
- Test: drag panel below viewport, scroll grid, drop panel, restore on reload

### Track 3 — Header: `+ Add panel` + `Organize grid`
- Replace sidebar-toggle buttons with the new pair
- `+ Add panel` dropdown reads from panel registry, groups by `group`, disables single panels already on grid
- `Organize grid` dropdown with 4-5 layout algorithms (compact, columns, rows, tile, restore)

### Track 4 — Component migrations (one PR per group)
Each migration: extract the existing sidebar tab contents into a panel, register in the registry, drop the sidebar version, run the grid e2e.

- 4.1 — Trading: Ticket + Checklist (split)
- 4.2 — Trading: Orders + Portfolio + Positions
- 4.3 — Trading: Exposure / Margin / Stop / Protected
- 4.4 — Market: Indicators + MarketIndicators + Sections
- 4.5 — Auto-Trading: Watchers + Setup Detection + Activity
- 4.6 — Order Flow: Metrics

### Track 5 — Right-click close
- `<GridPanel>` header `onContextMenu` → context menu with Close
- Test on Electron + web (preventDefault matters)

### Track 6 — Layout migration / rollout
- One-shot migration: existing user with sidebar prefs → equivalent panel set in their default layout
- Feature flag (`grid.panelsV2`) for incremental rollout, then remove after stable
- Update layout snapshots format to include panel ids + cardinality

### Track 7 — Sidebar removal
- After all components migrated and grid panels live, remove the old sidebar files (`MarketSidebar`, `TradingSidebar`, `AutoTradingSidebar`, `OrderFlowSidebar`)
- Drop the `*SidebarOpen` preferences from the store
- Drop any sidebar-specific routes / handlers / IPC

### Track 8 — Visual cohesion sweep
- New `bg.panel` (or rename) for the unified dark panel bg
- Audit any non-panel surfaces still using `bg.subtle` from the sidebar era
- Ensure visual regression baseline updated

### Track 9 — Tests + a11y
- E2E flows:
  - Add panel via `+` menu (each type)
  - Right-click close
  - Organize: each algorithm
  - Scroll: vertical, horizontal
  - Persist + restore layout
- Keyboard: `+` menu reachable via tab + arrows, escape closes
- Screen reader: panel close action labeled

### Track A — Audits (may grow)
- New audit: `audit-grid-panel-rules.mjs` — enforces every panel uses `<GridPanel>`, no bespoke borders, no forgotten close handlers
- Possibly tighten `audit-shade-literals.mjs` to ban the deprecated sidebar tokens

## Sequencing

| # | Track | What | Effort | Risk |
|---|---|---|---|---|
| 1 | 1 | Panel registry + `<GridPanel>` primitive | 1-2 days | Low |
| 2 | 2 | Grid scroll + sizing changes | 1-2 days | Med (rgl behavior) |
| 3 | 3 | New header buttons (`+ Add panel`, `Organize grid`) | 1 day | Low |
| 4 | 4.1 | Trading: Ticket + Checklist split | 1 day | Med (chart overlay flow) |
| 5 | 4.2 | Trading: Orders/Portfolio/Positions | 1 day | Low |
| 6 | 4.3 | Trading: Exposure/Margin cards | 0.5-1 day | Low |
| 7 | 4.4 | Market: Indicators/Sections | 1 day | Low |
| 8 | 4.5 | Auto-Trading: Watchers/Activity | 1 day | Low |
| 9 | 4.6 | Order Flow: Metrics | 0.5 day | Low |
| 10 | 5 | Right-click close handler | 0.5 day | Low |
| 11 | 6 | Layout migration | 1 day | Med (user state) |
| 12 | 7 | Sidebar removal | 0.5 day | Low |
| 13 | 8 | Visual cohesion (dark bg) | 1 day | Low |
| 14 | 9 | E2E + a11y | 1-2 days | Low |
| 15 | A | Audits | 0.5 day | Low |

**Total estimated: 12-15 days.** Largest cycle since v1.0.

## Out of scope (deferred)

- **Multi-window / detached panels** — panels stay inside the main app window; no popout-to-OS-window in v1.10.
- **Workspace-level grouping** — no folders / saved-workspace concept beyond the existing layout snapshots.
- **Mobile / tablet** — viewport rethink, separate cycle.
- **Panel docking system beyond grid** — no drag-to-edge-to-dock; the grid is the only layout surface.
- **Custom user layouts shareable across machines** — single-machine for now.
- **Panels that don't fit the chart-style canvas** — e.g. wizards / settings stay as dialogs.
- **MCP-trading expansion** — feature work, separate cycle.

## Migration / rollout

### Feature flag
`preferencesStore.uiFlags.gridPanelsV2 = false` initially. When `true`:
- Sidebar toggle buttons hidden, `+ Add panel` + `Organize grid` shown
- Sidebar components mounted only as panel contents (not as sidebars)
- Layout store reads/writes the v2 schema (panels by id)

### One-shot conversion
On first opening of v1.10 with the flag on:
- Read old `*SidebarOpen` prefs
- For each `true`, instantiate the equivalent panel in the default position
- Save as the new layout
- Show a toast: "We've moved your sidebars into the grid — drag panels to rearrange."

### Removing the flag
After 1-2 cycles of stability (v1.11 or v1.12), drop the flag and the sidebar fallback path.

## Risks

1. **`react-grid-layout` may not handle unbounded scroll cleanly.** Mitigate: prototype Track 2 first, fall back to a wrapped scroll container if needed.
2. **State migration complexity.** Mitigate: write the migration with explicit unit tests covering each old-prefs-shape → new-layout-shape pair.
3. **Right-click conflicts.** Electron's `preventDefault()` is reliable; web target may differ. Mitigate: test both early in Track 5.
4. **Ticket-on-chart overlay flow.** Today's drag-to-overlay is a bespoke flow tied to the sidebar's ticket. Migrating the ticket to a panel must preserve this. Mitigate: Track 4.1 ships the chart-overlay drop target alongside the ticket panel migration, not after.
5. **Panel cardinality rules** may surprise power users. Mitigate: greying out the menu item with a tooltip ("only one ticket allowed; close the existing one to add another") makes the rule discoverable.

## Acceptance

- All sidebar tabs are reachable as grid panels via the `+ Add panel` menu.
- `+ Add panel` correctly enforces single vs multi cardinality.
- Right-click on a panel closes it; closed panels return to the `+` menu.
- `Organize grid` provides at least 4 layout algorithms; each produces a deterministic result.
- Grid scrolls vertically; panels can be resized larger than the viewport.
- Sidebar toggle buttons are removed from the header.
- All non-chart panels share the dark canvas background (no light gray).
- Existing user layouts (sidebar prefs) auto-migrate to equivalent panel sets on first load.
- E2E coverage: `add-panel`, `remove-panel`, `organize`, `scroll`, `persist-layout` test files all green.
- 2332/2332 unit tests + browser tests stay green throughout.
- `audit-grid-panel-rules.mjs --strict` clean.

## Notes

- Each track ships as one PR off `develop` per the one-branch-at-a-time memory.
- CHANGELOG entries land in the same PR as the work.
- Release happens at the end of the cycle (per the user's "vamos deixar a release para o final do plano todo").
- The big architectural shift means more visual regression diffs than usual — expect to update the baseline often during Track 4.x.
