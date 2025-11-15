import type { ChartColors } from '../types';

export const CHART_CONFIG = {
  DEFAULT_CANDLE_WIDTH: 8,
  MIN_CANDLE_WIDTH: 2,
  MAX_CANDLE_WIDTH: 50,
  CANDLE_SPACING: 2,
  CANVAS_PADDING: 40,
  CANVAS_PADDING_LEFT: 10,
  CANVAS_PADDING_RIGHT: 80,
  CANVAS_PADDING_TOP: 10,
  CANVAS_PADDING_BOTTOM: 25,
  CHART_RIGHT_MARGIN: 72,
  VOLUME_HEIGHT_RATIO: 0.25,
  GRID_LINE_WIDTH: 1,
  CANDLE_WICK_WIDTH: 1,
  AXIS_LABEL_FONT: '11px monospace',
  AXIS_LABEL_COLOR_DARK: 'rgba(200, 200, 200, 0.8)',
  AXIS_LABEL_COLOR_LIGHT: 'rgba(60, 60, 60, 0.8)',
} as const;

export const CHART_COLORS_DARK: ChartColors = {
  bullish: '#26a69a',
  bearish: '#ef5350',
  volume: 'rgba(120, 120, 120, 0.5)',
  grid: 'rgba(42, 46, 57, 0.5)',
  background: '#1e222d',
};

export const CHART_COLORS_LIGHT: ChartColors = {
  bullish: '#26a69a',
  bearish: '#ef5350',
  volume: 'rgba(120, 120, 120, 0.3)',
  grid: 'rgba(200, 200, 200, 0.5)',
  background: '#ffffff',
};

export const DEFAULT_MA_PERIODS = [20, 50, 200] as const;

export const MA_COLORS = ['#2196f3', '#ff9800', '#9c27b0'] as const;
