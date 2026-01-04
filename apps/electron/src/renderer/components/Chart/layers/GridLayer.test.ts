import type { Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGridRenderer } from './GridLayer';

describe('GridLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let klines: unknown[];
  let viewport: Viewport;
  const theme = {
    grid: '#363a45',
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
      setLineDash: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    klines = Array(100).fill({});

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

  describe('createGridRenderer', () => {
    it('should create a renderer function', () => {
      const renderer = createGridRenderer(klines, {}, theme);
      expect(typeof renderer).toBe('function');
    });

    it('should render grid with default settings', () => {
      const renderer = createGridRenderer(klines, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.setLineDash).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should not render when both lines are disabled', () => {
      const config = { showHorizontalLines: false, showVerticalLines: false };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render only horizontal lines when vertical disabled', () => {
      const config = { showVerticalLines: false };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should render only vertical lines when horizontal disabled', () => {
      const config = { showHorizontalLines: false };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should use custom line color', () => {
      const config = { lineColor: '#ff0000' };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe('#ff0000');
    });

    it('should use custom line width', () => {
      const config = { lineWidth: 2 };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(2);
    });

    it('should use custom line dash pattern', () => {
      const config = { lineDash: [5, 5] };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([5, 5]);
    });

    it('should use custom price steps', () => {
      const config = { priceSteps: 10 };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should use custom time steps', () => {
      const config = { timeSteps: 5 };
      const renderer = createGridRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should not render vertical lines when klines is empty', () => {
      const renderer = createGridRenderer([], { showHorizontalLines: false }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    it('should handle viewport with negative start', () => {
      const renderer = createGridRenderer(klines, {}, theme);
      renderer(mockCtx, { ...viewport, start: -10, end: 50 });

      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should handle viewport exceeding klines length', () => {
      const renderer = createGridRenderer(klines, {}, theme);
      renderer(mockCtx, { ...viewport, start: 90, end: 150 });

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });
});
