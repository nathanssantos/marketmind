import { describe, expect, it } from 'vitest';
import {
  clampFontSizeIndex,
  fontSizeForIndex,
  isScrolledToBottom,
  LOGS_TAB_DEFAULT_FONT_SIZE_INDEX,
  LOGS_TAB_FONT_SIZE_STEPS,
} from './logsTabUtils';

describe('LOGS_TAB_FONT_SIZE_STEPS', () => {
  it('has the expected step ladder (changing this changes the +/- buttons)', () => {
    expect([...LOGS_TAB_FONT_SIZE_STEPS]).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('default index points into the ladder', () => {
    expect(LOGS_TAB_FONT_SIZE_STEPS[LOGS_TAB_DEFAULT_FONT_SIZE_INDEX]).toBeDefined();
  });
});

describe('clampFontSizeIndex', () => {
  it('clamps below 0 to 0', () => {
    expect(clampFontSizeIndex(-5)).toBe(0);
    expect(clampFontSizeIndex(-1)).toBe(0);
  });

  it('clamps above the last index to the last index', () => {
    const max = LOGS_TAB_FONT_SIZE_STEPS.length - 1;
    expect(clampFontSizeIndex(max + 5)).toBe(max);
    expect(clampFontSizeIndex(max + 1)).toBe(max);
  });

  it('returns the input when within range', () => {
    expect(clampFontSizeIndex(0)).toBe(0);
    expect(clampFontSizeIndex(3)).toBe(3);
    expect(clampFontSizeIndex(LOGS_TAB_FONT_SIZE_STEPS.length - 1)).toBe(LOGS_TAB_FONT_SIZE_STEPS.length - 1);
  });
});

describe('fontSizeForIndex', () => {
  it('returns the step at the index', () => {
    expect(fontSizeForIndex(0)).toBe(6);
    expect(fontSizeForIndex(LOGS_TAB_DEFAULT_FONT_SIZE_INDEX)).toBe(12);
    expect(fontSizeForIndex(LOGS_TAB_FONT_SIZE_STEPS.length - 1)).toBe(14);
  });

  it('clamps before lookup (over-the-top → max step)', () => {
    expect(fontSizeForIndex(999)).toBe(14);
    expect(fontSizeForIndex(-5)).toBe(6);
  });
});

describe('isScrolledToBottom', () => {
  it('returns true when the user is exactly at the bottom', () => {
    expect(isScrolledToBottom(900, 1000, 100)).toBe(true);
  });

  it('returns true when within the default 50px threshold', () => {
    expect(isScrolledToBottom(870, 1000, 100)).toBe(true); // 30px above bottom
    expect(isScrolledToBottom(851, 1000, 100)).toBe(true); // 49px above bottom
  });

  it('returns false beyond the threshold', () => {
    expect(isScrolledToBottom(850, 1000, 100)).toBe(false); // exactly 50px above bottom
    expect(isScrolledToBottom(500, 1000, 100)).toBe(false); // way up
  });

  it('respects a custom threshold', () => {
    expect(isScrolledToBottom(800, 1000, 100, 200)).toBe(true);
    expect(isScrolledToBottom(800, 1000, 100, 50)).toBe(false);
  });

  it('handles a viewport taller than the content (always at bottom)', () => {
    expect(isScrolledToBottom(0, 100, 500)).toBe(true);
  });
});
