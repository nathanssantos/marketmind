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
  handle: '#ffffff',
  handleStroke: '#2196F3',
  selected: '#2196F3',
} as const;

export const FIBONACCI_DEFAULT_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1,
  1.272, 1.382, 1.618,
  2, 2.618,
  3, 3.618, 4.236,
] as const;
