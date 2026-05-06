import type { Kline } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processKlineHoverHitTest } from '../klineHoverHitTest';
import type { KlineHoverHitTestParams } from '../klineHoverHitTest';

vi.mock('@shared/constants', () => ({
  CHART_CONFIG: {
    CANVAS_PADDING_RIGHT: 80,
    CANVAS_PADDING_BOTTOM: 30,
    CHART_RIGHT_MARGIN: 10,
    VOLUME_HEIGHT_RATIO: 0.2,
  },
}));

vi.mock('@shared/utils', () => ({
  getKlineOpen: (k: number[]) => k[1],
  getKlineClose: (k: number[]) => k[4],
  getKlineHigh: (k: number[]) => k[2],
  getKlineLow: (k: number[]) => k[3],
  getKlineVolume: (k: number[]) => k[5],
}));

const makeMockKline = (open: number, high: number, low: number, close: number, volume: number): Kline =>
  [Date.now(), open, high, low, close, volume] as unknown as Kline;

const defaultManager = () => ({
  getViewport: () => ({ start: 0, end: 10, klineWidth: 8 }),
  getDimensions: () => ({ width: 800, height: 600, chartWidth: 720, chartHeight: 570 }),
  getBounds: () => ({ minPrice: 45000, maxPrice: 55000, maxVolume: 1000 }),
  indexToX: (i: number) => i * 72,
  priceToY: (p: number) => 600 - ((p - 45000) / 10000) * 570,
});

const createManager = (overrides: Partial<ReturnType<typeof defaultManager>> = {}) => ({
  ...defaultManager(),
  ...overrides,
});

const createParams = (overrides: Partial<KlineHoverHitTestParams> = {}): KlineHoverHitTestParams => ({
  manager: createManager() as never,
  mouseX: 100,
  mouseY: 100,
  klines: [],
  showVolume: false,
  setHoveredKline: vi.fn(),
  ...overrides,
});

describe('processKlineHoverHitTest', () => {
  let setHoveredKline: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setHoveredKline = vi.fn();
  });

  it('returns early when dimensions are null', () => {
    const manager = createManager({ getDimensions: () => null as never });
    const params = createParams({ manager: manager as never, setHoveredKline });

    processKlineHoverHitTest(params);
    expect(setHoveredKline).not.toHaveBeenCalled();
  });

  it('returns early when bounds are null', () => {
    const manager = createManager({ getBounds: () => null as never });
    const params = createParams({ manager: manager as never, setHoveredKline });

    processKlineHoverHitTest(params);
    expect(setHoveredKline).not.toHaveBeenCalled();
  });

  it('clears hover when mouse is on price scale', () => {
    const params = createParams({ mouseX: 750, mouseY: 100, setHoveredKline });
    processKlineHoverHitTest(params);
    expect(setHoveredKline).toHaveBeenCalledWith(null);
  });

  it('clears hover when mouse is on time scale', () => {
    const params = createParams({ mouseX: 100, mouseY: 580, setHoveredKline });
    processKlineHoverHitTest(params);
    expect(setHoveredKline).toHaveBeenCalledWith(null);
  });

  it('sets hover when mouse is on a kline body', () => {
    const kline = makeMockKline(50000, 51000, 49000, 50500, 100);
    const manager = createManager({
      priceToY: (p: number) => {
        if (p === 50000) return 300;
        if (p === 50500) return 270;
        if (p === 51000) return 240;
        if (p === 49000) return 360;
        return 300;
      },
    });

    const params = createParams({
      manager: manager as never,
      mouseX: 36,
      mouseY: 285,
      klines: [kline],
      setHoveredKline,
    });

    processKlineHoverHitTest(params);
    expect(setHoveredKline).toHaveBeenCalledWith(kline, 0);
  });

  it('clears hover when mouse is in empty chart space', () => {
    const kline = makeMockKline(50000, 51000, 49000, 50500, 100);
    const manager = createManager({ priceToY: () => 50 });

    const params = createParams({
      manager: manager as never,
      mouseX: 36,
      mouseY: 400,
      klines: [kline],
      setHoveredKline,
    });

    processKlineHoverHitTest(params);
    expect(setHoveredKline).toHaveBeenCalledWith(null);
  });
});
