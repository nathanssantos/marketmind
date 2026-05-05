import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORDER_LINE_LAYOUT } from '@shared/constants';
import { drawPriceTag, getReadableTextColor } from './priceTagUtils';

describe('getReadableTextColor', () => {
  it('returns black for light backgrounds', () => {
    expect(getReadableTextColor('#ffffff')).toBe('#000000');
    expect(getReadableTextColor('#cccccc')).toBe('#000000');
    expect(getReadableTextColor('#ffff00')).toBe('#000000'); // saturated yellow
    expect(getReadableTextColor('#00ffff')).toBe('#000000'); // saturated cyan
    expect(getReadableTextColor('#00ff00')).toBe('#000000'); // pure green has high luminance
  });

  it('returns white for dark / mid backgrounds', () => {
    expect(getReadableTextColor('#000000')).toBe('#ffffff');
    expect(getReadableTextColor('#333333')).toBe('#ffffff');
    expect(getReadableTextColor('#ff0000')).toBe('#ffffff'); // saturated red
    expect(getReadableTextColor('#0000ff')).toBe('#ffffff');
  });

  it('handles short hex (#fff / #000)', () => {
    expect(getReadableTextColor('#fff')).toBe('#000000');
    expect(getReadableTextColor('#000')).toBe('#ffffff');
  });

  it('handles rgb() and rgba() syntax', () => {
    expect(getReadableTextColor('rgb(255, 255, 255)')).toBe('#000000');
    expect(getReadableTextColor('rgba(20, 20, 20, 0.9)')).toBe('#ffffff');
  });

  it('falls back to white for unparseable input', () => {
    expect(getReadableTextColor('papayawhip')).toBe('#ffffff');
    expect(getReadableTextColor('hsl(0, 100%, 50%)')).toBe('#ffffff');
    expect(getReadableTextColor('not-a-color')).toBe('#ffffff');
  });
});

describe('drawPriceTag — dynamic text color', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
  });

  it('uses dark text on a light fill when textColor is omitted', () => {
    drawPriceTag(ctx, '12345.67', 100, 500, '#ffffff');
    // Last fillStyle assignment is the text color
    expect(ctx.fillStyle).toBe('#000000');
  });

  it('uses light text on a dark fill when textColor is omitted', () => {
    drawPriceTag(ctx, '12345.67', 100, 500, '#1a1a2e');
    expect(ctx.fillStyle).toBe('#ffffff');
  });

  it('respects an explicit textColor override on a light fill', () => {
    drawPriceTag(ctx, '12345.67', 100, 500, '#ffffff', 64, '#ff00ff');
    expect(ctx.fillStyle).toBe('#ff00ff');
  });
});

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
        arcTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D;
    });

    it('should draw a price tag with default width', () => {
      const result = drawPriceTag(ctx, '100.50', 200, 100, 'rgba(34, 197, 94, 0.9)');

      expect(result).toEqual({ width: 64, height: 18 });
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should draw a price tag with custom width', () => {
      const customWidth = 100;
      const result = drawPriceTag(ctx, '99.99', 150, 50, 'rgba(239, 68, 68, 0.9)', customWidth);

      expect(result).toEqual({ width: 100, height: 18 });
      expect(ctx.fillText).toHaveBeenCalledWith('99.99', 50 + ORDER_LINE_LAYOUT.LABEL_PADDING, 150 + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
    });

    it('should return correct dimensions for standard width (72px)', () => {
      const result = drawPriceTag(ctx, '1234.56', 100, 200, 'rgba(59, 130, 246, 0.9)', 72);

      expect(result.width).toBe(72);
      expect(result.height).toBe(18);
    });

    it('should handle different price formats', () => {
      const result1 = drawPriceTag(ctx, '0.01', 100, 100, 'rgba(0, 0, 0, 0.9)');
      expect(result1).toEqual({ width: 64, height: 18 });

      const result2 = drawPriceTag(ctx, '99999.99', 100, 100, 'rgba(0, 0, 0, 0.9)');
      expect(result2).toEqual({ width: 64, height: 18 });
    });

    it('should return the fixed width unchanged (no arrow)', () => {
      const fixedWidth = 72;
      const result = drawPriceTag(ctx, '123.45', 200, 100, 'rgba(0, 0, 0, 0.9)', fixedWidth);

      expect(result.width).toBe(fixedWidth);
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
        expect(result.width).toBe(width);
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

      expect(result1).toEqual({ width: 64, height: 18 });
      expect(result2).toEqual({ width: 64, height: 18 });
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
        expect(result).toEqual({ width: 64, height: 18 });
      });
    });

    it('should use rounded rectangle path (arcTo) instead of arrow', () => {
      drawPriceTag(ctx, '50.00', 200, 100, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.arcTo).toHaveBeenCalled();
    });

    it('should render text with correct padding', () => {
      const x = 100;
      const y = 200;
      const labelPadding = ORDER_LINE_LAYOUT.LABEL_PADDING;

      drawPriceTag(ctx, '123.45', y, x, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.fillText).toHaveBeenCalledWith('123.45', x + labelPadding, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
    });

    it('should set fill style to white for text on a dark fill', () => {
      drawPriceTag(ctx, '100.00', 100, 100, 'rgba(0, 0, 0, 0.9)');

      expect(ctx.fillStyle).toBe('#ffffff');
    });
  });
});
