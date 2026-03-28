import type { MarketType } from '@marketmind/types';
import type { IndicatorId } from '@renderer/store/indicatorStore';

export type ChartType = 'kline' | 'line' | 'tick' | 'volume' | 'footprint';

export type PanelWindowState = 'normal' | 'minimized' | 'maximized';

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridPanelConfig {
  id: string;
  timeframe: string;
  chartType: ChartType;
  activeIndicators: IndicatorId[];
  indicatorParams: Record<string, unknown>;
  movingAverages: Array<{ period: number; type: 'SMA' | 'EMA'; color: string; lineWidth?: number; visible?: boolean }>;
  gridPosition: GridPosition;
  windowState: PanelWindowState;
  savedGridPosition?: GridPosition;
}

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
  activeLayoutId: string;
  order: number;
}

export interface LayoutState {
  symbolTabs: SymbolTab[];
  activeSymbolTabId: string;
  layoutPresets: LayoutPreset[];
  focusedPanelId: string | null;
}

export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_ROW_HEIGHT = 30;
export const GRID_MARGIN: [number, number] = [4, 4];
export const GRID_CONTAINER_PADDING: [number, number] = [0, 0];
