import { INTERVAL_MS } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { AdvancedControlsConfig } from '../components/Chart/AdvancedControls';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';
import { getChartColors } from '../theme';

export { INTERVAL_MS };
export const INTERVAL_MS_MAP = INTERVAL_MS;

export const REQUIRED_KLINES = 40_000;

export const getDefaultMovingAverages = (colorMode: 'light' | 'dark'): MovingAverageConfig[] => {
  const colors = getChartColors(colorMode);
  const ma = colors.ma;
  return [
    { period: 9, type: 'EMA', color: ma[1] ?? '#ff9800', lineWidth: 2, visible: false },
    { period: 10, type: 'EMA', color: ma[3] ?? '#14b8a6', lineWidth: 2, visible: false },
    { period: 20, type: 'EMA', color: ma[4] ?? '#ec4899', lineWidth: 2, visible: false },
    { period: 21, type: 'EMA', color: ma[0] ?? '#2196f3', lineWidth: 2, visible: false },
    { period: 50, type: 'EMA', color: ma[7] ?? '#10b981', lineWidth: 2, visible: false },
    { period: 70, type: 'EMA', color: ma[5] ?? '#eab308', lineWidth: 2, visible: false },
    { period: 100, type: 'EMA', color: ma[2] ?? '#9c27b0', lineWidth: 2, visible: false },
    { period: 200, type: 'EMA', color: colors.bearish, lineWidth: 2, visible: false },
  ];
};

export const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = getDefaultMovingAverages('dark');

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
