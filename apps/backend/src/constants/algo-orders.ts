export const ALGO_ORDER_DEFAULTS = {
  workingType: 'MARK_PRICE',
  priceProtect: true,
} as const satisfies {
  workingType: 'MARK_PRICE' | 'CONTRACT_PRICE';
  priceProtect: boolean;
};
