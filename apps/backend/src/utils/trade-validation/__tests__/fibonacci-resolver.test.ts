import { describe, expect, it } from 'vitest';
import { resolveFibonacciTarget } from '../fibonacci-resolver';

describe('resolveFibonacciTarget', () => {
  const createFibProjection = (levels: Array<{ level: number; price: number }>, primaryLevel: number) => ({
    levels,
    primaryLevel,
  });

  describe('LONG positions', () => {
    it('should resolve target using auto (primary level)', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1, price: 105 },
          { level: 1.272, price: 110 },
          { level: 1.618, price: 115 },
        ], 1.272),
        entryPrice: 100,
        direction: 'LONG',
        targetLevel: 'auto',
      });

      expect(result.price).toBe(110);
      expect(result.level).toBe(1.272);
      expect(result.source).toBe('fibonacci');
    });

    it('should resolve target using specific level', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1, price: 105 },
          { level: 1.272, price: 110 },
          { level: 1.618, price: 115 },
        ], 1.272),
        entryPrice: 100,
        direction: 'LONG',
        targetLevel: '1.618',
      });

      expect(result.price).toBe(115);
      expect(result.level).toBe(1.618);
      expect(result.source).toBe('fibonacci');
    });

    it('should fallback to 1.618 when target level not found', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1.618, price: 115 },
        ], 2.618),
        entryPrice: 100,
        direction: 'LONG',
        targetLevel: 'auto',
      });

      expect(result.price).toBe(115);
      expect(result.level).toBe(1.618);
      expect(result.source).toBe('fallback-1.618');
    });

    it('should return none when target is below entry for LONG', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1.618, price: 95 },
        ], 1.618),
        entryPrice: 100,
        direction: 'LONG',
        targetLevel: 'auto',
      });

      expect(result.price).toBeNull();
      expect(result.source).toBe('none');
    });
  });

  describe('SHORT positions', () => {
    it('should resolve target correctly for SHORT', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1.618, price: 85 },
        ], 1.618),
        entryPrice: 100,
        direction: 'SHORT',
        targetLevel: 'auto',
      });

      expect(result.price).toBe(85);
      expect(result.level).toBe(1.618);
      expect(result.source).toBe('fibonacci');
    });

    it('should return none when target is above entry for SHORT', () => {
      const result = resolveFibonacciTarget({
        fibonacciProjection: createFibProjection([
          { level: 1.618, price: 115 },
        ], 1.618),
        entryPrice: 100,
        direction: 'SHORT',
        targetLevel: 'auto',
      });

      expect(result.price).toBeNull();
      expect(result.source).toBe('none');
    });
  });

  it('should return none when no fibonacci projection', () => {
    const result = resolveFibonacciTarget({
      fibonacciProjection: null,
      entryPrice: 100,
      direction: 'LONG',
    });

    expect(result.price).toBeNull();
    expect(result.level).toBeNull();
    expect(result.source).toBe('none');
  });

  it('should return none when levels array is empty', () => {
    const result = resolveFibonacciTarget({
      fibonacciProjection: createFibProjection([], 1.618),
      entryPrice: 100,
      direction: 'LONG',
    });

    expect(result.price).toBeNull();
    expect(result.source).toBe('none');
  });

  it('should use level tolerance for matching', () => {
    const result = resolveFibonacciTarget({
      fibonacciProjection: createFibProjection([
        { level: 1.6179, price: 115 },
      ], 1.618),
      entryPrice: 100,
      direction: 'LONG',
      targetLevel: '1.618',
    });

    expect(result.price).toBe(115);
    expect(result.source).toBe('fibonacci');
  });
});
