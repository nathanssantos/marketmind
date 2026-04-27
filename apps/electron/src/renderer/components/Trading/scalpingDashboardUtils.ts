/**
 * Session P&L formatter for the Scalping dashboard.
 * - Always 2 decimals
 * - Leading "+" for non-negative values
 * - For negatives, the "-" sits OUTSIDE the "$" ("-$7.50" rather than
 *   "$-7.50") — matches accounting convention and how every other PnL
 *   string in the app reads.
 */
export const formatScalpingPnl = (pnl: number): string => {
  if (pnl < 0) return `-$${Math.abs(pnl).toFixed(2)}`;
  return `+$${pnl.toFixed(2)}`;
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
