/**
 * Pure merge helpers for socket → React Query cache patches.
 *
 * The hot path: when the backend emits a position/order socket event,
 * RealtimeTradingSyncContext calls one of these to derive a new cache
 * payload immediately, then schedules a tRPC invalidate as a safety
 * reconciliation. This way every subscriber (chart, sidebars, dialogs)
 * sees the change in the same React render frame the socket arrived,
 * without a refetch round trip.
 *
 * All functions are pure: take the previous array + the socket payload,
 * return either the same reference (no-op when nothing matched) or a
 * new array. Structural sharing keeps re-renders cheap downstream.
 */

interface ExecutionLike {
  id: string;
  status?: string | null;
  entryOrderId?: string | number | null;
  [key: string]: unknown;
}

interface OrderLike {
  id?: string;
  orderId?: string;
  status?: string;
  [key: string]: unknown;
}

const OPEN_ORDER_STATUSES = new Set(['NEW', 'PARTIALLY_FILLED']);

const hasChange = <T extends Record<string, unknown>>(
  existing: T,
  patch: Partial<T>,
): boolean => {
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (existing[key] !== patch[key]) return true;
  }
  return false;
};

/**
 * Patch an execution in-place by id. Returns the same array reference
 * when nothing changed (downstream React.memo / structural-sharing
 * checks short-circuit) or a new array with one entry replaced.
 */
export const mergePositionUpdate = <T extends ExecutionLike>(
  prev: T[] | undefined,
  payload: Partial<T> & { id?: string },
): T[] => {
  if (!prev) return [];
  if (!payload.id) return prev;
  const idx = prev.findIndex((e) => e.id === payload.id);
  if (idx < 0) return prev;
  const existing = prev[idx]!;
  if (!hasChange(existing, payload)) return prev;
  const next = prev.slice();
  next[idx] = { ...existing, ...payload };
  return next;
};

/**
 * Mark every pending exec for `entryOrderId` as `cancelled` so charts
 * subscribed to `autoTrading.getActiveExecutions` (status IN (open, pending))
 * drop the row in the same render frame the `order:cancelled` socket
 * event arrives — without waiting for the flush-debounced invalidate.
 *
 * Specifically targets multi-chart layouts: the chart that drove the
 * cancel had its optimistic line; the OTHER charts only saw the change
 * after the ~500ms debounce + refetch. With this patch they update
 * synchronously alongside the active chart.
 */
export const markPendingExecCancelledByOrderId = <T extends ExecutionLike>(
  prev: T[] | undefined,
  orderId: string | number | null | undefined,
): T[] => {
  if (!prev) return [];
  if (orderId === null || orderId === undefined || orderId === '') return prev;
  const targetId = String(orderId);
  let changed = false;
  const next = prev.map((e) => {
    if (e.status !== 'pending') return e;
    if (String(e.entryOrderId ?? '') !== targetId) return e;
    changed = true;
    return { ...e, status: 'cancelled' };
  });
  return changed ? next : prev;
};

/**
 * Mark an execution as closed in the cache. Tolerates the position
 * not being present (already filtered by status='open' in some queries).
 */
export const mergePositionClosed = <T extends ExecutionLike>(
  prev: T[] | undefined,
  payload: { positionId: string; pnl?: number; pnlPercent?: number; exitReason?: string; exitPrice?: number },
): T[] => {
  if (!prev) return [];
  const idx = prev.findIndex((e) => e.id === payload.positionId);
  if (idx < 0) return prev;
  const existing = prev[idx]!;
  if (existing.status === 'closed') return prev;
  const next = prev.slice();
  next[idx] = {
    ...existing,
    status: 'closed',
    ...(payload.pnl !== undefined ? { pnl: String(payload.pnl) } : {}),
    ...(payload.pnlPercent !== undefined ? { pnlPercent: String(payload.pnlPercent) } : {}),
    ...(payload.exitReason !== undefined ? { exitReason: payload.exitReason } : {}),
    ...(payload.exitPrice !== undefined ? { exitPrice: String(payload.exitPrice) } : {}),
  };
  return next;
};

/**
 * Insert a freshly-acked order at the head if it isn't already in the
 * cache. Keyed by `orderId` (Binance) or `id` (paper-trade). Idempotent
 * — duplicate emits collapse.
 */
