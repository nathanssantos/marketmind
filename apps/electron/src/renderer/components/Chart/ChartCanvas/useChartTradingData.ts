import type { MarketType, PositionClosedPayload } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useOrphanOrders } from '@renderer/hooks/useOrphanOrders';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';
import { useIndicatorVisibility } from '@renderer/hooks/useIndicatorVisibility';
import { useSocketEvent } from '@renderer/hooks/socket';
import { trpc } from '@renderer/utils/trpc';
import { QUERY_CONFIG } from '@shared/constants/queryConfig';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BackendExecution, TrailingStopLineConfig } from '../useOrderLinesRenderer';

interface OptimisticOverride {
  patches: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  previousValues: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  timestamp: number;
}

// Hard safety cap for optimistic overrides — after this, give up and let
// the real cache speak. v1.6 Track F: was 5s, but Binance's open-orders
// list is eventually consistent — a cancelled limit could still appear
// in `getOpenOrders` for several seconds after the cancel ACKs. With
// the old 5s cap, the override would expire before the cache caught up,
// the cancelled order would reappear (real cache still had it), then
// vanish again on the next poll. Bumped to 30s + smarter "delete when
// server stops showing the entry" logic below.
const OPTIMISTIC_OVERRIDE_HARD_CAP_MS = 30_000;
// Pre-confirmation TTL for newly-created entries (shown before the
// server returns the real exec). The drag-to-move flow does
// cancel + create + REST refetch on Binance. The 15s bump from #612
// Phase 4 covered the WS-silent era where the new order took 30s
// (REST sync) to surface; with the WS now firing `position:update`
// in ms, 7s is plenty for the cancel→create round-trip on a healthy
// Binance link. The loading-flag override keeps the row alive past
// TTL while the mutation is in flight regardless.
const OPTIMISTIC_ENTRY_TTL_MS = 7_000;

export interface UseChartTradingDataProps {
  symbol?: string;
  marketType?: MarketType;
}

