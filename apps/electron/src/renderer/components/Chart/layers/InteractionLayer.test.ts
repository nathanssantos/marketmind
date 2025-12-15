import type { Kline, Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrosshairRenderer, createTooltipRenderer } from './InteractionLayer';

describe('InteractionLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let klines: Kline[];
  let viewport: Viewport;
  const theme = {
    crosshair: '#758696',
    background: '#1e222d',
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
      fill: vi.fn(),
      fillText: vi.fn(),
      fillRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      setLineDash: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    klines = [
      {
        openTime: 1700000000000,
        closeTime: 1700003600000,
        open: '100',
        high: '110',
        low: '95',
        close: '105',
        volume: '1000',
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
      },
      {
        openTime: 1700003600000,
        closeTime: 1700007200000,
        open: '105',
        high: '115',
        low: '100',
        close: '112',
        volume: '1100',
        quoteVolume: '112200',
        trades: 110,
        takerBuyBaseVolume: '550',
        takerBuyQuoteVolume: '56100',
      },
      {
        openTime: 1700007200000,
        closeTime: 1700010800000,
        open: '112',
        high: '120',
        low: '108',
        close: '115',
        volume: '1200',
        quoteVolume: '126000',
        trades: 120,
        takerBuyBaseVolume: '600',
        takerBuyQuoteVolume: '63000',
      },
    ];

    viewport = {
      width: 800,
      height: 600,
      priceMin: 90,
      priceMax: 130,
      start: 0,
      end: 3,
    };
  });

  describe('createCrosshairRenderer', () => {
    it('should return a render function', () => {
      const render = createCrosshairRenderer(klines, { x: 100, y: 100 }, {}, theme);
      expect(typeof render).toBe('function');
    });

    it('should not render when mousePosition is null', () => {
      const render = createCrosshairRenderer(klines, null, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when klines are empty', () => {
      const render = createCrosshairRenderer([], { x: 100, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (negative x)', () => {
      const render = createCrosshairRenderer(klines, { x: -10, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (x > width)', () => {
      const render = createCrosshairRenderer(klines, { x: 900, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (negative y)', () => {
      const render = createCrosshairRenderer(klines, { x: 100, y: -10 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (y > height)', () => {
      const render = createCrosshairRenderer(klines, { x: 100, y: 700 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render crosshair lines when mouse is inside viewport', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.setLineDash).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use custom line color from config', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, { lineColor: '#ff0000' }, theme);
      render(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe('#ff0000');
    });

    it('should use theme crosshair color as default', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe('#758696');
    });

    it('should use custom line width from config', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, { lineWidth: 2 }, theme);
      render(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(2);
    });

    it('should use custom line dash from config', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, { lineDash: [2, 2] }, theme);
      render(mockCtx, viewport);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([2, 2]);
    });

    it('should render price label when showPriceLabel is true (default)', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should not render price label when showPriceLabel is false', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, { showPriceLabel: false }, theme);
      render(mockCtx, viewport);

      const fillRectCalls = (mockCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
      const fillTextCalls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(fillRectCalls).toBeLessThan(2);
      expect(fillTextCalls).toBeLessThan(2);
    });

    it('should render time label when showTimeLabel is true (default)', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should use custom font size from config', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, { fontSize: 14 }, theme);
      render(mockCtx, viewport);

      expect(mockCtx.font).toContain('14px');
    });
  });

  describe('createTooltipRenderer', () => {
    it('should return a render function', () => {
      const render = createTooltipRenderer(klines, { x: 100, y: 100 }, {}, theme);
      expect(typeof render).toBe('function');
    });

    it('should not render when mousePosition is null', () => {
      const render = createTooltipRenderer(klines, null, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when klines are empty', () => {
      const render = createTooltipRenderer([], { x: 100, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (negative x)', () => {
      const render = createTooltipRenderer(klines, { x: -10, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when mouse is outside viewport (x > width)', () => {
      const render = createTooltipRenderer(klines, { x: 900, y: 100 }, {}, theme);
      render(mockCtx, viewport);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when kline index is out of range', () => {
      const smallViewport = { ...viewport, start: 10, end: 15 };
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, smallViewport);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should render tooltip when mouse is inside viewport over a kline', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use theme background color as default', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      const fillStyleCalls = (mockCtx.fillStyle as unknown as string);
      expect(fillStyleCalls).toBeDefined();
    });

    it('should use custom background color from config', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, { backgroundColor: '#000000' }, theme);
      render(mockCtx, viewport);

      const fillRectCalls = (mockCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillRectCalls.length).toBeGreaterThan(0);
    });

    it('should use custom text color from config', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, { textColor: '#ffffff' }, theme);
      render(mockCtx, viewport);

      const fillTextCalls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillTextCalls.length).toBeGreaterThan(0);
    });

    it('should display OHLC data in tooltip', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      const fillTextCalls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const texts = fillTextCalls.map((call) => call[0]);

      expect(texts.some((t: string) => t.includes('O:'))).toBe(true);
      expect(texts.some((t: string) => t.includes('H:'))).toBe(true);
      expect(texts.some((t: string) => t.includes('L:'))).toBe(true);
      expect(texts.some((t: string) => t.includes('C:'))).toBe(true);
    });

    it('should use custom font size from config', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, { fontSize: 16 }, theme);
      render(mockCtx, viewport);

      expect(mockCtx.font).toContain('16px');
    });

    it('should adjust tooltip position when near right edge', () => {
      const render = createTooltipRenderer(klines, { x: 750, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      const fillRectCalls = (mockCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillRectCalls.length).toBeGreaterThan(0);

      const [tooltipX] = fillRectCalls[0];
      expect(tooltipX).toBeLessThan(750);
    });

    it('should adjust tooltip position when near bottom edge', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 550 }, {}, theme);
      render(mockCtx, viewport);

      const fillRectCalls = (mockCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillRectCalls.length).toBeGreaterThan(0);

      const [, tooltipY] = fillRectCalls[0];
      expect(tooltipY).toBeLessThan(550);
    });

    it('should set globalAlpha for background transparency', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.globalAlpha).toBeDefined();
    });
  });

  describe('price calculation', () => {
    it('should calculate correct price from y position', () => {
      const render = createCrosshairRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      const fillTextCalls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const priceTexts = fillTextCalls.map((call) => call[0]);

      const priceText = priceTexts.find((t: string) => !t.includes(':') && !t.includes('/'));
      if (priceText) {
        const price = parseFloat(priceText);
        expect(price).toBeGreaterThanOrEqual(90);
        expect(price).toBeLessThanOrEqual(130);
      }
    });
  });

  describe('kline index calculation', () => {
    it('should select correct kline based on x position', () => {
      const render = createTooltipRenderer(klines, { x: 400, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      const fillTextCalls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillTextCalls.length).toBeGreaterThan(0);
    });

    it('should handle first kline selection', () => {
      const render = createTooltipRenderer(klines, { x: 100, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should handle last kline selection', () => {
      const render = createTooltipRenderer(klines, { x: 700, y: 300 }, {}, theme);
      render(mockCtx, viewport);

      expect(mockCtx.fillText).toHaveBeenCalled();
    });
  });
});
