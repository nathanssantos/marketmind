export const formatPrice = (price: number): string =>
  price >= 1 ? price.toFixed(2) : price.toFixed(6);

export const formatNumberForBinance = (value: number, precision: number = 8): string => {
  if (value === 0) return '0';
  if (!Number.isFinite(value)) return '0';

  const fixed = value.toFixed(precision);
  const trimmed = fixed.replace(/\.?0+$/, '');

  return trimmed || '0';
};

export const formatQuantityForBinance = (quantity: number, stepSize?: string): string => {
  if (!stepSize) {
    return formatNumberForBinance(quantity, 8);
  }

  const stepSizeNum = parseFloat(stepSize);
  if (stepSizeNum === 0 || !Number.isFinite(stepSizeNum)) {
    return formatNumberForBinance(quantity, 8);
  }

  const precision = stepSize.includes('.')
    ? stepSize.split('.')[1]?.replace(/0+$/, '').length || 0
    : 0;

  const adjusted = Math.floor(quantity / stepSizeNum) * stepSizeNum;

  return formatNumberForBinance(adjusted, precision);
};

export const formatPriceForBinance = (price: number, tickSize?: string): string => {
  if (!tickSize) {
    return formatNumberForBinance(price, 8);
  }

  const tickSizeNum = parseFloat(tickSize);
  if (tickSizeNum === 0 || !Number.isFinite(tickSizeNum)) {
    return formatNumberForBinance(price, 8);
  }

  const precision = tickSize.includes('.')
    ? tickSize.split('.')[1]?.replace(/0+$/, '').length || 0
    : 0;

  const adjusted = Math.round(price / tickSizeNum) * tickSizeNum;

  return formatNumberForBinance(adjusted, precision);
};