export const useChartTradingData = ({
  symbol,
  marketType,
}: UseChartTradingDataProps) => {
  const { activeWallet } = useActiveWallet();
  const backendWalletId = activeWallet?.id;
  const hasTradingEnabled = !!backendWalletId;

  const [optimisticExecutions, setOptimisticExecutions] = useState<BackendExecution[]>([]);
  const orderLoadingMapRef = useRef<Map<string, number>>(new Map());
  const orderFlashMapRef = useRef<Map<string, number>>(new Map());
  const closingSnapshotsRef = useRef<Map<string, BackendExecution>>(new Map());
  const [closingVersion, setClosingVersion] = useState(0);

  const optimisticOverridesRef = useRef<Map<string, OptimisticOverride>>(new Map());
  const [overrideVersion, setOverrideVersion] = useState(0);

  const applyOptimistic = useCallback((
    id: string,
    patches: OptimisticOverride['patches'],
    previousValues: OptimisticOverride['previousValues']
  ) => {
    const existing = optimisticOverridesRef.current.get(id);
    optimisticOverridesRef.current.set(id, {
      patches: existing ? { ...existing.patches, ...patches } : patches,
      previousValues: existing ? existing.previousValues : previousValues,
      timestamp: Date.now(),
    });
    setOverrideVersion(v => v + 1);
  }, []);

  const clearOptimistic = useCallback((id: string, expectedPatches?: OptimisticOverride['patches']) => {
    if (expectedPatches) {
      const current = optimisticOverridesRef.current.get(id);
      if (current) {
        const patchKeys = Object.keys(expectedPatches) as (keyof OptimisticOverride['patches'])[];
        const stillMatches = patchKeys.every(k => current.patches[k] === expectedPatches[k]);
        if (!stillMatches) return;
      }
    }
    optimisticOverridesRef.current.delete(id);
    setOverrideVersion(v => v + 1);
  }, []);

  const { watcherStatus } = useBackendAutoTrading(backendWalletId ?? '');

  // WS-backed: position:update / position:closed events from
  // RealtimeTradingSyncContext patch the execution caches in the same
  // render frame as the event. Polling only fires while WS is dropped.
  const executionPolling = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL, { wsBacked: true });
  // WS-backed via mutation invalidation: trailing-config / autoTrading-
  // config only change through user mutations (each invalidates on
  // success). No periodic poll needed while WS is up.
  const configPolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.NORMAL, { wsBacked: true });

  const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: backendWalletId ?? '' },
    {
      enabled: !!backendWalletId && !!symbol,
      refetchInterval: executionPolling,
      staleTime: QUERY_CONFIG.STALE_TIME.FAST,
    }
  );

  const { orphanOrders: orphanOrdersRaw, trackedOrders: trackedOrdersRaw, exchangeOpenOrders, exchangeAlgoOrders } = useOrphanOrders(
    backendWalletId ?? '',
    backendExecutions ?? [],
    symbol,
  );

  const { data: symbolTrailingConfig } = trpc.trading.getSymbolTrailingConfig.useQuery(
    { walletId: backendWalletId ?? '', symbol: symbol ?? '' },
    { enabled: !!backendWalletId && !!symbol, refetchInterval: configPolling, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM }
  );

  const { data: walletAutoTradingConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId: backendWalletId ?? '' },
    { enabled: !!backendWalletId, refetchInterval: configPolling, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM }
  );

  const trailingStopLineConfig = useMemo((): TrailingStopLineConfig | null => {
    const useOverride = symbolTrailingConfig?.useIndividualConfig ?? false;
    const src = useOverride ? symbolTrailingConfig : walletAutoTradingConfig;
    const enabled = (useOverride ? symbolTrailingConfig?.trailingStopEnabled : walletAutoTradingConfig?.trailingStopEnabled) ?? true;
    if (!enabled) return null;
    return {
      enabled: true,
      activationPercentLong: src?.trailingActivationPercentLong
        ? parseFloat(src.trailingActivationPercentLong)
        : walletAutoTradingConfig?.trailingActivationPercentLong
          ? parseFloat(walletAutoTradingConfig.trailingActivationPercentLong)
          : 0.9,
      activationPercentShort: src?.trailingActivationPercentShort
        ? parseFloat(src.trailingActivationPercentShort)
        : walletAutoTradingConfig?.trailingActivationPercentShort
          ? parseFloat(walletAutoTradingConfig.trailingActivationPercentShort)
          : 0.8,
    };
  }, [symbolTrailingConfig, walletAutoTradingConfig]);

  const filteredBackendExecutions = useMemo((): BackendExecution[] => {
    if (!backendExecutions || !symbol) return [];
    const currentMarketType = marketType ?? 'FUTURES';
    return backendExecutions
      .filter(exec => exec.symbol === symbol && (exec.marketType ?? 'FUTURES') === currentMarketType)
      .map(exec => ({
        id: exec.id,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: exec.entryPrice,
        quantity: exec.quantity,
        stopLoss: exec.stopLoss,
        takeProfit: exec.takeProfit,
        status: exec.status,
        setupType: exec.setupType,
        marketType: exec.marketType,
        openedAt: exec.openedAt,
        triggerKlineOpenTime: exec.triggerKlineOpenTime,
        fibonacciProjection: exec.fibonacciProjection ? JSON.parse(exec.fibonacciProjection) : null,
        leverage: exec.leverage ?? 1,
        liquidationPrice: exec.liquidationPrice,
      }));
  }, [backendExecutions, symbol, marketType]);

  const orphanOrderExecutions = useMemo((): BackendExecution[] =>
    orphanOrdersRaw.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side === 'BUY' ? 'LONG' as const : 'SHORT' as const,
      entryPrice: o.price,
      quantity: o.quantity,
      stopLoss: null,
      takeProfit: null,
      status: 'pending' as const,
      setupType: null,
      marketType: 'FUTURES' as const,
      openedAt: o.createdAt,
      entryOrderType: o.type as BackendExecution['entryOrderType'],
    })),
    [orphanOrdersRaw]
  );

  const trackedOrderExecutions = useMemo((): BackendExecution[] =>
    trackedOrdersRaw.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side === 'BUY' ? 'LONG' as const : 'SHORT' as const,
      entryPrice: o.price,
      quantity: o.quantity,
      stopLoss: null,
      takeProfit: null,
      status: 'pending' as const,
      setupType: null,
      marketType: 'FUTURES' as const,
      openedAt: o.createdAt,
      entryOrderType: o.type as BackendExecution['entryOrderType'],
    })),
    [trackedOrdersRaw]
  );

  const allExecutions = useMemo((): BackendExecution[] => {
    const realIds = new Set(filteredBackendExecutions.map(e => e.id));
    const uniqueOptimistic = optimisticExecutions.filter(o => {
      if (o.symbol !== symbol || realIds.has(o.id)) return false;
      const optPrice = parseFloat(o.entryPrice);
      const matchesOrphan = orphanOrderExecutions.some(
        orph => orph.symbol === o.symbol && orph.side === o.side &&
          Math.abs(parseFloat(orph.entryPrice) - optPrice) / optPrice < 0.01
      );
      return !matchesOrphan;
    });
    const merged = [...filteredBackendExecutions, ...uniqueOptimistic, ...orphanOrderExecutions, ...trackedOrderExecutions];
    closingSnapshotsRef.current.forEach((snapshot, id) => {
      if (!realIds.has(id)) merged.push(snapshot);
    });
    const overrides = optimisticOverridesRef.current;
    if (overrides.size === 0) return merged;
    return merged
      .filter(e => {
        const ov = overrides.get(e.id);
        if (!ov) return true;
        if (orderLoadingMapRef.current.has(e.id)) return true;
        return ov.patches.status !== 'cancelled' && ov.patches.status !== 'closed';
      })
      .map(e => {
        const ov = overrides.get(e.id);
        if (!ov) return e;
        return { ...e, ...ov.patches };
      });
  }, [filteredBackendExecutions, optimisticExecutions, symbol, orphanOrderExecutions, trackedOrderExecutions, overrideVersion, closingVersion]);

  useEffect(() => {
    const overrides = optimisticOverridesRef.current;
    if (overrides.size === 0) return;
    const now = Date.now();
    let changed = false;
    const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions, ...trackedOrderExecutions];
    for (const [id, ov] of overrides) {
      // 1. Hard safety cap — give up after 30s regardless of state.
      if (now - ov.timestamp > OPTIMISTIC_OVERRIDE_HARD_CAP_MS) {
        overrides.delete(id);
        changed = true;
        continue;
      }
      const serverExec = allReal.find(e => e.id === id);
      // 2. Server no longer lists the entry — for status='cancelled' /
      //    'closed' patches this means the cancel/close completed; the
      //    override is now moot and would just take memory. Delete.
      //    (For other patches like entryPrice/stopLoss/takeProfit, a
      //    missing server entry is an edge case — also safe to delete.)
      if (!serverExec) {
        overrides.delete(id);
        changed = true;
        continue;
      }
      // 3. Server already reflects every patched field — override is
      //    redundant.
      const patchKeys = Object.keys(ov.patches) as (keyof OptimisticOverride['patches'])[];
      const serverMatches = patchKeys.every(k => {
        const patchVal = ov.patches[k];
        const serverVal = serverExec[k];
        if (patchVal === null || patchVal === undefined) return serverVal === null || serverVal === undefined;
        return String(serverVal) === String(patchVal);
      });
      if (serverMatches) {
        overrides.delete(id);
        changed = true;
      }
      // 4. Otherwise: server still has the entry with the OLD state. Keep
      //    the override so the user's optimistic intent stays on screen
      //    until the server catches up (or the hard cap fires).
    }
    if (changed) setOverrideVersion(v => v + 1);
  }, [filteredBackendExecutions, orphanOrderExecutions, trackedOrderExecutions]);

  // Snapshot the closing position so the chart can play the
  // "line fades out + flash" animation for ~800 ms even if the query
  // cache reconciles faster. RealtimeTradingSyncContext has already
  // patched the cache to status='closed' synchronously by the time this
  // fires — we just hold a snapshot for the visual.
  useSocketEvent('position:closed', (data: PositionClosedPayload) => {
    if (!backendWalletId) return;
    const exec = filteredBackendExecutions.find((e) => e.id === data.positionId);
    if (!exec) return;
    closingSnapshotsRef.current.set(exec.id, exec);
    orderFlashMapRef.current.set(exec.id, performance.now());
    setClosingVersion((v) => v + 1);
    setTimeout(() => {
      closingSnapshotsRef.current.delete(exec.id);
      setClosingVersion((v) => v + 1);
    }, 800);
  }, !!backendWalletId);

  // Flash animation when SL/TP/entryPrice change. The cache patch itself
  // happens upstream in RealtimeTradingSyncContext (setData on the
  // socket payload) so the chart already re-renders with the new values
  // — this hook only kicks the flash timer so the user sees a visible
  // "I noticed" cue. We still also call applyOptimistic to mark the
  // override as touched so any concurrent user-initiated drag doesn't
  // get clobbered by a stale auto-clear sweep.
  useSocketEvent('position:update', (raw) => {
    if (!backendWalletId) return;
    const data = raw as Partial<BackendExecution> & { id?: string };
    if (!data?.id) return;
    const exec = filteredBackendExecutions.find((e) => e.id === data.id);
    if (!exec) return;
    if (
      data.stopLoss !== undefined ||
      data.takeProfit !== undefined ||
      data.entryPrice !== undefined ||
      data.status !== undefined
    ) {
      orderFlashMapRef.current.set(exec.id, performance.now());
    }
  }, !!backendWalletId);

  useSocketEvent('order:update', (raw) => {
    if (!backendWalletId) return;
    const data = raw as Partial<BackendExecution> & { id?: string };
    if (!data?.id) return;
    const exec = filteredBackendExecutions.find((e) => e.id === data.id);
    if (exec?.status !== 'pending') return;
    if (data.entryPrice !== undefined && data.entryPrice !== exec.entryPrice) {
      orderFlashMapRef.current.set(exec.id, performance.now());
    }
  }, !!backendWalletId);

  useEffect(() => {
    if (optimisticExecutions.length === 0) return;
    const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions, ...trackedOrderExecutions];
    const now = Date.now();
    const remaining = optimisticExecutions.filter(opt => {
      const openedMs = opt.openedAt instanceof Date ? opt.openedAt.getTime() : opt.openedAt ? new Date(opt.openedAt).getTime() : now;
      const isLoading = orderLoadingMapRef.current.has(opt.id);
      // Keep the optimistic alive as long as either:
      //   - the mutation is still in flight (loading flag set), or
      //   - the TTL hasn't expired yet.
      // The user-reported "order disappears on release" hit when the
      // mutation completed (loading cleared) but the cache refetch
      // hadn't yet returned the new exchange order — the prior rule
      // dropped the optimistic, leaving a flicker of nothing.
      if (!isLoading && now - openedMs > OPTIMISTIC_ENTRY_TTL_MS) return false;
      const optPrice = parseFloat(opt.entryPrice);
      const matchingReal = allReal.find(real =>
        real.symbol === opt.symbol &&
        real.side === opt.side &&
        Math.abs(parseFloat(real.entryPrice) - optPrice) / optPrice < 0.01
      );
      if (matchingReal) return false;
      return true;
    });
    if (remaining.length !== optimisticExecutions.length) setOptimisticExecutions(remaining);
  }, [filteredBackendExecutions, orphanOrderExecutions, trackedOrderExecutions, optimisticExecutions]);

  const { data: symbolFiltersData } = trpc.trading.getSymbolFilters.useQuery(
    { symbol: symbol!, marketType: marketType ?? 'FUTURES' },
    { enabled: !!symbol, staleTime: 60 * 60 * 1000 }
  );

  const { needsScalpingMetrics, needsVolumeProfile } = useIndicatorVisibility();

  const { data: volumeProfileData } = trpc.scalping.getVolumeProfile.useQuery(
    { walletId: backendWalletId ?? '', symbol: symbol ?? '' },
    { enabled: needsVolumeProfile && !!backendWalletId && !!symbol, refetchInterval: SCALPING_DEFAULTS.BOOK_SNAPSHOT_INTERVAL_MS },
  );

  return {
    activeWallet,
    backendWalletId,
    hasTradingEnabled,
    backendExecutions,
    allExecutions,
    trailingStopLineConfig,
    watcherStatus,
    optimisticExecutions,
    setOptimisticExecutions,
    orderLoadingMapRef,
    orderFlashMapRef,
    closingSnapshotsRef,
    closingVersion,
    setClosingVersion,
    optimisticOverridesRef,
    overrideVersion,
    applyOptimistic,
    clearOptimistic,
    symbolFiltersData,
    exchangeOpenOrders,
    exchangeAlgoOrders,
    needsScalpingMetrics,
    needsVolumeProfile,
    volumeProfileData,
    symbolTrailingConfig,
  };
};

export type { OptimisticOverride };
