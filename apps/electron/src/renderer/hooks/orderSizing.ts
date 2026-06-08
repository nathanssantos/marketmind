import { FUTURES_DEFAULTS } from '@marketmind/types';
import { roundTradingQty } from '@shared/utils';

export interface OrderQuantityParams {
  balance: number;
  leverage: number;
  isFutures: boolean;
  /** 0–100 selector value. */
  sizePercent: number;
  price: number;
  stepSize: number;
  /** Opening taker fee rate; defaults to the futures VIP_0 taker fee. */
  takerFee?: number;
}

/**
 * Maximum order quantity for the selected size percent, reserving the opening
 * taker fee so the order always fits the balance (margin + fee), mirroring
 * Binance's "Max". For futures the per-unit-notional margin cost is
 * 1/leverage; for spot it's the full notional. The only shortfall below the
 * selected percentage is the unavoidable lot-size (stepSize) floor.
 */
export const computeOrderQuantity = (params: OrderQuantityParams): string => {
  const { balance, leverage, isFutures, sizePercent, price, stepSize } = params;
  const takerFee = params.takerFee ?? FUTURES_DEFAULTS.TAKER_FEE;

  if (balance <= 0 || price <= 0 || leverage <= 0) return roundTradingQty(0, stepSize > 0 ? stepSize : undefined);

  const pct = sizePercent / 100;
  const marginRate = isFutures ? 1 / leverage : 1;
  const notionalMax = balance / (marginRate + takerFee);
  const qty = (notionalMax * pct) / price;

  return roundTradingQty(qty, stepSize > 0 ? stepSize : undefined);
};
