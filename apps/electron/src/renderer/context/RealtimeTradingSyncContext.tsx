import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type {
  AppNotificationPayload,
  PositionClosedPayload,
  RiskAlertPayload,
  StreamReconnectedPayload,
  TradeNotificationPayload,
} from '@marketmind/types';
import { createPlatformAdapter } from '../adapters/factory';
import { useSocketEvent, useWalletSubscription } from '../hooks/socket';
import { socketBus } from '../services/socketBus';
import { QUERY_CONFIGS } from '../services/queryConfig';
import {
  mergeOrderCancelled,
  mergeOrderCreated,
  mergeOrderUpdate,
  mergePositionClosed,
  mergePositionUpdate,
  mergeWalletBalanceUpdate,
} from '../services/socketCacheMerge';
import { trpc } from '../utils/trpc';
import { usePriceStore } from '../store/priceStore';
import { toaster } from '../utils/toaster';

/**
 * Reconciliation-only debounce. Socket payloads are applied to the
 * React Query cache via `setData` (synchronous, instant) the moment
 * they arrive, so the UI updates in the same render frame as the
 * event. This invalidate is a *belt-and-suspenders* sweep that fires
 * a few hundred ms later to reconcile any field the merge couldn't
 * derive (e.g. server-side aggregations, related queries we don't
 * patch). 250 ms keeps the safety net out of the hot path.
 */
const INVALIDATION_FLUSH_MS = 250;

interface RealtimeTradingSyncProviderProps {
  walletId: string | undefined;
  children: ReactNode;
}

export const RealtimeTradingSyncProvider = ({ walletId, children }: RealtimeTradingSyncProviderProps) => {
  const recentAlertsRef = useRef<Map<string, number>>(new Map());
  const utils = trpc.useUtils();
  const hasDisconnectedRef = useRef<boolean>(false);
  const pendingInvalidations = useRef(new Set<string>());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushInvalidations = useCallback(() => {
    if (!walletId) return;
    const keys = pendingInvalidations.current;
    pendingInvalidations.current = new Set();
    flushTimeoutRef.current = null;

    if (keys.has('positions')) {
      void utils.trading.getTradeExecutions.invalidate();
      void utils.trading.getPositions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    }
    if (keys.has('orders')) void utils.trading.getOrders.invalidate();
    if (keys.has('wallet')) {
      void utils.wallet.list.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    }
    if (keys.has('setupStats')) void utils.analytics.getSetupStats.invalidate();
    if (keys.has('equityCurve')) void utils.analytics.getEquityCurve.invalidate();
  }, [walletId, utils]);

  const scheduleInvalidation = useCallback((...keys: string[]) => {
    for (const key of keys) pendingInvalidations.current.add(key);
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(flushInvalidations, INVALIDATION_FLUSH_MS);
  }, [flushInvalidations]);

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

  // Live price ticks → priceStore (RAF-coalesced via socketBus)
  useSocketEvent('price:update', (data) => {
    usePriceStore.getState().updatePrice(data.symbol, data.price, 'websocket');
  });

  // Socket → cache patch helpers. The renderer's React Query cache for
  // executions lives behind two query keys: `trading.getTradeExecutions`
  // (general dialogs / portfolio views) and `autoTrading.getActiveExecutions`
  // (chart). We patch both so every consumer sees the change without
  // round-tripping the backend.
  const patchExecutionCaches = useCallback((
    payload: Parameters<typeof mergePositionUpdate>[1],
  ) => {
    if (!walletId) return;
    utils.trading.getTradeExecutions.setData(
      { walletId, limit: 100 },
      (prev) => mergePositionUpdate(prev, payload),
    );
    utils.autoTrading.getActiveExecutions.setData(
      { walletId },
      (prev) => mergePositionUpdate(prev, payload),
    );
  }, [walletId, utils]);

  const closeExecutionInCaches = useCallback((
    payload: Parameters<typeof mergePositionClosed>[1],
  ) => {
    if (!walletId) return;
    utils.trading.getTradeExecutions.setData(
      { walletId, limit: 100 },
      (prev) => mergePositionClosed(prev, payload),
    );
    utils.autoTrading.getActiveExecutions.setData(
      { walletId },
      (prev) => mergePositionClosed(prev, payload),
    );
  }, [walletId, utils]);

  useSocketEvent('position:update', (raw) => {
    const payload = raw as Parameters<typeof mergePositionUpdate>[1];
    if (payload?.id) patchExecutionCaches(payload);
    scheduleRef.current('positions', 'wallet');
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
    scheduleRef.current('orders');
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
    scheduleRef.current('orders', 'wallet');
  }, !!walletId);

  useSocketEvent('order:cancelled', (data) => {
    if (!walletId) return;
    if (data?.orderId) {
      utils.trading.getOrders.setData(
        { walletId, limit: 100 },
        (prev) => mergeOrderCancelled(prev, data.orderId),
      );
    }
    scheduleRef.current('orders', 'wallet');
  }, !!walletId);

  useSocketEvent('wallet:update', (raw) => {
    if (!walletId) return;
    // Patch wallet.list cache directly with the new balance from the
    // payload — same render frame as the socket event, no tRPC round
    // trip. Critical for scalping: when a position closes, the ticket
    // percentage must reflect freed-up capital immediately so the next
    // entry sizes against the live total. Without this patch the
    // ticket waits ~300–700ms (debounce + refetch) before reflecting
    // the new balance.
    utils.wallet.list.setData(undefined, (prev) =>
      mergeWalletBalanceUpdate(prev as never, walletId, raw as never)
    );
    scheduleRef.current('wallet');
  }, !!walletId);

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

    scheduleRef.current('positions', 'wallet');
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
