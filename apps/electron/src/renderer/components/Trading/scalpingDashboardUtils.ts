/**
 * Session P&L formatter for the Scalping dashboard.
 * - Always 2 decimals
 * - Leading "+" for non-negative values
 * - "$" prefix
 */
export const formatScalpingPnl = (pnl: number): string => {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${pnl.toFixed(2)}`;
};

/**
 * Semantic color token for a P&L value. Returns the neutral token at
 * exactly zero (so a fresh session shows neutral, not green).
 */
export const scalpingPnlColor = (pnl: number): string => {
  if (pnl > 0) return 'fg.success';
  if (pnl < 0) return 'fg.error';
  return 'fg.default';
};
