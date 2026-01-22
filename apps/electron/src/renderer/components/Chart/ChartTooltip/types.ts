import type { Kline, MarketEvent, Order, TradingSetup } from '@marketmind/types';

export interface TooltipPositionProps {
  x: number;
  y: number;
  containerWidth?: number;
  containerHeight?: number;
}

export interface MovingAverageData {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  value?: number;
}

export interface MeasurementData {
  klineCount: number;
  priceChange: number;
  percentChange: number;
  startPrice: number;
  endPrice: number;
}

export interface ChartTooltipProps extends TooltipPositionProps {
  kline: Kline | null;
  visible: boolean;
  movingAverage?: MovingAverageData;
  measurement?: MeasurementData;
  order?: Order | null;
  currentPrice?: number;
  setup?: TradingSetup | null;
  marketEvent?: MarketEvent | null;
}

export interface TooltipContainerProps {
  left: number;
  top: number;
  minWidth?: number;
  children: React.ReactNode;
}

export const TOOLTIP_CONFIG = {
  width: 220,
  heightDefault: 260,
  heightMeasurement: 120,
  offset: 10,
} as const;
