export const formatPrice = (price: number): string =>
  price >= 1 ? price.toFixed(2) : price.toFixed(6);

export const formatPercent = (percent: number): string => percent.toFixed(2);

export const formatQuantity = (quantity: number, decimals = 4): string =>
  quantity.toFixed(decimals);
