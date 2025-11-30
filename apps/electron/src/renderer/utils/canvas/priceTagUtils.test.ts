import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawPriceTag } from './priceTagUtils';

describe('priceTagUtils', () => {
  describe('drawPriceTag', () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D;
    });

    it('should draw a price tag with default width', () => {
      const result = drawPriceTag(ctx, '100.50', 200, 100, 'rgba(34, 197, 94, 0.9)');

      expect(result).toEqual({ width: 78, height: 18 });
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should draw a price tag with custom width', () => {
      const customWidth = 100;
      const result = drawPriceTag(ctx, '99.99', 150, 50, 'rgba(239, 68, 68, 0.9)', customWidth);

      expect(result).toEqual({ width: 106, height: 18 });
      expect(ctx.fillText).toHaveBeenCalledWith('99.99', 58, 150);
    });

    it('should return correct dimensions for standard width (72px)', () => {
      const result = drawPriceTag(ctx, '1234.56', 100, 200, 'rgba(59, 130, 246, 0.9)', 72);

      expect(result.width).toBe(78);
      expect(result.height).toBe(18);
    });

    it('should handle different price formats', () => {
      const result1 = drawPriceTag(ctx, '0.01', 100, 100, 'rgba(0, 0, 0, 0.9)');
      expect(result1).toEqual({ width: 78, height: 18 });

      const result2 = drawPriceTag(ctx, '99999.99', 100, 100, 'rgba(0, 0, 0, 0.9)');
      expect(result2).toEqual({ width: 78, height: 18 });
    });

    it('should calculate correct width including arrow', () => {
      const fixedWidth = 72;
      const arrowWidth = 6;
      const expectedWidth = fixedWidth + arrowWidth;

      const result = drawPriceTag(ctx, '123.45', 200, 100, 'rgba(0, 0, 0, 0.9)', fixedWidth);

      expect(result.width).toBe(expectedWidth);
    });

    it('should always return height of 18px', () => {
      const result1 = drawPriceTag(ctx, '50.00', 100, 100, 'rgba(0, 0, 0, 0.9)');
      const result2 = drawPriceTag(ctx, '999.99', 200, 200, 'rgba(0, 0, 0, 0.9)', 100);

      expect(result1.height).toBe(18);
      expect(result2.height).toBe(18);
    });

    it('should handle various fixed widths correctly', () => {
      const widths = [50, 72, 100, 150];

      widths.forEach((width) => {
        const result = drawPriceTag(ctx, '100.00', 100, 100, 'rgba(0, 0, 0, 0.9)', width);
        expect(result.width).toBe(width + 6);
      });
    });

    it('should execute without errors for valid inputs', () => {
      expect(() => {
        drawPriceTag(ctx, '100.00', 100, 100, 'rgba(0, 0, 0, 0.9)');
      }).not.toThrow();
    });

    it('should handle edge case positions', () => {
      const result1 = drawPriceTag(ctx, '0.00', 0, 0, 'rgba(0, 0, 0, 0.9)');
      const result2 = drawPriceTag(ctx, '999.99', 1000, 1000, 'rgba(0, 0, 0, 0.9)');

      expect(result1).toEqual({ width: 78, height: 18 });
      expect(result2).toEqual({ width: 78, height: 18 });
    });

    it('should work with different color formats', () => {
      const colors = [
        'rgba(34, 197, 94, 0.9)',
        'rgba(239, 68, 68, 0.9)',
        'rgba(59, 130, 246, 0.9)',
        '#22c55e',
      ];

      colors.forEach((color) => {
        const result = drawPriceTag(ctx, '100.00', 100, 100, color);
        expect(result).toEqual({ width: 78, height: 18 });
      });
    });

    it('should draw arrow pointing left at correct position', () => {
      const x = 100;
      const y = 200;
      const arrowWidth = 6;

      drawPriceTag(ctx, '50.00', y, x, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.moveTo).toHaveBeenCalledWith(x - arrowWidth, y);
    });

    it('should render text with correct padding', () => {
      const x = 100;
      const y = 200;
      const labelPadding = 8;

      drawPriceTag(ctx, '123.45', y, x, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.fillText).toHaveBeenCalledWith('123.45', x + labelPadding, y);
    });

    it('should set fill style to white for text', () => {
      drawPriceTag(ctx, '100.00', 100, 100, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.fillStyle).toBe('#ffffff');
    });
  });
});
