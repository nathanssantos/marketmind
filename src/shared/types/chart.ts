export type ChartType = 'candlestick' | 'line';

export interface MovingAverage {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  visible: boolean;
}

export interface ChartConfig {
  type: ChartType;
  showVolume: boolean;
  showGrid: boolean;
  movingAverages: MovingAverage[];
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
  candleWidth: number;
  candleSpacing: number;
}
