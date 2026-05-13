import type { PositionSide } from '@marketmind/types';
import { getFeeRateForVipLevel } from '@marketmind/types';

export interface BreakevenParams {
  entryPrice: number;
  side: PositionSide;
  /** Single-side taker fee rate. Defaults to Binance Futures VIP 0 (0.0004). */
  takerRate?: number;
}

const DEFAULT_TAKER_RATE = getFeeRateForVipLevel('FUTURES', 0, 'TAKER');

// Solving 0 = grossPnl − totalFees with entry+exit fees applied to notional
// on both sides cancels the quantity and gives a price-only formula.
// LONG : BE = E × (1 + r) / (1 − r)
// SHORT: BE = E × (1 − r) / (1 + r)
export const calculateBreakevenPrice = ({
  entryPrice,
  side,
  takerRate = DEFAULT_TAKER_RATE,
}: BreakevenParams): number => {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return entryPrice;
  if (!Number.isFinite(takerRate) || takerRate <= 0) return entryPrice;
  if (takerRate >= 1) return entryPrice;

  if (side === 'LONG') {
    return entryPrice * (1 + takerRate) / (1 - takerRate);
  }
  return entryPrice * (1 - takerRate) / (1 + takerRate);
};
