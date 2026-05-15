/**
 * Risk math for the long/short position drawing tool's "Risk %" label.
 * Pure function — callers feed live values from stores; the renderer
 * just consumes the returned `exposurePercent`.
 *
 * The number answers: "if I open this trade at the ticket's currently
 * configured size and the SL fires, how much of my account balance do
 * I lose?" — including round-trip taker fees on the assumption the
 * exit is a market order at the stop.
 */
export interface PositionRiskInput {
  entryPrice: number;
  stopLossPrice: number;
  /** % of wallet balance the ticket is sized for (e.g. 10 → 10%). */
  sizePercent: number;
  /** Active wallet balance in quote currency (USDT). */
  balance: number;
  /** Account leverage on this symbol (1× for spot, 1–125× for futures). */
  leverage: number;
  /** Round-trip taker rate (e.g. 0.0004 = 0.04%). Applied to entry and exit notional. */
  takerRate: number;
}

export interface PositionRiskResult {
  /** % of balance lost if SL fires, including fees. NaN if inputs invalid. */
  exposurePercent: number;
}

export const computePositionRisk = ({
  entryPrice,
  stopLossPrice,
  sizePercent,
  balance,
  leverage,
  takerRate,
}: PositionRiskInput): PositionRiskResult => {
  if (
    !Number.isFinite(entryPrice) || entryPrice <= 0
    || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0
    || !Number.isFinite(sizePercent) || sizePercent <= 0
    || !Number.isFinite(balance) || balance <= 0
    || !Number.isFinite(leverage) || leverage <= 0
  ) {
    return { exposurePercent: NaN };
  }

  // Same sizing math as `useOrderQuantity.getQuantity`: notional = balance × pct × leverage.
  const notional = balance * (sizePercent / 100) * leverage;
  const quantity = notional / entryPrice;
  const slLoss = Math.abs(entryPrice - stopLossPrice) * quantity;
  const fees = (notional + (stopLossPrice * quantity)) * takerRate;
  const exposurePercent = ((slLoss + fees) / balance) * 100;
  return { exposurePercent };
};
