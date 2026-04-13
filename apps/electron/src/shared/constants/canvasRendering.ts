export const CANVAS_EDGE_PADDING = 10;
export const SELECTION_WIDTH_BOOST = 0.5;

export const CANVAS_FONTS = {
  SMALL: '10px monospace',
  NORMAL: '11px monospace',
  LABEL: '10px sans-serif',
} as const;

export const LINE_DASHES = {
  ZONE: [2, 2],
  STANDARD: [6, 4],
  RULER: [6, 3],
  FIBONACCI: [4, 4],
  FIBONACCI_SWING: [2, 4],
} as const;

export const FILL_OPACITY = {
  RECTANGLE: 0.08,
  CHANNEL: 0.06,
  ELLIPSE: 0.08,
  AREA: 0.1,
  PRICE_RANGE: 0.15,
} as const;

export const TRADING_COLORS = {
  PROFIT: '#26A69A',
  PROFIT_FILL: 'rgba(38, 166, 154, 0.15)',
  LOSS: '#EF5350',
  LOSS_FILL: 'rgba(239, 83, 80, 0.15)',
  LABEL_TEXT: '#E0E0E0',
} as const;
