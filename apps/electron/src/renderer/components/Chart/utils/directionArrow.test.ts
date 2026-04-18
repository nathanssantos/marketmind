import { describe, expect, it } from 'vitest';
import { getDirectionArrow } from './directionArrow';

describe('getDirectionArrow', () => {
  it('returns ↑ for LONG when not flipped', () => {
    expect(getDirectionArrow(true, false)).toBe('↑');
  });

  it('returns ↓ for SHORT when not flipped', () => {
    expect(getDirectionArrow(false, false)).toBe('↓');
  });

  it('inverts to ↓ for LONG when flipped (visual direction follows the inverted Y axis)', () => {
    expect(getDirectionArrow(true, true)).toBe('↓');
  });

  it('inverts to ↑ for SHORT when flipped', () => {
    expect(getDirectionArrow(false, true)).toBe('↑');
  });
});
