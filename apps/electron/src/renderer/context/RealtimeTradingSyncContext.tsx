import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type {
  AppNotificationPayload,
  PositionClosedPayload,
  RiskAlertPayload,
  TradeNotificationPayload,
} from '@marketmind/types';
import { createPlatformAdapter } from '../adapters/factory';
import { useSocketEvent, useWalletSubscription } from '../hooks/socket';
import { socketBus } from '../services/socketBus';
import { QUERY_CONFIGS } from '../services/queryConfig';
import { trpc } from '../utils/trpc';
import { usePriceStore } from '../store/priceStore';
import { toaster } from '../utils/toaster';

/**
 * Trailing-debounce window for batching tRPC query invalidations triggered by
 * realtime socket events. With high-frequency event storms (rapid order /
 * position / wallet updates), a smaller window means N invalidations × N
 * refetches per second. 100 ms is the sweet spot: feels instantaneous to a
 * human but coalesces a typical multi-event burst into one refetch cycle.
 */
const INVALIDATION_FLUSH_MS = 100;

interface RealtimeTradingSyncContextValue {
  forceRefresh: () => void;
}

const RealtimeTradingSyncContext = createContext<RealtimeTradingSyncContextValue | null>(null);

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

  useSocketEvent('position:update', (_position) => {
    scheduleRef.current('positions', 'wallet');
  }, !!walletId);

  useSocketEvent('position:closed', (_data: PositionClosedPayload) => {
    scheduleRef.current('positions', 'wallet', 'setupStats', 'equityCurve');
  }, !!walletId);

  useSocketEvent('order:update', () => scheduleRef.current('orders'), !!walletId);
  useSocketEvent('order:created', () => scheduleRef.current('orders', 'wallet'), !!walletId);
  useSocketEvent('order:cancelled', () => scheduleRef.current('orders', 'wallet'), !!walletId);
  useSocketEvent('wallet:update', () => scheduleRef.current('wallet'), !!walletId);

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
      const toastType =
        notification.type === 'POSITION_CLOSED'
          ? parseFloat(notification.data.pnl ?? '0') >= 0
            ? 'success'
            : 'error'
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

  const forceRefresh = useCallback(() => {
    for (const key of ['positions', 'orders', 'wallet', 'setupStats', 'equityCurve']) {
      pendingInvalidations.current.add(key);
    }
    flushInvalidations();
  }, [flushInvalidations]);

  const value: RealtimeTradingSyncContextValue = { forceRefresh };

  return (
    <RealtimeTradingSyncContext.Provider value={value}>
      {children}
    </RealtimeTradingSyncContext.Provider>
  );
};

export const useRealtimeTradingSyncContext = (): RealtimeTradingSyncContextValue => {
  const context = useContext(RealtimeTradingSyncContext);
  if (!context) {
    return { forceRefresh: () => {} };
  }
  return context;
};
