import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type {
  AppNotificationPayload,
  PositionClosedPayload,
  RiskAlertPayload,
  StreamReconnectedPayload,
  TradeNotificationPayload,
} from '@marketmind/types';
import { useQueryClient } from '@tanstack/react-query';
import { createPlatformAdapter } from '../adapters/factory';
import { useSocketEvent, useWalletSubscription, useAllWalletsBalanceSubscription } from '../hooks/socket';
import { socketBus } from '../services/socketBus';
import { QUERY_CONFIGS } from '../services/queryConfig';
import {
  mergeOrderCancelled,
  mergeOrderCreated,
  mergeOrderUpdate,
  mergeWalletBalanceUpdate,
} from '../services/socketCacheMerge';
import {
  markExecutionClosedInAllCaches,
  patchExecutionInAllCaches,
} from '../services/executionCacheSync';
import { trpc } from '../utils/trpc';
import { usePriceStore } from '../store/priceStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { toaster } from '../utils/toaster';

/**
 * Reconciliation-only debounce. Socket payloads are applied to the
 * React Query cache via `setData` (synchronous, instant) the moment
 * they arrive, so the UI updates in the same render frame as the
 * event. This invalidate is a *belt-and-suspenders* sweep that fires
 * a few hundred ms later to reconcile any field the merge couldn't
 * derive (e.g. server-side aggregations, related queries we don't
 * patch). 200 ms keeps the safety net out of the hot path while
 * making multi-chart layouts feel responsive — non-focused charts
 * land within ~200 ms instead of the previous 500 ms.
 *
 * IMPORTANT: scheduleInvalidation does NOT extend the timer on
 * subsequent calls. Earlier behavior cleared+reset the timer on every
 * call, which meant a burst of socket events (close → wallet:update →
 * position:update flash, all within ~30ms) kept pushing the invalidate
 * back. Net effect: the safety net fired ~270ms AFTER the last event,
 * not 250ms after the first — felt like extra lag to the user.
 * Now we just accumulate keys into the existing pending set, leaving
 * the original timer intact.
 */
const HOT_FLUSH_MS = 200;
const COLD_FLUSH_MS = 2000;

const COLD_KEYS = new Set(['setupStats', 'equityCurve']);

interface RealtimeTradingSyncProviderProps {
  walletId: string | undefined;
  /**
   * Every walletId the current user owns. Used to subscribe to each
   * wallet's `wallet:update` socket room so balances stay fresh in the
   * wallet.list cache regardless of which wallet is currently focused.
   * Without this, only the focused wallet ever sees balance updates and
   * the others go stale until manual refresh.
   */
  allWalletIds?: readonly string[];
  children: ReactNode;
}

