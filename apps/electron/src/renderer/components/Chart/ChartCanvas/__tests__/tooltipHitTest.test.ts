import type { Kline, Order } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processTooltipHitTest } from '../tooltipHitTest';
import type { TooltipHitTestParams } from '../tooltipHitTest';

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

const createManager = (overrides: Partial<ReturnType<typeof defaultManager>> = {}) => {
  const mgr = { ...defaultManager(), ...overrides };
  return mgr;
};

const defaultManager = () => ({
  getViewport: () => ({ start: 0, end: 10, klineWidth: 8 }),
  getDimensions: () => ({ width: 800, height: 600, chartWidth: 720, chartHeight: 570 }),
  getBounds: () => ({ minPrice: 45000, maxPrice: 55000, maxVolume: 1000 }),
  indexToX: (i: number) => i * 72,
  priceToY: (p: number) => 600 - ((p - 45000) / 10000) * 570,
  getEventRowY: () => 560,
  getEventRowHeight: () => 20,
});

const createParams = (overrides: Partial<TooltipHitTestParams> = {}): TooltipHitTestParams => ({
  manager: createManager() as never,
  mouseX: 100,
  mouseY: 100,
  rect: { width: 800, height: 600 } as DOMRect,
  klines: [],
  showVolume: false,
  showEventRow: false,
  lastTooltipOrderRef: { current: null },
  getHoveredOrder: () => null,
  getEventAtPosition: () => null,
  hoveredMAIndexRef: { current: undefined },
  setTooltipData: vi.fn(),
  ...overrides,
});

describe('processTooltipHitTest', () => {
  let setTooltipData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setTooltipData = vi.fn();
  });

  it('returns early when dimensions are null', () => {
    const manager = createManager({ getDimensions: () => null as never });
    const params = createParams({ manager: manager as never, setTooltipData });

    processTooltipHitTest(params);
    expect(setTooltipData).not.toHaveBeenCalled();
  });

  it('returns early when bounds are null', () => {
    const manager = createManager({ getBounds: () => null as never });
    const params = createParams({ manager: manager as never, setTooltipData });

    processTooltipHitTest(params);
    expect(setTooltipData).not.toHaveBeenCalled();
  });

  it('hides tooltip when mouse is on price scale', () => {
    const params = createParams({
      mouseX: 750,
      mouseY: 100,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false }),
    );
  });

  it('hides tooltip when mouse is on time scale', () => {
    const params = createParams({
      mouseX: 100,
      mouseY: 580,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false }),
    );
  });

  it('shows event tooltip when hovering event row', () => {
    const mockEvent = { id: 'ev1', type: 'news' };
    const params = createParams({
      mouseX: 100,
      mouseY: 565,
      showEventRow: true,
      getEventAtPosition: () => mockEvent as never,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, marketEvent: mockEvent }),
    );
  });

  it('shows order tooltip when hovering an order', () => {
    const mockOrder = { id: 'order-1', symbol: 'BTCUSDT' } as unknown as Order;
    const klines = [makeMockKline(50000, 51000, 49000, 50500, 100)];
    const params = createParams({
      klines,
      getHoveredOrder: () => mockOrder,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, order: mockOrder }),
    );
  });

  it('hides tooltip when order is no longer hovered', () => {
    const lastTooltipOrderRef = { current: 'order-1' };
    const params = createParams({
      getHoveredOrder: () => null,
      lastTooltipOrderRef,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false }),
    );
    expect(lastTooltipOrderRef.current).toBeNull();
  });

  it('does not re-fire tooltip for same hovered order', () => {
    const mockOrder = { id: 'order-1' } as unknown as Order;
    const klines = [makeMockKline(50000, 51000, 49000, 50500, 100)];
    const lastTooltipOrderRef = { current: 'order-1' };
    const params = createParams({
      klines,
      getHoveredOrder: () => mockOrder,
      lastTooltipOrderRef,
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).not.toHaveBeenCalled();
  });

  it('shows kline tooltip when hovering a kline body', () => {
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
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, kline, klineIndex: 0 }),
    );
  });

  it('hides tooltip when hovering empty chart space', () => {
    const kline = makeMockKline(50000, 51000, 49000, 50500, 100);
    const manager = createManager({
      priceToY: () => 50,
    });

    const params = createParams({
      manager: manager as never,
      mouseX: 36,
      mouseY: 400,
      klines: [kline],
      setTooltipData,
    });

    processTooltipHitTest(params);
    expect(setTooltipData).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false }),
    );
  });
});
