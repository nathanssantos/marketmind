import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCanvas,
  drawCandle,
  drawGrid,
  drawLine,
  drawRect,
  drawText,
  setupCanvas,
} from './drawingUtils';

describe('drawingUtils', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'top' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;
    
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
  });

  describe('clearCanvas', () => {
    it('should clear entire canvas', () => {
      clearCanvas(ctx, 800, 600);
      
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('drawRect', () => {
    it('should draw rectangle with correct style', () => {
      drawRect(ctx, 10, 20, 100, 50, '#ff0000');
      
      expect(ctx.fillStyle).toBe('#ff0000');
      expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    });
  });

  describe('drawLine', () => {
    it('should draw line with default width', () => {
      drawLine(ctx, 0, 0, 100, 100, '#00ff00');
      
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe('#00ff00');
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
      expect(ctx.lineTo).toHaveBeenCalledWith(100, 100);
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should draw line with custom width', () => {
      drawLine(ctx, 0, 0, 100, 100, '#0000ff', 3);
      
      expect(ctx.lineWidth).toBe(3);
    });
  });

  describe('drawText', () => {
    it('should draw text with default settings', () => {
      drawText(ctx, 'Hello', 10, 20, '#000000');
      
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.fillStyle).toBe('#000000');
      expect(ctx.font).toBe('12px sans-serif');
      expect(ctx.textAlign).toBe('left');
      expect(ctx.textBaseline).toBe('top');
      expect(ctx.fillText).toHaveBeenCalledWith('Hello', 10, 20);
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should draw text with custom settings', () => {
      drawText(ctx, 'World', 50, 100, '#ffffff', '16px Arial', 'center', 'middle');
      
      expect(ctx.font).toBe('16px Arial');
      expect(ctx.textAlign).toBe('center');
      expect(ctx.textBaseline).toBe('middle');
      expect(ctx.fillText).toHaveBeenCalledWith('World', 50, 100);
    });
  });

  describe('drawCandle', () => {
    it('should draw bullish candle', () => {
      const x = 100;
      const openY = 200;
      const closeY = 150;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;
      const bullishColor = '#00ff00';
      const bearishColor = '#ff0000';

      drawCandle(ctx, x, openY, closeY, highY, lowY, width, wickWidth, bullishColor, bearishColor);
      
      expect(ctx.fillStyle).toContain('00ff00');
    });

    it('should draw bearish candle', () => {
      const x = 100;
      const openY = 150;
      const closeY = 200;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;
      const bullishColor = '#00ff00';
      const bearishColor = '#ff0000';

      drawCandle(ctx, x, openY, closeY, highY, lowY, width, wickWidth, bullishColor, bearishColor);
      
      expect(ctx.fillStyle).toContain('ff0000');
    });

    it('should draw doji candle (open equals close)', () => {
      const x = 100;
      const openY = 175;
      const closeY = 175;
      const highY = 150;
      const lowY = 200;
      const width = 10;
      const wickWidth = 1;

      drawCandle(ctx, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000');
      
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('setupCanvas', () => {
    it('should return null if no context', () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null),
      } as unknown as HTMLCanvasElement;

      const result = setupCanvas(mockCanvas);
      
      expect(result).toBeNull();
    });

    it('should return context if no parent', () => {
      const mockCanvas = document.createElement('canvas');
      vi.spyOn(mockCanvas, 'getContext').mockReturnValue(ctx);
      
      const result = setupCanvas(mockCanvas);
      
      expect(result).toBe(ctx);
    });

    it('should setup canvas with device pixel ratio', () => {
      const parent = document.createElement('div');
      Object.defineProperty(parent, 'getBoundingClientRect', {
        value: () => ({ width: 800, height: 600 }),
      });
      
      parent.appendChild(canvas);

      const result = setupCanvas(canvas, 2);
      
      expect(result).not.toBeNull();
      expect(canvas.width).toBe(1600);
      expect(canvas.height).toBe(1200);
      expect(canvas.style.width).toBe('800px');
      expect(canvas.style.height).toBe('600px');
    });

    it('should use default device pixel ratio', () => {
      const parent = document.createElement('div');
      Object.defineProperty(parent, 'getBoundingClientRect', {
        value: () => ({ width: 400, height: 300 }),
      });
      
      parent.appendChild(canvas);

      const mockDevicePixelRatio = 2;
      Object.defineProperty(window, 'devicePixelRatio', {
        value: mockDevicePixelRatio,
        writable: true,
      });

      setupCanvas(canvas);
      
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });
  });

  describe('drawGrid', () => {
    it('should draw grid with horizontal and vertical lines', () => {
      drawGrid(ctx, 800, 600, 5, 10, '#cccccc');
      
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.strokeStyle).toBe('#cccccc');
      expect(ctx.lineWidth).toBe(1);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should draw grid with custom line width', () => {
      drawGrid(ctx, 800, 600, 3, 5, '#000000', 2);
      
      expect(ctx.lineWidth).toBe(2);
    });

    it('should calculate correct spacing for horizontal lines', () => {
      drawGrid(ctx, 800, 600, 5, 0, '#cccccc');
      
      const horizontalSpacing = 600 / 6;
      expect(ctx.moveTo).toHaveBeenCalledWith(0, horizontalSpacing);
      expect(ctx.lineTo).toHaveBeenCalledWith(800, horizontalSpacing);
    });

    it('should calculate correct spacing for vertical lines', () => {
      drawGrid(ctx, 800, 600, 0, 10, '#cccccc');
      
      const verticalSpacing = 800 / 11;
      expect(ctx.moveTo).toHaveBeenCalledWith(verticalSpacing, 0);
      expect(ctx.lineTo).toHaveBeenCalledWith(verticalSpacing, 600);
    });
  });
});