export const RealtimeTradingSyncProvider = ({ walletId, allWalletIds, children }: RealtimeTradingSyncProviderProps) => {
  const recentAlertsRef = useRef<Map<string, number>>(new Map());
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const hasDisconnectedRef = useRef<boolean>(false);
  const pendingHot = useRef(new Set<string>());
  const pendingCold = useRef(new Set<string>());
  const hotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushHot = useCallback(() => {
    if (!walletId) return;
    const keys = pendingHot.current;
    pendingHot.current = new Set();
    hotTimeoutRef.current = null;

    // Patches via setQueriesData (executionCacheSync.patchExecutionInAllCaches)
    // already cover trading.getTradeExecutions and autoTrading.getActiveExecutions
    // in the same render frame as the socket event under normal conditions.
    // We ALSO invalidate them here as a safety net — the patch is a write
    // that requires the cache entry to already exist. After WS reconnect,
    // a fresh paper close, or any path that adds an exec the renderer
    // hasn't queried before, the patch is a no-op and the invalidate is
    // what gets the new state to the screen. Without these, Total Exposure
    // stayed at the closed-position notional after a WS gap → reconnect
    // (the user's "Sync balance from Binance" workaround).
    if (keys.has('positions')) {
      void utils.trading.getPositions.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    }
    if (keys.has('orders')) {
      void utils.trading.getOrders.invalidate();
      // useOrphanOrders → useChartTradingData reads pending-line state
      // off futuresTrading.getOpenOrders / getOpenAlgoOrders (Binance
      // REST) and futuresTrading.getOpenDbOrderIds (local DB). These
      // are wsBacked with a 10–30s polling fallback, but the WS-event
      // handlers above only patched/invalidated trading.getOrders —
      // the chart-side caches stayed stale until the next poll. Symptom
      // the user saw on 2026-05-14: a STOP_MARKET 0.098 FILLED on
      // BTCUSDT closed part of the position, but the chart kept the
      // pending order line for ~30s after the fill. Invalidate the
      // chart-side caches here so the line drops in the same hot-flush
      // window as every other order-touching state.
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenDbOrderIds.invalidate();
    }
    // wallet.list is patched optimistically by mergeWalletBalanceUpdate
    // with the authoritative post-mutation balance from the DB UPDATE
    // RETURNING. Belt-and-suspenders invalidate covers the cold-cache
    // first-event case. Analytics need invalidation because they
    // compute aggregates the patch can't derive.
    if (keys.has('wallet')) {
      void utils.wallet.list.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    }
  }, [walletId, utils]);

  const flushCold = useCallback(() => {
    if (!walletId) return;
    const keys = pendingCold.current;
    pendingCold.current = new Set();
    coldTimeoutRef.current = null;

    if (keys.has('setupStats')) void utils.analytics.getSetupStats.invalidate();
    if (keys.has('equityCurve')) void utils.analytics.getEquityCurve.invalidate();
  }, [walletId, utils]);

  const scheduleInvalidation = useCallback((...keys: string[]) => {
    // Two-tier flush: hot keys (positions/orders/wallet → drives the
    // ticket sizing widget + chart lines) flush in 500 ms; cold keys
    // (setupStats / equityCurve → historical analytics, not in the
    // scalping hot path) flush in 2000 ms. Bursts of close events
    // collapse multiple equityCurve refetches into one without affecting
    // the responsive UI surfaces. Timers are NOT reset on later calls —
    // accumulate into the existing window for a stable cadence under
    // bursty events.
    for (const key of keys) {
      if (COLD_KEYS.has(key)) pendingCold.current.add(key);
      else pendingHot.current.add(key);
    }
    if (!hotTimeoutRef.current && pendingHot.current.size > 0) {
      hotTimeoutRef.current = setTimeout(flushHot, HOT_FLUSH_MS);
    }
    if (!coldTimeoutRef.current && pendingCold.current.size > 0) {
      coldTimeoutRef.current = setTimeout(flushCold, COLD_FLUSH_MS);
    }
  }, [flushHot, flushCold]);

  const scheduleRef = useRef(scheduleInvalidation);
  useEffect(() => {
    scheduleRef.current = scheduleInvalidation;
  });

  // Required-symbols price subscription: positions / pending orders need live
  // ticks so the UI can compute live PnL/distance even when no chart for them
  // is mounted. Build the symbol set; per-symbol subscribe via socketBus.
  const { data: tradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.tradeExecutions.staleTime },
  );
  const { data: orders } = trpc.trading.getOrders.useQuery(
    { walletId: walletId ?? '', limit: 100 },
    { enabled: !!walletId, staleTime: QUERY_CONFIGS.orders.staleTime },
  );

  const requiredSymbolsKey = useMemo(() => {
    const symbols = new Set<string>();
    for (const exec of tradeExecutions ?? []) {
      if (exec.status === 'open' || exec.status === 'pending') symbols.add(exec.symbol);
    }
    for (const order of orders ?? []) {
      if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') symbols.add(order.symbol);
    }
    return [...symbols].sort().join(',');
  }, [tradeExecutions, orders]);

  useEffect(() => {
    if (!requiredSymbolsKey) return;
    const symbols = requiredSymbolsKey.split(',').filter(Boolean);
    const unsubs = symbols.map((symbol) =>
      socketBus.subscribeRoom({
        dedupKey: `prices:${symbol}`,
        subscribe: () => socketBus.emit('subscribe:prices:batch', [symbol]),
        unsubscribe: () => socketBus.emit('unsubscribe:prices', symbol),
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [requiredSymbolsKey]);

  useWalletSubscription(walletId);
  useAllWalletsBalanceSubscription(allWalletIds ?? []);

  // Live price ticks → priceStore (RAF-coalesced via socketBus)
  useSocketEvent('price:update', (data) => {
    usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
  });

  // Socket → cache patch helpers. The renderer holds execution state
  // across two procedures (`trading.getTradeExecutions`,
  // `autoTrading.getActiveExecutions`) and many input variants
  // (`status:'open' limit:500` / `limit:100` / paginated, etc). The
  // helpers in `executionCacheSync.ts` use `setQueriesData` with a
  // queryKey predicate to fan out across every variant per wallet, so
  // a single socket event reaches every chart/dialog/panel in the
  // same render frame regardless of which input shape they subscribed
  // with. Earlier this hardcoded `{ walletId, limit: 100 }` and
  // silently dropped every other variant.
  const patchExecutionCaches = useCallback((
    payload: Parameters<typeof patchExecutionInAllCaches>[2],
  ) => {
    if (!walletId) return;
    patchExecutionInAllCaches(queryClient, walletId, payload);
  }, [walletId, queryClient]);

  const closeExecutionInCaches = useCallback((
    payload: Parameters<typeof markExecutionClosedInAllCaches>[2],
  ) => {
    if (!walletId) return;
    markExecutionClosedInAllCaches(queryClient, walletId, payload);
  }, [walletId, queryClient]);

  useSocketEvent('position:update', (raw) => {
    const payload = raw as { id?: string; status?: string; pnl?: string | number; pnlPercent?: string | number; exitReason?: string; exitPrice?: string | number; [k: string]: unknown };
    if (payload?.id && payload.status !== 'closed') {
      patchExecutionCaches(payload as { id: string });
    }
    // Defense in depth: if a backend path emits position:update with
    // status='closed' WITHOUT also firing position:closed (which is
    // what positionSync's orphan branch used to do — see #PR-after-525),
    // fall through to the canonical close cascade so the cache patches
    // the exec to closed. Without this, getTradeExecutions /
    // getActiveExecutions kept the closed exec in their open lists,
    // and Total Exposure stayed at the closed-position notional until
    // the user clicked "Sync balance from Binance". emitPositionClosed
    // on the well-behaved path (handleExitFill / closeTradeExecution)
    // still drives the proper trio — this branch is just a safety net.
    if (payload?.id && payload.status === 'closed') {
      const toNum = (v: unknown): number | undefined =>
        typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : undefined;
      closeExecutionInCaches({
        positionId: payload.id,
        pnl: toNum(payload.pnl) ?? 0,
        pnlPercent: toNum(payload.pnlPercent) ?? 0,
        ...(payload.exitReason !== undefined ? { exitReason: payload.exitReason } : {}),
        ...(toNum(payload.exitPrice) !== undefined ? { exitPrice: toNum(payload.exitPrice)! } : {}),
      });
      scheduleRef.current('positions', 'wallet', 'setupStats', 'equityCurve');
      return;
    }
    // No 'wallet' here: position updates that genuinely move the wallet
    // balance (fills, liquidations) ALWAYS pair with a wallet:update
    // event from Binance's user-stream — that one patches wallet.list
    // directly via mergeWalletBalanceUpdate. Scheduling 'wallet' here
    // too forced an unnecessary refetch round-trip on cosmetic updates
    // (leverage change, SL/TP price tweak) that don't move the balance.
    scheduleRef.current('positions');
  }, !!walletId);

  useSocketEvent('position:closed', (data: PositionClosedPayload) => {
    closeExecutionInCaches(data);
    scheduleRef.current('positions', 'wallet', 'setupStats', 'equityCurve');
  }, !!walletId);

  useSocketEvent('order:update', (raw) => {
    if (!walletId) return;
    const payload = raw as Record<string, unknown> & { orderId?: string; id?: string };
    if (payload?.orderId || payload?.id) {
      utils.trading.getOrders.setData(
        { walletId, limit: 100 },
        (prev) => mergeOrderUpdate(prev, payload as never),
      );
    }
    // Order state changes (incl. partial fills, expirations, cancels)
    // can move wallet balance through paths Binance doesn't always pair
    // with an immediate wallet:update event (paper, testnet, lost frame).
    // Schedule the wallet flush as a safety net — the dedup in flushHot
    // collapses it with any paired wallet:update arriving in the same
    // 500ms window. We also schedule 'positions' so the
    // `autoTrading.getActiveExecutions` cache (which the chart reads to
    // draw pending order lines) refetches after a status change —
    // without this, a cancelled pending order kept its NEW chart line
    // until the 30s backup poll or a full reload.
    scheduleRef.current('orders', 'wallet', 'positions');
  }, !!walletId);

  useSocketEvent('order:created', (raw) => {
    if (!walletId) return;
    const payload = raw as Record<string, unknown> & { orderId?: string; id?: string };
    if (payload?.orderId || payload?.id) {
      utils.trading.getOrders.setData(
        { walletId, limit: 100 },
        (prev) => mergeOrderCreated(prev, payload as never),
      );
    }
    // Creating an order doesn't move wallet balance (only fills do).
    // The fill → wallet:update event arrives separately and patches.
    scheduleRef.current('orders');
  }, !!walletId);

  useSocketEvent('order:cancelled', (data) => {
    if (!walletId) return;
    if (data?.orderId) {
      utils.trading.getOrders.setData(
        { walletId, limit: 100 },
        (prev) => mergeOrderCancelled(prev, data.orderId),
      );
      // NOTE: do NOT flip the matching pending exec to 'cancelled' here.
      // The order:cancelled event fires for BOTH:
      //   (1) a pure cancel (user clicks X on the pending line), AND
      //   (2) the cancel step of a MOVE (drag-release on chart →
      //       updatePendingEntry → backend cancels old order, then
      //       creates a new one).
      // For (1) the canonical flip comes from the backend's
      // handle-order-update CANCELED branch which UPDATEs the exec
      // status='cancelled' and emits `position:update` — the
      // position:update handler above already runs patchExecutionCaches
      // synchronously across every cache variant, so multi-chart
      // layouts see the line drop in the same render frame.
      // For (2) flipping the exec here was wrong: the move flow's
      // detach-before-cancel keeps the DB exec at status='pending'
      // (it's getting a new orderId, not being cancelled), but the
      // helper would still flip the cache, causing the chart line to
      // disappear for ~200–500ms until the next refetch reverted it.
    }
    // Cancelling an open order can free cross-margin reserve; Binance
    // typically pairs with wallet:update but include the schedule key
    // here as a safety net. Also schedule 'positions' so the
    // `autoTrading.getActiveExecutions` cache refetches the matching
    // pending-exec row (now status='cancelled'); without this the chart's
    // pending order line lingered until the 30s backup poll / full reload
    // — visible to the user when moving an order via drag (cancel+create
    // shows both old + new lines briefly).
    scheduleRef.current('orders', 'wallet', 'positions');
  }, !!walletId);

  useSocketEvent('wallet:update', (raw) => {
    // Resolve the target wallet from the payload (backend now echoes
    // `walletId` in every emit) and fall back to the focused walletId
    // for legacy payloads. Critical because we subscribe to EVERY
    // wallet's room — without payload.walletId, a non-focused wallet's
    // event would incorrectly patch the focused wallet's row.
    const payload = raw as { walletId?: string } | null | undefined;
    const targetWalletId = payload?.walletId ?? walletId;
    if (!targetWalletId) return;
    // Patch wallet.list cache directly with the new balance from the
    // payload — same render frame as the socket event, no tRPC round
    // trip. Critical for scalping: when a position closes, the ticket
    // percentage must reflect freed-up capital immediately so the next
    // entry sizes against the live total. Without this patch the
    // ticket waits ~300–700ms (debounce + refetch) before reflecting
    // the new balance.
    utils.wallet.list.setData(undefined, (prev) =>
      mergeWalletBalanceUpdate(prev as never, targetWalletId, raw as never)
    );
    if (targetWalletId === walletId) scheduleRef.current('wallet');
  }, true);

  // v1.6 Track F.2 — backend signals after a user-stream reconnect (the
  // listenKey expired, the watchdog forced a reconnect, or a message
  // came through after a degraded period). We may have missed events
  // while offline; force-refresh everything.
  useSocketEvent('stream:reconnected', (data: StreamReconnectedPayload) => {
    scheduleRef.current('positions', 'orders', 'wallet', 'setupStats', 'equityCurve');
    if ((data.silenceMs ?? 0) > 30_000 || data.reason === 'listenkey_expired') {
      toaster.create({
        type: 'info',
        title: 'Trading data refreshed',
        description: data.reason === 'listenkey_expired'
          ? 'Reconnected to Binance after a session timeout.'
          : `Reconnected after ${Math.floor((data.silenceMs ?? 0) / 1000)}s gap.`,
        duration: 5000,
      });
    }
  }, !!walletId);

  useSocketEvent('risk:alert', (alert: RiskAlertPayload) => {
    if (alert.type !== 'LIQUIDATION_RISK' || alert.level !== 'critical') return;
    if (usePreferencesStore.getState().ui['liquidationRiskToastsEnabled'] === false) return;
    const dedupKey = `${alert.type}:${alert.symbol ?? ''}:${alert.message}`;
    const lastShown = recentAlertsRef.current.get(dedupKey) ?? 0;
    const COOLDOWN_MS = 5 * 60 * 1000;
    if (Date.now() - lastShown < COOLDOWN_MS) return;
    recentAlertsRef.current.set(dedupKey, Date.now());

    const toastType =
      alert.level === 'critical' || (alert.level as string) === 'danger'
        ? 'error'
        : alert.level === 'warning'
          ? 'warning'
          : 'info';
    toaster.create({
      type: toastType,
      title: alert.symbol ? `${alert.type.replace(/_/g, ' ')} — ${alert.symbol}` : alert.type.replace(/_/g, ' '),
      description: alert.message,
      duration: alert.level === 'critical' ? undefined : 10000,
    });
  }, !!walletId);

  useSocketEvent('trade:notification', (notification: TradeNotificationPayload) => {
    void (async () => {
    if (notification.type !== 'TRAILING_STOP_UPDATED') {
      const toastType: 'success' | 'error' | 'info' =
        notification.type === 'POSITION_CLOSED'
          ? parseFloat(notification.data.pnl ?? '0') >= 0
            ? 'success'
            : 'error'
          : notification.type === 'POSITION_PARTIAL_CLOSE'
            ? parseFloat(notification.data.pnl ?? '0') >= 0
              ? 'success'
              : 'error'
            : notification.type === 'POSITION_OPENED' || notification.type === 'POSITION_PYRAMIDED'
              ? 'info'
              : 'success';
      toaster.create({
        title: notification.title,
        description: notification.body,
        type: toastType,
        duration: notification.urgency === 'critical' ? undefined : 8000,
        meta: { symbol: notification.data.symbol },
      });
    }

    try {
      const adapter = await createPlatformAdapter();
      const isSupported = await adapter.notification.isSupported();
      if (isSupported) {
        await adapter.notification.show({
          title: notification.title,
          body: notification.body,
          urgency: notification.urgency,
        });
      }
    } catch {
      // best-effort
    }

    // No invalidate scheduling here — trade:notification is a side
    // channel for toasts/native notifications. The underlying state
    // changes (position closed, opened, etc.) ALREADY arrive on their
    // own dedicated socket channels (position:closed, position:update,
    // wallet:update), each of which patches the cache + schedules the
    // appropriate invalidate. Scheduling here too just doubled the
    // safety-net work without adding freshness.
    })();
  }, !!walletId);

  useSocketEvent('notification', (notification: AppNotificationPayload) => {
    toaster.create({
      type: notification.type,
      title: notification.title,
      description: notification.message,
    });
  }, !!walletId);

  // Reconnect-aware refetch: on socket reconnect, force a full trading-query refresh.
  useEffect(() => {
    const handleConnect = (): void => {
      if (hasDisconnectedRef.current) {
        hasDisconnectedRef.current = false;
        scheduleRef.current('positions', 'orders', 'wallet', 'setupStats', 'equityCurve');
      }
    };
    const handleDisconnect = (): void => {
      hasDisconnectedRef.current = true;
    };
    const sock = socketBus.getSocket();
    if (!sock) return;
    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);
    return () => {
      sock.off('connect', handleConnect);
      sock.off('disconnect', handleDisconnect);
    };
  }, []);

  return <>{children}</>;
};
