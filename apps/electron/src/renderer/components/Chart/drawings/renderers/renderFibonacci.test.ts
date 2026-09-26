import { describe, expect, it, vi } from 'vitest';
import type { CoordinateMapper, FibonacciDrawing } from '@marketmind/chart-studies';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';

vi.mock('@renderer/utils/canvas/canvasHelpers', () => ({
  resolveDrawingIndex: (storedIndex: number) => storedIndex,
}));

import { renderFibonacci } from './renderFibonacci';

const KEY_LEVEL_COLOR = 'rgb(240, 240, 240)';
const GOLDEN_COLOR = 'rgb(255, 200, 0)';
const LEVEL_COLORS = {
  level0: 'rgb(1, 0, 0)',
  level236: 'rgb(2, 0, 0)',
  level382: 'rgb(3, 0, 0)',
  level50: 'rgb(4, 0, 0)',
  level618: 'rgb(5, 0, 0)',
  level786: 'rgb(6, 0, 0)',
  level100: 'rgb(7, 0, 0)',
};

const mapper: CoordinateMapper = {
  priceToY: (price: number) => 1000 - price,
  yToPrice: (y: number) => 1000 - y,
  indexToX: (index: number) => index * 10,
  xToIndex: (x: number) => x / 10,
  indexToCenterX: (index: number) => index * 10,
  timeToIndex: () => -1,
  getKlineTime: () => undefined,
};

const themeColors = {
  fibonacci: LEVEL_COLORS,
  drawing: { fibKeyLevel: KEY_LEVEL_COLOR, fibGolden: GOLDEN_COLOR },
} as unknown as ChartThemeColors;

const drawing: FibonacciDrawing = {
  id: 'fib-1',
  type: 'fibonacci',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
  swingLowIndex: 10,
  swingLowPrice: 100,
  swingHighIndex: 40,
  swingHighPrice: 200,
  direction: 'up',
  levels: [
    { level: 0, label: '0.0%', price: 100 },
    { level: 0.236, label: '23.6%', price: 123.6 },
    { level: 0.382, label: '38.2%', price: 138.2 },
    { level: 0.5, label: '50.0%', price: 150 },
    { level: 0.618, label: '61.8%', price: 161.8 },
    { level: 0.786, label: '78.6%', price: 178.6 },
    { level: 1, label: '100.0%', price: 200 },
    { level: 1.618, label: '161.8%', price: 261.8 },
  ],
};

const strokeColorsByLabel = (): Map<string, string> => {
  const colors = new Map<string, string>();
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn((text: string) => {
      colors.set(text.split(' ')[0] ?? text, ctx.fillStyle);
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'middle',
  };
  renderFibonacci(ctx as unknown as CanvasRenderingContext2D, drawing, mapper, false, 1000, 800, themeColors);
  return colors;
};

describe('renderFibonacci key levels', () => {
  it('highlights 0%, 38.2% and 100% with the key-level color', () => {
    const colors = strokeColorsByLabel();
    expect(colors.get('0.0%')).toBe(KEY_LEVEL_COLOR);
    expect(colors.get('38.2%')).toBe(KEY_LEVEL_COLOR);
    expect(colors.get('100.0%')).toBe(KEY_LEVEL_COLOR);
  });

  it('draws 50% with its own level color like the other secondary levels', () => {
    const colors = strokeColorsByLabel();
    expect(colors.get('50.0%')).toBe(LEVEL_COLORS.level50);
    expect(colors.get('23.6%')).toBe(LEVEL_COLORS.level236);
    expect(colors.get('61.8%')).toBe(LEVEL_COLORS.level618);
    expect(colors.get('78.6%')).toBe(LEVEL_COLORS.level786);
  });

  it('keeps the golden 161.8% color', () => {
    expect(strokeColorsByLabel().get('161.8%')).toBe(GOLDEN_COLOR);
  });
});
