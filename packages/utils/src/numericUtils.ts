export const parseNumericOrZero = (value: string | null | undefined): number =>
  parseFloat(value || '0');

export const parseNumericOrNull = (value: string | null | undefined): number | null =>
  value ? parseFloat(value) : null;

export const formatNumeric = (value: number, decimals = 2): string =>
  value.toFixed(decimals);

export const safeParseFloat = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
};
