import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { AdvancedControlsConfig } from '../components/Chart/AdvancedControls';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';

export const REQUIRED_KLINES = 40_000;

export const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 21,
    type: 'EMA',
    color: '#2196f3',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 50,
    type: 'EMA',
    color: '#4caf50',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 70,
    type: 'EMA',
    color: '#00bcd4',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 100,
    type: 'EMA',
    color: '#9c27b0',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 200,
    type: 'EMA',
    color: '#f44336',
    lineWidth: 2,
    visible: false,
  },
];

export const DEFAULT_ADVANCED_CONFIG: AdvancedControlsConfig = {
  rightMargin: CHART_CONFIG.CHART_RIGHT_MARGIN,
  volumeHeightRatio: CHART_CONFIG.VOLUME_HEIGHT_RATIO,
  klineSpacing: CHART_CONFIG.KLINE_SPACING,
  klineWickWidth: CHART_CONFIG.KLINE_WICK_WIDTH,
  gridLineWidth: CHART_CONFIG.GRID_LINE_WIDTH,
  currentPriceLineWidth: CHART_CONFIG.CURRENT_PRICE_LINE_WIDTH,
  currentPriceLineStyle: CHART_CONFIG.CURRENT_PRICE_LINE_STYLE,
  paddingTop: CHART_CONFIG.CANVAS_PADDING_TOP,
  paddingBottom: CHART_CONFIG.CANVAS_PADDING_BOTTOM,
  paddingLeft: CHART_CONFIG.CANVAS_PADDING_LEFT,
  paddingRight: CHART_CONFIG.CANVAS_PADDING_RIGHT,
};

export const DEFAULT_AUTO_UPDATE_SETTINGS = {
  autoCheckUpdates: true,
  autoDownloadUpdates: true,
  updateCheckInterval: 24,
} as const;

export const MIN_UPDATE_INTERVAL_MS = 100;

export const INTERVAL_MS_MAP: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
} as const;
