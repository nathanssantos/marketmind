/**
 * Font-size steps the LogsTab cycles through with the +/- buttons.
 * Defined here so both the component and its tests share the same source.
 */
export const LOGS_TAB_FONT_SIZE_STEPS = [6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export const LOGS_TAB_DEFAULT_FONT_SIZE_INDEX = 6;

export const clampFontSizeIndex = (index: number): number => {
  if (index < 0) return 0;
  if (index >= LOGS_TAB_FONT_SIZE_STEPS.length) return LOGS_TAB_FONT_SIZE_STEPS.length - 1;
  return index;
};

export const fontSizeForIndex = (index: number, fallback = 12): number =>
  LOGS_TAB_FONT_SIZE_STEPS[clampFontSizeIndex(index)] ?? fallback;

/**
 * The LogsTab keeps the user "auto-scrolled to the latest line" — but only
 * while their scroll position is within `threshold` pixels of the bottom.
 * If they scroll up to read older entries, autoScroll flips off so new
 * entries don't yank them back to the bottom.
 *
 * Returns true if the scroll position is "at the bottom" by the threshold.
 */
export const isScrolledToBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = 50,
): boolean => scrollHeight - scrollTop - clientHeight < threshold;
