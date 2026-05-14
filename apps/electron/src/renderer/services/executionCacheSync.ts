import type { QueryClient, Query } from '@tanstack/react-query';
import {
  mergePositionClosed,
  mergePositionUpdate,
} from './socketCacheMerge';

/**
 * Cross-cache fanout for execution state.
 *
 * The renderer reads open executions from TWO different tRPC procedures
 * across many distinct input variants:
 *   - `trading.getTradeExecutions` — Portfolio panel ({ walletId,
 *     status:'open', limit:500 }), OrdersDialog (paginated),
 *     LeveragePopover ({ walletId, limit:100 }), …
 *   - `autoTrading.getActiveExecutions` — every chart instance
 *     (`{ walletId }`), RiskDisplay, etc.
 *
 * Mutation onSuccess used to call `utils.x.setData(LITERAL_INPUT, …)`
 * which only patched ONE cache row — every other variant kept stale
 * data until the eventually-consistent socket event arrived ~250ms
 * later. With multiple chart instances open at different timeframes,
 * sibling charts visibly lagged the active one.
 *
 * These helpers use `setQueriesData` with a `queryKey` predicate to
 * fan out across every cached variant in a single call. Same predicate
 * pattern used by `dropOrderFromCaches` in useBackendFuturesTrading.ts.
 */

interface ExecutionLike {
  id: string;
  walletId?: string;
  status?: string | null;
  [k: string]: unknown;
}

/**
 * tRPC v11 stores cached queries as `[['procedure','path'], { input, type }]`.
 * Read the actual input out of position 1.
 */
const queryKeyInput = (query: Query): unknown => {
  const wrapper = query.queryKey[1] as { input?: unknown } | undefined;
  return wrapper?.input;
};

const matchesWallet = (input: unknown, walletId: string): boolean => {
  if (typeof input !== 'object' || input === null) return false;
  return (input as { walletId?: string }).walletId === walletId;
};

/**
 * Match cache variants whose input semantically asks for OPEN executions.
 *
 * - `{ status: 'open' }` → match
 * - `{ status: 'closed' }` → reject (don't pollute closed-only views)
 * - missing/undefined status → match (the variant is "all", which
 *   includes open rows)
 */
const variantWantsOpenRows = (input: unknown): boolean => {
  if (typeof input !== 'object' || input === null) return true;
  const status = (input as { status?: string }).status;
  return status === undefined || status === 'open';
};

// `getQueryKey(trpc.x.y)` from @trpc/react-query returns `[[...path]]`.
// We hard-code the same shape so the helper doesn't pull in the trpc
// react bridge — keeps it usable from non-React contexts and from
// tests that don't mount a TRPCProvider. The procedure paths are
// referenced from useBackendTradingMutations.ts:35, 39 and
// useBackendFuturesTrading.ts:28, 32 — keep these in lockstep with
// the AppRouter procedure names.
const TRADING_EXECUTIONS_KEY: unknown[] = [['trading', 'getTradeExecutions']];
const ACTIVE_EXECUTIONS_KEY: unknown[] = [['autoTrading', 'getActiveExecutions']];

const executionQueryKeys = () => [TRADING_EXECUTIONS_KEY, ACTIVE_EXECUTIONS_KEY];

/**
 * Replace the open-executions list in EVERY cache variant of both
 * procedures for the given wallet. Used by mutation onSuccess handlers
 * when the server returns `data.openExecutions` (authoritative
 * snapshot). Variants scoped to a different wallet OR explicitly
 * to `status: 'closed'` are left untouched.
 */
export const replaceOpenExecutionsInAllCaches = (
  qc: QueryClient,
  walletId: string,
  openExecutions: ExecutionLike[],
): void => {
  if (!walletId) return;
  for (const queryKey of executionQueryKeys()) {
    qc.setQueriesData<ExecutionLike[]>(
      {
        queryKey,
        predicate: (query) => {
          const input = queryKeyInput(query);
          return matchesWallet(input, walletId) && variantWantsOpenRows(input);
        },
      },
      () => openExecutions,
    );
  }
};

/**
 * Apply a partial patch to a single execution row across every cache
 * variant. Used by socket `position:update` (incremental update) and
 * by mutations whose response is a single-row patch rather than a
 * full open-executions snapshot.
 */
export const patchExecutionInAllCaches = (
  qc: QueryClient,
  walletId: string,
  patch: Partial<ExecutionLike> & { id: string },
): void => {
  if (!walletId) return;
  for (const queryKey of executionQueryKeys()) {
    qc.setQueriesData<ExecutionLike[]>(
      {
        queryKey,
        predicate: (query) => matchesWallet(queryKeyInput(query), walletId),
      },
      (prev) => mergePositionUpdate(prev, patch),
    );
  }
};

/**
 * Mark an execution as closed across every cache variant. Used by
 * socket `position:closed` and by close mutation onSuccess.
 */
export const markExecutionClosedInAllCaches = (
  qc: QueryClient,
  walletId: string,
  payload: { positionId: string; pnl?: number; pnlPercent?: number; exitReason?: string; exitPrice?: number },
): void => {
  if (!walletId) return;
  for (const queryKey of executionQueryKeys()) {
    qc.setQueriesData<ExecutionLike[]>(
      {
        queryKey,
        predicate: (query) => matchesWallet(queryKeyInput(query), walletId),
      },
      (prev) => mergePositionClosed(prev, payload),
    );
  }
};

