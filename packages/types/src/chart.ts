export type ChartType = 'kline' | 'line';

export interface ChartConfig {
  type: ChartType;
  showVolume: boolean;
  showGrid: boolean;
  colors: ChartColors;
}

export interface ChartColors {
  bullish: string;
  bearish: string;
  volume: string;
  grid: string;
  background: string;
}

export interface Viewport {
  start: number;
  end: number;
  klineWidth: number;
  klineSpacing: number;
  width: number;
  height: number;
  priceMin: number;
  priceMax: number;
}
