export const HIT_THRESHOLD = 8;
export const HANDLE_RADIUS = 5;
export const HANDLE_HIT_RADIUS = 10;
export const PENCIL_HIT_THRESHOLD = 6;

export const DRAWING_COLORS = {
  line: '#2196F3',
  rectangle: '#9C27B0',
  pencil: '#FF9800',
  fibonacci: 'rgba(180, 180, 180, 0.7)',
  ruler: '#64748B',
  area: '#64748B',
  arrow: '#2196F3',
  ray: '#FF9800',
  horizontalLine: '#26A69A',
  channel: '#AB47BC',
  trendLine: '#2196F3',
  priceRange: '#26A69A',
  verticalLine: '#26A69A',
  anchoredVwap: '#E91E63',
  highlighter: '#FFEB3B',
  ellipse: '#9C27B0',
  pitchfork: '#F44336',
  gannFan: '#03A9F4',
  text: '#ffffff',
  handle: '#ffffff',
  handleStroke: '#2196F3',
  selected: '#2196F3',
} as const;

export const DEFAULT_LINE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 14;

export const GANN_ANGLES = [
  { ratio: '1x8', slope: 1/8 },
  { ratio: '1x4', slope: 1/4 },
  { ratio: '1x3', slope: 1/3 },
  { ratio: '1x2', slope: 1/2 },
  { ratio: '1x1', slope: 1 },
  { ratio: '2x1', slope: 2 },
  { ratio: '3x1', slope: 3 },
  { ratio: '4x1', slope: 4 },
  { ratio: '8x1', slope: 8 },
] as const;

export const FIBONACCI_DEFAULT_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1,
  1.272, 1.382, 1.618,
  2, 2.618,
  3, 3.618, 4.236,
] as const;
