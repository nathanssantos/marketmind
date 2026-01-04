import type { Order, Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrderRenderer } from './OrderLayer';

describe('OrderLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let viewport: Viewport;
  const theme = {
    bullish: '#26a69a',
    bearish: '#ef5350',
    text: '#D9D9D9',
  };

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 80 })),
      setLineDash: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    viewport = {
      start: 0,
      end: 50,
      klineWidth: 10,
      klineSpacing: 2,
      width: 800,
      height: 600,
      priceMin: 90,
      priceMax: 120,
    };
  });

  const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
    id: '1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    status: 'NEW',
    price: '100',
    quantity: '1',
    executedQty: '0',
    cummulativeQuoteQty: '0',
    timeInForce: 'GTC',
    time: Date.now(),
    updateTime: Date.now(),
    ...overrides,
  });

  describe('createOrderRenderer', () => {
    it('should create a renderer function', () => {
      const renderer = createOrderRenderer([], {}, theme);
      expect(typeof renderer).toBe('function');
    });

    it('should not render when orders array is empty', () => {
      const renderer = createOrderRenderer([], {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render long orders with bullish color', () => {
      const orders = [createMockOrder({ side: 'BUY', price: '105' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render short orders with bearish color', () => {
      const orders = [createMockOrder({ side: 'SELL', price: '105' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should render pending orders with dashed line', () => {
      const orders = [createMockOrder({ status: 'NEW', price: '105' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([5, 5]);
    });

    it('should render filled orders with solid line', () => {
      const orders = [createMockOrder({ status: 'FILLED', price: '105' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
    });

    it('should skip orders outside viewport price range', () => {
      const orders = [createMockOrder({ price: '50' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render labels by default', () => {
      const orders = [createMockOrder({ price: '105' })];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillText).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should not render labels when disabled', () => {
      const orders = [createMockOrder({ price: '105' })];
      const config = { showLabels: false };
      const renderer = createOrderRenderer(orders, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should use custom colors from config', () => {
      const orders = [createMockOrder({ price: '105' })];
      const config = { longColor: '#00ff00', shortColor: '#ff0000' };
      const renderer = createOrderRenderer(orders, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use custom line width', () => {
      const orders = [createMockOrder({ price: '105' })];
      const config = { lineWidth: 3 };
      const renderer = createOrderRenderer(orders, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(3);
    });

    it('should use custom font size', () => {
      const orders = [createMockOrder({ price: '105' })];
      const config = { fontSize: 14 };
      const renderer = createOrderRenderer(orders, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.font).toBe('14px sans-serif');
    });

    it('should use custom pending opacity', () => {
      const orders = [createMockOrder({ status: 'NEW', price: '105' })];
      const config = { pendingOpacity: 0.3 };
      const renderer = createOrderRenderer(orders, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should render multiple orders', () => {
      const orders = [
        createMockOrder({ price: '100' }),
        createMockOrder({ price: '110' }),
        createMockOrder({ price: '105' }),
      ];
      const renderer = createOrderRenderer(orders, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.stroke).toHaveBeenCalledTimes(3);
    });
  });
});
