export const CHART_CONFIG = {
  DEFAULT_KLINE_WIDTH: 8,
  MIN_KLINE_WIDTH: 2,
  MAX_KLINE_WIDTH: 50,
  KLINE_SPACING: 2,
  CANVAS_PADDING: 40,
  CANVAS_PADDING_LEFT: 10,
  CANVAS_PADDING_RIGHT: 64,
  CANVAS_PADDING_TOP: 10,
  CANVAS_PADDING_BOTTOM: 25,
  CHART_RIGHT_MARGIN: 0,
  VOLUME_HEIGHT_RATIO: 0.25,
  STOCHASTIC_PANEL_HEIGHT: 80,
  RSI_PANEL_HEIGHT: 80,
  GRID_LINE_WIDTH: 1,
  KLINE_WICK_WIDTH: 1,
  CURRENT_PRICE_LINE_WIDTH: 1,
  CURRENT_PRICE_LINE_STYLE: 'solid' as const,
  AXIS_LABEL_FONT: '11px monospace',
  PATTERN_EXTENSION_DISTANCE: 36,
  INITIAL_KLINES_VISIBLE: 100,
  PERCENT_MULTIPLIER: 100,
  PRICE_RANGE_PADDING: 0.5,

  FUTURE_VIEWPORT_EXTENSION: 0.15,
  MIN_FUTURE_KLINES: 5,

  TIME_LABEL_MIN_GAP: 12,

  PANEL_PADDING: 4,
  PANEL_LABEL_OFFSET: 4,

  EVENT_ICON_SIZE: 8,
  EVENT_ROW_HEIGHT: 12,
} as const;

export const INDICATOR_PANEL_HEIGHTS = {
  SMALL: 60,
  STANDARD: 80,
  LARGE: 100,
} as const;

export const PANEL_RENDER_ORDER = [
  'rsi',
  'stochastic',
  'macd',
  'adx',
  'cci',
  'williamsR',
  'stochRsi',
  'cmo',
  'mfi',
  'ultimateOsc',
  'tsi',
  'ppo',
  'roc',
  'ao',
  'aroon',
  'vortex',
  'elderRay',
  'obv',
  'cmf',
  'klinger',
] as const;

export type PanelId = (typeof PANEL_RENDER_ORDER)[number];

export const DEFAULT_MA_PERIODS = [20, 50, 200] as const;

export const LINE_WIDTHS = {
  THIN: 1,
  NORMAL: 1.5,
  THICK: 2,
  HAIRLINE: 0.5,
} as const;

export const FONTS = {
  AXIS_LABEL: '11px monospace',
  PANEL_LABEL: '10px monospace',
} as const;

export const OSCILLATOR_CONFIG = {
  LINE_WIDTH: 1,
  BAR_WIDTH_RATIO: 0.6,
  ZONE_LINE_DASH: [2, 2] as readonly number[],
} as const;

export const PROJECTION_LINE_DASH = [4, 2] as readonly number[];
