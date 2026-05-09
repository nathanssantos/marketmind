 
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearCanvas,
    drawCandleLabel,
    drawGrid,
    drawKline,
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

  describe('drawKline', () => {
    it('should draw bullish kline', () => {
      const x = 100;
      const openY = 200;
      const closeY = 150;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;
      const bullishColor = '#00ff00';
      const bearishColor = '#ff0000';

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, bullishColor, bearishColor);
      
      expect(ctx.fillStyle).toContain('00ff00');
    });

    it('should draw bearish kline', () => {
      const x = 100;
      const openY = 150;
      const closeY = 200;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;
      const bullishColor = '#00ff00';
      const bearishColor = '#ff0000';

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, bullishColor, bearishColor);
      
      expect(ctx.fillStyle).toContain('ff0000');
    });

    it('should draw doji kline (open equals close)', () => {
      const x = 100;
      const openY = 175;
      const closeY = 175;
      const highY = 150;
      const lowY = 200;
      const width = 10;
      const wickWidth = 1;

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000');

      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('renders near-doji bodies (sub-pixel delta) as a wick-thick line, not an invisible sliver', () => {
      // open ≈ close, with a 0.4px delta — fillRect at 0.4px height
      // is rounded to either 0 or 1 device pixel and visually disappears.
      // Behavior should match true-doji: draw a horizontal line at the
      // body's mid Y with thickness = wickWidth.
      const x = 100;
      const openY = 175;
      const closeY = 175.4;
      const highY = 150;
      const lowY = 200;
      const width = 10;
      const wickWidth = 2;

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000');

      // Body must NOT be drawn as a 0.4px-tall fillRect.
      expect(ctx.fillRect).not.toHaveBeenCalledWith(x, expect.any(Number), width, 0.4);
      // The fallback path uses stroke for the body line.
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should apply shadow effect when kline is highlighted', () => {
      const mockCtx = {
        ...ctx,
        shadowColor: '',
        shadowBlur: 0,
      } as CanvasRenderingContext2D;

      const x = 100;
      const openY = 200;
      const closeY = 150;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;
      const bullishColor = '#00ff00';
      const bearishColor = '#ff0000';
      const isHighlighted = true;

      drawKline(mockCtx, x, openY, closeY, highY, lowY, width, wickWidth, bullishColor, bearishColor, isHighlighted);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('uses isBullish parameter when provided (does not infer from screen Y)', () => {
      const x = 100;
      const openY = 150;
      const closeY = 200;
      const highY = 140;
      const lowY = 210;
      const width = 10;
      const wickWidth = 1;

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000', false, true);
      expect(ctx.fillStyle).toContain('00ff00');
    });

    it('preserves color when chart is flipped (Y axis inverted)', () => {
      const x = 100;
      const openY = 150;
      const closeY = 100;
      const highY = 220;
      const lowY = 80;
      const width = 10;
      const wickWidth = 1;

      drawKline(ctx, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000', false, false);
      expect(ctx.fillStyle).toContain('ff0000');
    });

    it('draws both wicks when chart is flipped (highY > lowY in screen space)', () => {
      const ctxSpy = {
        ...ctx,
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        beginPath: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      const x = 100;
      const openY = 160;
      const closeY = 200;
      const highY = 250;
      const lowY = 100;
      const width = 10;
      const wickWidth = 1;

      drawKline(ctxSpy, x, openY, closeY, highY, lowY, width, wickWidth, '#00ff00', '#ff0000', false, true);

      const moveCalls = (ctxSpy.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const wickEndpoints = moveCalls.map((c) => c[1]);
      expect(wickEndpoints).toContain(100);
      expect(wickEndpoints.some((y) => y === 200 || y === 160)).toBe(true);
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

  describe('drawCandleLabel', () => {
    let labelCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      labelCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 40 })),
        fillStyle: '',
        font: '',
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'top' as CanvasTextBaseline,
      } as unknown as CanvasRenderingContext2D;
    });

    it('should draw label with default text color', () => {
      drawCandleLabel(labelCtx, 100, 50, 'LONG', '#00ff00');

      expect(labelCtx.save).toHaveBeenCalled();
      expect(labelCtx.beginPath).toHaveBeenCalled();
      expect(labelCtx.fill).toHaveBeenCalled();
      expect(labelCtx.fillText).toHaveBeenCalled();
      expect(labelCtx.restore).toHaveBeenCalled();
    });

    it('should draw label with custom text color', () => {
      drawCandleLabel(labelCtx, 100, 50, 'SHORT', '#ff0000', '#000000');

      expect(labelCtx.fillStyle).toBe('#000000');
      expect(labelCtx.textAlign).toBe('center');
      expect(labelCtx.textBaseline).toBe('middle');
    });

    it('should draw label with custom font size', () => {
      drawCandleLabel(labelCtx, 100, 50, 'TP', '#0000ff', '#ffffff', 14);

      expect(labelCtx.font).toBe('bold 14px sans-serif');
    });

    it('should measure text to calculate pill width', () => {
      drawCandleLabel(labelCtx, 200, 100, 'ENTRY', '#ffff00');

      expect(labelCtx.measureText).toHaveBeenCalledWith('ENTRY');
    });

    it('should draw rounded rectangle path', () => {
      drawCandleLabel(labelCtx, 150, 75, 'SL', '#ff5500');

      expect(labelCtx.moveTo).toHaveBeenCalled();
      expect(labelCtx.lineTo).toHaveBeenCalled();
      expect(labelCtx.quadraticCurveTo).toHaveBeenCalled();
      expect(labelCtx.closePath).toHaveBeenCalled();
    });

    it('should position label above the y coordinate', () => {
      const fillTextCalls: unknown[][] = [];
      labelCtx.fillText = vi.fn((...args) => fillTextCalls.push(args));

      drawCandleLabel(labelCtx, 100, 50, 'LONG', '#00ff00');

      expect(fillTextCalls.length).toBe(1);
      const [, x, y] = fillTextCalls[0] as [string, number, number];
      expect(x).toBe(100);
      expect(y).toBeLessThan(50);
    });

    it('should use font for measuring text', () => {
      drawCandleLabel(labelCtx, 100, 50, 'TEST', '#00ff00', '#ffffff', 16);

      expect(labelCtx.font).toContain('16px');
    });
  });
});
