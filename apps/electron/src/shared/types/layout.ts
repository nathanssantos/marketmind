import type { MarketType } from '@marketmind/types';

export type ChartType = 'kline' | 'line';

export type PanelWindowState = 'normal' | 'minimized' | 'maximized';

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * v1.10 Track 1 — every grid panel is now a discriminated union by `kind`.
 * Charts (the only multi-instance kind) live alongside named single-instance
 * panels (Ticket, Checklist, Orders, Portfolio, Positions, Exposure,
 * Watchers, Indicators, etc.) — the migration from sidebars to grid panels.
 *
 * For backwards compat, persisted layouts saved before v1.10 lack the `kind`
 * field; the store hydration migrator defaults missing `kind` to `'chart'`.
 */
export type PanelKind =
  | 'chart'
  // Trading group
  | 'ticket'
  | 'checklist'
  | 'orders'
  | 'portfolio'
  | 'positions'
  // Market group
  | 'marketIndicators' // legacy aggregate (kept for back-compat with stored layouts)
  | 'marketFearGreed'
  | 'marketBtcDominance'
  | 'marketMvrv'
  | 'marketProductionCost'
  | 'marketOpenInterest'
  | 'marketLongShort'
  // Auto-Trading group
  | 'watchers'
  | 'autoTradingSetup'
  | 'autoTradingActivity'
  // Order Flow group
  | 'orderBook'
  | 'orderFlowMetrics';

interface BaseGridPanel {
  id: string;
  gridPosition: GridPosition;
  windowState: PanelWindowState;
  savedGridPosition?: GridPosition;
}

export interface ChartPanelConfig extends BaseGridPanel {
  kind: 'chart';
  timeframe: string;
  chartType: ChartType;
}

export interface NamedPanelConfig extends BaseGridPanel {
  kind: Exclude<PanelKind, 'chart'>;
}

export type GridPanelConfig = ChartPanelConfig | NamedPanelConfig;

export const isChartPanel = (panel: GridPanelConfig): panel is ChartPanelConfig =>
  panel.kind === 'chart';

export interface LayoutPreset {
  id: string;
  name: string;
  grid: GridPanelConfig[];
  order: number;
}

export interface SymbolTab {
  id: string;
  symbol: string;
  marketType: MarketType;
  /**
   * Legacy field — left optional for migration of pre-v1.5 persisted
   * state. New code reads `LayoutState.activeLayoutId` (global) instead.
   * @deprecated since v1.5; will be dropped after the user-state cycle.
   */
  activeLayoutId?: string;
  order: number;
}

export interface LayoutState {
  symbolTabs: SymbolTab[];
  activeSymbolTabId: string;
  activeLayoutId: string;
  layoutPresets: LayoutPreset[];
  focusedPanelId: string | null;
  /**
   * v1.5 — when true, the grid surface allows drag/resize/close on
   * panels. When false, panels are locked in place (handles hidden,
   * close suppressed). Session-only — not persisted.
   */
  gridEditMode: boolean;
}

export const DEFAULT_GRID_COLS = 192;
export const DEFAULT_ROW_HEIGHT = 8;
export const GRID_MARGIN: [number, number] = [4, 4];
export const GRID_CONTAINER_PADDING: [number, number] = [0, 0];

/**
 * Bump this when the grid coordinate scale changes. Persisted state below
 * this version is migrated on hydrate (see `layoutStore.hydrateLayoutStore`).
 *
 * v1 → v2 (2026-05): cols 12 → 192, rowHeight 30 → 8. Both axes now share
 * a ~1:1 cell granularity (column unit width ≈ rowHeight at typical desktop
 * viewports of 1280–1920px). Migration scales x/w by 16 and y/h by 4 so
 * panels keep roughly the same visual size.
 */
export const GRID_VERSION = 2;
