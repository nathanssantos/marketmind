export interface FormatPriceOptions {
  decimals?: number;
}

export const formatPrice = (value: number, options: FormatPriceOptions = {}): string => {
  if (options.decimals !== undefined) return value.toFixed(options.decimals);
  return Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(6);
};

export interface FormatPriceDisplayOptions {
  abbreviated?: boolean;
}

export const formatPriceDisplay = (
  value: number,
  options: FormatPriceDisplayOptions = {},
): string => {
  const abbreviated = options.abbreviated ?? true;
  const abs = Math.abs(value);
  if (abbreviated && abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abbreviated && abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toFixed(8);
};