export const mergeOrderCreated = <T extends OrderLike>(
  prev: T[] | undefined,
  payload: T,
): T[] => {
  if (!prev) return [payload];
  const key = payload.orderId ?? payload.id;
  if (!key) return prev;
  const exists = prev.some((o) => (o.orderId ?? o.id) === key);
  if (exists) return prev;
  return [payload, ...prev];
};

/**
 * Patch order in-place. The renderer uses both `orderId` (exchange) and
 * `id` (db row) as identifiers depending on context, so we accept either.
 */
export const mergeOrderUpdate = <T extends OrderLike>(
  prev: T[] | undefined,
  payload: Partial<T> & { orderId?: string; id?: string },
): T[] => {
  if (!prev) return [];
  const key = payload.orderId ?? payload.id;
  if (!key) return prev;
  const idx = prev.findIndex((o) => (o.orderId ?? o.id) === key);
  if (idx < 0) return prev;
  const existing = prev[idx]!;
  if (!hasChange(existing, payload)) return prev;
  const next = prev.slice();
  next[idx] = { ...existing, ...payload };
  return next;
};

/**
 * Drop a cancelled order from the open-orders list. The next refetch
 * of historical orders (if any) brings it back with its terminal state;
 * this just removes the live-flow entry users care about.
 */
export const mergeOrderCancelled = <T extends OrderLike>(
  prev: T[] | undefined,
  orderId: string,
): T[] => {
  if (!prev) return [];
  const idx = prev.findIndex((o) => (o.orderId ?? o.id) === orderId);
  if (idx < 0) return prev;
  const next = prev.slice();
  next.splice(idx, 1);
  return next;
};

/** Returns true iff the order is in an actively-open state. */
export const isOpenOrder = (order: { status?: string }): boolean =>
  Boolean(order.status && OPEN_ORDER_STATUSES.has(order.status));

interface WalletLike {
  id: string;
  currentBalance?: string | null;
  totalWalletBalance?: string | null;
  [key: string]: unknown;
}

interface WalletUpdatePayload {
  // Binance USER_DATA stream payload pass-through:
  //   reason: 'ORDER' | 'FUNDING_FEE' | 'WITHDRAW' | 'DEPOSIT' | …
  //   balances: [{ a: 'USDT', wb: '<wallet balance>', cw: '<cross wallet balance>', ... }]
  reason?: string;
  balances?: Array<{ a: string; wb: string; cw?: string; bc?: string }>;
  // Some emit paths (paper close synthesizers) push a flat patch instead.
  currentBalance?: string;
  totalWalletBalance?: string;
  /**
   * Backend echoes the walletId in the payload (since #592 follow-up)
   * so a client subscribed to multiple wallet rooms knows which wallet
   * the patch is for. Older payloads without it fall back to the
   * subscription-room walletId in the dispatcher.
   */
  walletId?: string;
}

/**
 * Patches the wallet.list cache with the new balance from a socket event
 * BEFORE the belt-and-suspenders tRPC invalidate fires. This is what makes
 * "close a position → ticket immediately reflects 100% of the freed
 * capital" actually happen. Without this, the renderer waits the full
 * INVALIDATION_FLUSH_MS + network round-trip + DB query before the
 * ticket can show the new percentage base — perceptible as a 300-700ms
 * lag for scalpers.
 */
export const mergeWalletBalanceUpdate = <T extends WalletLike>(
  prev: T[] | undefined,
  walletId: string,
  payload: WalletUpdatePayload,
): T[] | undefined => {
  if (!prev) return prev;
  const usdt = payload.balances?.find((b) => b.a === 'USDT');
  // Prefer wallet balance (`wb`) — that's the total, including unrealized.
  // Fall back to cross-wallet balance (`cw`) which excludes isolated.
  // Empty string is treated as "no value" too (Binance can return ''
  // when wb wasn't part of the delta), hence the truthiness check.
  const candidates = [usdt?.wb, usdt?.cw, payload.currentBalance, payload.totalWalletBalance];
  const newBalance = candidates.find((v): v is string => Boolean(v));
  if (!newBalance) return prev;
  const idx = prev.findIndex((w) => w.id === walletId);
  if (idx < 0) return prev;
  const wallet = prev[idx]!;
  if (
    wallet.currentBalance === newBalance
    && wallet.totalWalletBalance === newBalance
  ) {
    return prev;
  }
  const next = prev.slice();
  next[idx] = {
    ...wallet,
    currentBalance: newBalance,
    totalWalletBalance: newBalance,
  };
  return next;
};
