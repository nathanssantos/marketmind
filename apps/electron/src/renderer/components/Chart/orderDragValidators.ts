/**
 * Pure validation rules for the chart's order-drag pipeline. Extracted so
 * the rules can be characterized by unit tests independent of the React
 * hook + canvas plumbing.
 */

export type DragSide = 'LONG' | 'SHORT';

/**
 * Take-profit must be on the profitable side of the entry:
 *   LONG  → tp > entry
 *   SHORT → tp < entry
 *
 * (Stop-loss has no entry-side rule on its own — see `isTighterStop`.)
 */
export const isValidTakeProfit = (
  takeProfit: number,
  entryPrice: number,
  side: DragSide,
): boolean => (side === 'LONG' ? takeProfit > entryPrice : takeProfit < entryPrice);

/**
 * "Tighten only" mode: a SL drag is accepted only if the new stop is at
 * least as protective as the initial stop.
 *   LONG  → newStop >= initialStop  (closer to entry from below)
 *   SHORT → newStop <= initialStop  (closer to entry from above)
 *
 * Equality counts as tighter so a no-move release doesn't error.
 */
export const isTighterStop = (
  newStop: number,
  initialStop: number,
  side: DragSide,
): boolean => (side === 'LONG' ? newStop >= initialStop : newStop <= initialStop);

/**
 * Clamp a SL drag preview to "tighten only" while the user is dragging.
 *   LONG  → preview never goes below the initial stop
 *   SHORT → preview never goes above the initial stop
 */
export const clampStopToTighten = (
  rawPrice: number,
  initialStop: number,
  side: DragSide,
): number => (side === 'LONG' ? Math.max(rawPrice, initialStop) : Math.min(rawPrice, initialStop));

/**
 * Find the orders that should be updated together when the user drags an
 * SL or TP line for one of them. Same symbol + same side + still active —
 * the SL/TP price is shared across all entries in a position, so updating
 * any one fans out to the rest.
 */
export interface RelatableOrder {
  id: string;
  symbol: string;
  isLong: boolean;
  isActive: boolean;
}

export const findRelatedOrdersForSlTp = <T extends RelatableOrder>(
  orders: T[],
  draggedOrder: T,
): T[] =>
  orders.filter(
    (o) => o.symbol === draggedOrder.symbol && o.isLong === draggedOrder.isLong && o.isActive,
  );
