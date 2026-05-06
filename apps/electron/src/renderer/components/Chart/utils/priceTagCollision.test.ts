import { describe, expect, it } from 'vitest';
import { resolvePriceTagCollisions, PRICE_TAG_HEIGHT } from './priceTagCollision';

describe('resolvePriceTagCollisions', () => {
  it('returns empty array for no tags', () => {
    expect(resolvePriceTagCollisions({ tags: [], chartHeight: 600 })).toEqual([]);
  });

  it('keeps non-overlapping tags untouched', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: 100, height: PRICE_TAG_HEIGHT },
        { y: 300, height: PRICE_TAG_HEIGHT },
        { y: 500, height: PRICE_TAG_HEIGHT },
      ],
      chartHeight: 600,
    });
    expect(result).toEqual([100, 300, 500]);
  });

  it('pushes overlapping tags down with gap', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: 100, height: 18 },
        { y: 105, height: 18 },
      ],
      chartHeight: 600,
    });
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(100 + 18 + 2);
  });

  it('cascades multiple overlapping tags', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: 100, height: 18 },
        { y: 100, height: 18 },
        { y: 100, height: 18 },
      ],
      chartHeight: 600,
    });
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(100 + 20);
    expect(result[2]).toBe(100 + 40);
  });

  it('preserves input order in output array', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: 300, height: 18 },
        { y: 100, height: 18 },
        { y: 500, height: 18 },
      ],
      chartHeight: 600,
    });
    expect(result[0]).toBe(300);
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(500);
  });

  it('treats fixedAnchor as immovable, pushes others away', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: 200, height: 18 },
      ],
      fixedAnchor: { y: 200, height: 34 },
      chartHeight: 600,
    });
    expect(result[0]!).toBeGreaterThanOrEqual(200 + 34 / 2 + 2 + 18 / 2);
  });

  it('clamps tags inside chart bounds', () => {
    const result = resolvePriceTagCollisions({
      tags: [
        { y: -5, height: 18 },
        { y: 605, height: 18 },
      ],
      chartHeight: 600,
    });
    expect(result[0]).toBe(9);
    expect(result[1]).toBe(591);
  });
});
