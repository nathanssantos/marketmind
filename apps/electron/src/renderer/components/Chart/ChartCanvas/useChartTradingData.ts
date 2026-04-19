import type { MarketType } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useOrphanOrders } from '@renderer/hooks/useOrphanOrders';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';
import { useIndicatorStore } from '@renderer/store';
import { trpc } from '@renderer/utils/trpc';
import { QUERY_CONFIG } from '@shared/constants/queryConfig';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BackendExecution, TrailingStopLineConfig } from '../useOrderLinesRenderer';

interface OptimisticOverride {
  patches: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  previousValues: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  timestamp: number;
}

const OPTIMISTIC_OVERRIDE_TTL_MS = 30_000;

export interface UseChartTradingDataProps {
  symbol?: string;
  marketType?: MarketType;
  chartType: string;
}

export const useChartTradingData = ({
  symbol,
  marketType,
  chartType,
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

  const executionPolling = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL);
  const configPolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.NORMAL);

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
    const currentMarketType = marketType || 'FUTURES';
    return backendExecutions
      .filter(exec => exec.symbol === symbol && (exec.marketType || 'FUTURES') === currentMarketType)
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
    for (const [id, ov] of overrides) {
      if (now - ov.timestamp > OPTIMISTIC_OVERRIDE_TTL_MS) {
        overrides.delete(id);
        changed = true;
        continue;
      }
      const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions, ...trackedOrderExecutions];
      const serverExec = allReal.find(e => e.id === id);
      if (!serverExec) continue;
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
    }
    if (changed) setOverrideVersion(v => v + 1);
  }, [filteredBackendExecutions, orphanOrderExecutions, trackedOrderExecutions]);

  useEffect(() => {
    if (optimisticExecutions.length === 0) return;
    const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions, ...trackedOrderExecutions];
    const now = Date.now();
    const remaining = optimisticExecutions.filter(opt => {
      const openedMs = opt.openedAt instanceof Date ? opt.openedAt.getTime() : opt.openedAt ? new Date(opt.openedAt).getTime() : now;
      if (now - openedMs > OPTIMISTIC_OVERRIDE_TTL_MS) return false;
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

  const isTickOrVolumeChart = chartType === 'tick' || chartType === 'volume';
  const needsScalpingMetrics = useIndicatorStore((s) =>
    s.instances.some((i) => i.visible && (i.catalogType === 'cvd' || i.catalogType === 'bookImbalance'))
  );

  const { data: scalpingCfg } = trpc.scalping.getConfig.useQuery(
    { walletId: backendWalletId ?? '' },
    { enabled: isTickOrVolumeChart && !!backendWalletId },
  );
  const resolvedTicksPerBar = scalpingCfg?.ticksPerBar ?? SCALPING_DEFAULTS.TICK_SIZE;
  const resolvedVolumePerBar = scalpingCfg?.volumePerBar ? Number(scalpingCfg.volumePerBar) : SCALPING_DEFAULTS.VOLUME_BAR_SIZE;

  const needsVolumeProfile = useIndicatorStore((s) =>
    s.instances.some((i) => i.visible && i.catalogType === 'volumeProfile')
  );
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
    scalpingCfg,
    resolvedTicksPerBar,
    resolvedVolumePerBar,
    needsVolumeProfile,
    volumeProfileData,
    symbolTrailingConfig,
  };
};

export type { OptimisticOverride };
