import {
  Button,
  DialogActionTrigger,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@renderer/components/ui';
import { Box, Portal } from '@chakra-ui/react';
import type { Kline, MarketType, Order, TimeInterval, Viewport } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useEventRefreshScheduler } from '@renderer/hooks/useEventRefreshScheduler';
import { useChartPref, useTradingPref } from '@renderer/store/preferencesStore';
import { useMarketEvents } from '@renderer/hooks/useMarketEvents';
import { useStochasticWorker } from '@renderer/hooks/useStochasticWorker';
import { useToast } from '@renderer/hooks/useToast';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorStore, useSetupStore } from '@renderer/store';
import { useOrderFlashStore } from '@renderer/store/orderFlashStore';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { useTrailingStopPlacementStore } from '@renderer/store/trailingStopPlacementStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { trpc } from '@renderer/utils/trpc';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';
import { CHART_CONFIG, ORDER_LINE_COLORS } from '@shared/constants';
import { getKlineClose, getOrderPrice, isOrderLong, isOrderPending, roundTradingPrice, roundTradingQty } from '@shared/utils';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ChartNavigation } from './ChartNavigation';
import { ChartTooltip } from './ChartTooltip';
import { useChartCanvas } from './useChartCanvas';
import { useGridInteraction } from './useGridInteraction';
import { useGridPreviewRenderer } from './useGridPreviewRenderer';
import { useOrderDragHandler } from './useOrderDragHandler';
import { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';
import { drawShieldIcon } from '@renderer/utils/canvas/canvasIcons';
import { formatChartPrice } from '@renderer/utils/formatters';
import { useOrderLinesRenderer, type BackendExecution, type TrailingStopLineConfig } from './useOrderLinesRenderer';
import { usePriceMagnet } from './usePriceMagnet';
import { useDrawingInteraction } from './drawings/useDrawingInteraction';
import { useDrawingsRenderer } from './drawings/useDrawingsRenderer';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { useBackendDrawings } from '@renderer/hooks/useBackendDrawings';
import { useOrphanOrders } from '@renderer/hooks/useOrphanOrders';
import type { MovingAverageConfig } from './useMovingAverageRenderer';
import {
  useChartState,
  useCursorManager,
  useChartIndicators,
  useChartPanelHeights,
  useChartBaseRenderers,
  useChartIndicatorRenderers,
  useChartInteraction,
  type IndicatorId,
} from './ChartCanvas/index';
import { useAggTrades } from '@renderer/hooks/useAggTrades';
import { useTickChart } from '@renderer/hooks/useTickChart';
import { useVolumeChart } from '@renderer/hooks/useVolumeChart';
import { useScalpingMetrics, type ScalpingMetricsHistoryEntry } from '@renderer/hooks/useScalpingMetrics';
import type { FootprintBar, FootprintLevel } from '@marketmind/types';

interface OptimisticOverride {
  patches: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  previousValues: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  timestamp: number;
}

const OPTIMISTIC_OVERRIDE_TTL_MS = 30_000;
const TOOLTIP_DEBOUNCE_MS = 150;

const mapHistoryToKlineValues = (
  history: ScalpingMetricsHistoryEntry[],
  klines: Kline[],
  selector: (entry: ScalpingMetricsHistoryEntry) => number,
  fallback: number,
): (number | null)[] => {
  if (history.length === 0 || klines.length === 0) return [];
  const values: (number | null)[] = new Array(klines.length).fill(null);
  let histIdx = 0;
  for (let i = 0; i < klines.length && histIdx < history.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    let lastMatch: number | null = null;
    while (histIdx < history.length && history[histIdx]!.timestamp <= kline.closeTime) {
      if (history[histIdx]!.timestamp >= kline.openTime) lastMatch = selector(history[histIdx]!);
      histIdx++;
    }
    if (lastMatch !== null) values[i] = lastMatch;
  }
  if (values[values.length - 1] === null) values[values.length - 1] = fallback;
  return values;
};

export interface ChartCanvasProps {
  klines: Kline[];
  symbol?: string;
  marketType?: MarketType;
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'kline' | 'line' | 'tick' | 'volume' | 'footprint';
  advancedConfig?: AdvancedControlsConfig;
  timeframe?: string;
  onNearLeftEdge?: () => void;
  isLoadingMore?: boolean;
}

export const ChartCanvas = ({
  klines,
  symbol,
  marketType,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  movingAverages = [],
  chartType = 'kline',
  advancedConfig,
  timeframe = '1h',
  onNearLeftEdge,
  isLoadingMore: _isLoadingMore,
}: ChartCanvasProps): ReactElement => {
  const [showGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair] = useChartPref('showCrosshair', true);
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', false);
  const [showTooltip] = useChartPref('showTooltip', false);
  const [showEventRow] = useChartPref('showEventRow', false);

  const isIndicatorActive = useIndicatorStore((s) => s.isActive);
  const showVolume = useIndicatorStore((s) => s.activeIndicators.includes('volume'));
  const showActivityIndicator = useIndicatorStore((s) => s.activeIndicators.includes('activityIndicator'));
  const { t } = useTranslation();
  const { warning, error: toastError } = useToast();
  const colors = useChartColors();

  const utils = trpc.useUtils();

  const { activeWallet } = useActiveWallet();
  const backendWalletId = activeWallet?.id;
  const {
    createOrder: addBackendOrder,
    closeExecution,
    cancelExecution,
    updateExecutionSLTP,
    cancelProtectionOrder,
    updatePendingEntry,
  } = useBackendTradingMutations();

  const updateTsConfig = trpc.trading.updateSymbolTrailingConfig.useMutation({
    onSuccess: () => {
      void utils.trading.getSymbolTrailingConfig.invalidate();
    },
    onError: (error) => {
      toastError(t('positionTrailingStop.activationFailed'), error.message);
    },
  });

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

  const [dragSlEnabled] = useTradingPref<boolean>('dragSlEnabled', true);
  const [dragTpEnabled] = useTradingPref<boolean>('dragTpEnabled', true);
  const [slTightenOnly] = useTradingPref<boolean>('slTightenOnly', false);

  const detectedSetups = useSetupStore((state) => state.detectedSetups);

  const highlightedCandlesRef = useRef(useStrategyVisualizationStore.getState().highlightedCandles);
  useEffect(() => {
    const unsubscribe = useStrategyVisualizationStore.subscribe((state) => {
      highlightedCandlesRef.current = state.highlightedCandles;
    });
    return () => unsubscribe();
  }, []);

  const { watcherStatus } = useBackendAutoTrading(backendWalletId ?? '');

  const tradingPolling = usePollingInterval(10_000);

  const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: backendWalletId ?? '' },
    {
      enabled: !!backendWalletId && !!symbol,
      refetchInterval: tradingPolling,
      staleTime: 1000,
    }
  );

  const { orphanOrders: orphanOrdersRaw, exchangeOpenOrders, exchangeAlgoOrders } = useOrphanOrders(
    backendWalletId ?? '',
    backendExecutions ?? [],
    symbol,
  );

  const { data: symbolTrailingConfig } = trpc.trading.getSymbolTrailingConfig.useQuery(
    { walletId: backendWalletId ?? '', symbol: symbol ?? '' },
    { enabled: !!backendWalletId && !!symbol, refetchInterval: tradingPolling, staleTime: 1000 }
  );

  const { data: walletAutoTradingConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId: backendWalletId ?? '' },
    { enabled: !!backendWalletId, refetchInterval: tradingPolling, staleTime: 1000 }
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
    const merged = [...filteredBackendExecutions, ...uniqueOptimistic, ...orphanOrderExecutions];
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
  }, [filteredBackendExecutions, optimisticExecutions, symbol, orphanOrderExecutions, overrideVersion, closingVersion]);

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
      const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions];
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
  }, [filteredBackendExecutions, orphanOrderExecutions]);

  useEffect(() => {
    if (optimisticExecutions.length === 0) return;
    const allReal = [...filteredBackendExecutions, ...orphanOrderExecutions];
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
  }, [filteredBackendExecutions, orphanOrderExecutions, optimisticExecutions]);

  const quickTradeSizePercent = useQuickTradeStore((s) => s.sizePercent);

  const { data: symbolFiltersData } = trpc.trading.getSymbolFilters.useQuery(
    { symbol: symbol!, marketType: marketType ?? 'FUTURES' },
    { enabled: !!symbol, staleTime: 60 * 60 * 1000 }
  );

  const getOrderQuantity = useCallback((price: number): string => {
    const balance = parseFloat(activeWallet?.currentBalance ?? '0');
    const pct = quickTradeSizePercent / 100;
    const qty = balance > 0 && price > 0 ? (balance * pct) / price : 1;
    return roundTradingQty(qty);
  }, [activeWallet?.currentBalance, quickTradeSizePercent]);

  const realtimePrice = usePriceStore((s) => symbol ? s.getPrice(symbol) : null);
  const klinePrice = klines.length > 0 ? getKlineClose(klines[klines.length - 1]!) : 0;
  const latestKlinesPriceRef = useRef(realtimePrice ?? klinePrice);
  latestKlinesPriceRef.current = realtimePrice ?? klinePrice;

  const handleLongEntry = useCallback(async (price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const isAboveMarket = marketPrice > 0 && price > marketPrice;
    const optimisticId = `opt-${Date.now()}`;

    setOptimisticExecutions(prev => [...prev, {
      id: optimisticId,
      symbol,
      side: 'LONG',
      entryPrice: roundTradingPrice(price),
      quantity: getOrderQuantity(price),
      stopLoss: null,
      takeProfit: null,
      status: 'pending',
      setupType: null,
      marketType: marketType || 'FUTURES',
      openedAt: new Date(),
      triggerKlineOpenTime: null,
      fibonacciProjection: null,
    }]);

    try {
      await addBackendOrder({
        walletId: backendWalletId,
        symbol,
        side: 'BUY',
        type: isAboveMarket ? 'STOP_MARKET' : 'LIMIT',
        price: isAboveMarket ? undefined : roundTradingPrice(price),
        stopPrice: isAboveMarket ? roundTradingPrice(price) : undefined,
        quantity: getOrderQuantity(price),
      });
      utils.autoTrading.getActiveExecutions.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
      setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
    }
  }, [addBackendOrder, symbol, marketType, getOrderQuantity, warning, toastError, t, backendWalletId, utils]);

  const handleShortEntry = useCallback(async (price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const isBelowMarket = marketPrice > 0 && price < marketPrice;
    const optimisticId = `opt-${Date.now()}`;

    setOptimisticExecutions(prev => [...prev, {
      id: optimisticId,
      symbol,
      side: 'SHORT',
      entryPrice: roundTradingPrice(price),
      quantity: getOrderQuantity(price),
      stopLoss: null,
      takeProfit: null,
      status: 'pending',
      setupType: null,
      marketType: marketType || 'FUTURES',
      openedAt: new Date(),
      triggerKlineOpenTime: null,
      fibonacciProjection: null,
    }]);

    try {
      await addBackendOrder({
        walletId: backendWalletId,
        symbol,
        side: 'SELL',
        type: isBelowMarket ? 'STOP_MARKET' : 'LIMIT',
        price: isBelowMarket ? undefined : roundTradingPrice(price),
        stopPrice: isBelowMarket ? roundTradingPrice(price) : undefined,
        quantity: getOrderQuantity(price),
      });
      utils.autoTrading.getActiveExecutions.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
      setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
    }
  }, [addBackendOrder, symbol, marketType, getOrderQuantity, warning, toastError, t, backendWalletId, utils]);

  const isTickOrVolumeChart = chartType === 'tick' || chartType === 'volume';
  const needsAggTrades = isTickOrVolumeChart || chartType === 'footprint';
  const { trades: aggTrades } = useAggTrades(needsAggTrades ? (symbol ?? null) : null, needsAggTrades);
  const { data: scalpingCfg } = trpc.scalping.getConfig.useQuery(
    { walletId: backendWalletId ?? '' },
    { enabled: isTickOrVolumeChart && !!backendWalletId },
  );
  const resolvedTicksPerBar = scalpingCfg?.ticksPerBar ?? SCALPING_DEFAULTS.TICK_SIZE;
  const resolvedVolumePerBar = scalpingCfg?.volumePerBar ? Number(scalpingCfg.volumePerBar) : SCALPING_DEFAULTS.VOLUME_BAR_SIZE;
  const tickKlines = useTickChart(chartType === 'tick' ? aggTrades : [], resolvedTicksPerBar);
  const volumeKlines = useVolumeChart(chartType === 'volume' ? aggTrades : [], resolvedVolumePerBar);

  const effectiveKlines = useMemo(() => {
    if (chartType === 'tick') return tickKlines;
    if (chartType === 'volume') return volumeKlines;
    return klines;
  }, [chartType, klines, tickKlines, volumeKlines]);

  const needsScalpingMetrics = useIndicatorStore((s) =>
    s.activeIndicators.includes('cvd') || s.activeIndicators.includes('bookImbalance') || s.activeIndicators.includes('volumeProfile')
  );
  const scalpingMetrics = useScalpingMetrics(needsScalpingMetrics ? (symbol ?? null) : null, needsScalpingMetrics);

  const cvdValuesRef = useRef<(number | null)[]>([]);
  const imbalanceValuesRef = useRef<(number | null)[]>([]);

  const needsVolumeProfile = useIndicatorStore((s) => s.activeIndicators.includes('volumeProfile'));
  const { data: volumeProfileData } = trpc.scalping.getVolumeProfile.useQuery(
    { walletId: backendWalletId ?? '', symbol: symbol ?? '' },
    { enabled: needsVolumeProfile && !!backendWalletId && !!symbol, refetchInterval: SCALPING_DEFAULTS.BOOK_SNAPSHOT_INTERVAL_MS },
  );

  const footprintBars = useMemo((): FootprintBar[] => {
    if (chartType !== 'footprint' || aggTrades.length === 0 || effectiveKlines.length === 0) return [];
    const bars: FootprintBar[] = [];

    for (const kline of effectiveKlines) {
      const klineStart = kline.openTime;
      const klineEnd = kline.closeTime;
      const levels = new Map<number, FootprintLevel>();

      for (const trade of aggTrades) {
        if (trade.timestamp < klineStart || trade.timestamp > klineEnd) continue;
        const priceKey = Math.round(trade.price * 100) / 100;
        const existing = levels.get(priceKey);
        if (existing) {
          if (trade.isBuyerMaker) {
            existing.bidVol += trade.quantity;
          } else {
            existing.askVol += trade.quantity;
          }
          existing.delta = existing.askVol - existing.bidVol;
        } else {
          levels.set(priceKey, {
            bidVol: trade.isBuyerMaker ? trade.quantity : 0,
            askVol: trade.isBuyerMaker ? 0 : trade.quantity,
            delta: trade.isBuyerMaker ? -trade.quantity : trade.quantity,
          });
        }
      }

      bars.push({
        openTime: klineStart,
        closeTime: klineEnd,
        open: parseFloat(String(kline.open)),
        high: parseFloat(String(kline.high)),
        low: parseFloat(String(kline.low)),
        close: parseFloat(String(kline.close)),
        levels,
      });
    }

    return bars;
  }, [chartType, aggTrades, effectiveKlines]);

  const {
    canvasRef,
    manager,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useChartCanvas({
    klines: effectiveKlines,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
    onNearLeftEdge,
  });

  useEffect(() => {
    manager?.markDirty('overlays');
  }, [backendExecutions, manager]);

  useEffect(() => {
    manager?.markDirty('overlays');
  }, [exchangeOpenOrders, exchangeAlgoOrders, manager]);

  useEffect(() => {
    if (!needsScalpingMetrics || effectiveKlines.length === 0) {
      cvdValuesRef.current = [];
      return;
    }
    cvdValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), effectiveKlines, (e) => e.cvd, scalpingMetrics.cvd);
    manager?.markDirty('overlays');
  }, [needsScalpingMetrics, effectiveKlines, scalpingMetrics.cvd, scalpingMetrics.metricsHistory, manager]);

  useEffect(() => {
    if (!needsScalpingMetrics || effectiveKlines.length === 0) {
      imbalanceValuesRef.current = [];
      return;
    }
    imbalanceValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), effectiveKlines, (e) => e.imbalanceRatio, scalpingMetrics.imbalanceRatio);
    manager?.markDirty('overlays');
  }, [needsScalpingMetrics, effectiveKlines, scalpingMetrics.imbalanceRatio, scalpingMetrics.metricsHistory, manager]);

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({
    klines: effectiveKlines,
    movingAverages,
  });

  const { tooltipData, orderToClose, stochasticData } = chartState;
  const {
    setTooltip: setTooltipData,
    setOrderToClose,
    setStochasticData,
  } = chartActions;
  const {
    mousePosition: mousePositionRef,
    orderPreview: orderPreviewRef,
    hoveredMAIndex: hoveredMAIndexRef,
    hoveredOrderId: hoveredOrderIdRef,
    lastHoveredOrder: lastHoveredOrderRef,
    lastTooltipOrder: lastTooltipOrderRef,
    tooltipEnabled: tooltipEnabledRef,
    tooltipDebounce: tooltipDebounceRef,
  } = chartRefs;

  const draggedOrderIdRef = useRef<string | null>(null);
  const setGridModeActive = useGridOrderStore((s) => s.setGridModeActive);

  const { shiftPressed, altPressed } = useTradingShortcuts({
    onLongEntry: handleLongEntry,
    onShortEntry: handleShortEntry,
    onEscape: () => {
      if (orderPreviewRef.current !== null) {
        orderPreviewRef.current = null;
        manager?.markDirty('overlays');
      }
      if (useGridOrderStore.getState().isGridModeActive) {
        useGridOrderStore.getState().resetDrawing();
        setGridModeActive(false);
        manager?.markDirty('overlays');
      }
      const drawingState = useDrawingStore.getState();
      if (drawingState.activeTool) {
        drawingState.setActiveTool(null);
      }
      if (drawingState.selectedDrawingId) {
        drawingState.selectDrawing(null);
        manager?.markDirty('overlays');
      }
    },
    enabled: true,
  });

  const cursorManager = useCursorManager(canvasRef);
  const { calculateStochastic } = useStochasticWorker();

  const activeIndicators = useIndicatorStore(useShallow((s) => s.activeIndicators));

  const indicatorData = useChartIndicators({
    klines,
    activeIndicators: activeIndicators as IndicatorId[],
  });

  const { events: marketEvents, refetch: refetchMarketEvents } = useMarketEvents({ klines, enabled: showEventRow });

  useEventRefreshScheduler({
    activeWatchers: watcherStatus?.activeWatchers ?? [],
    chartInterval: timeframe as TimeInterval,
    enabled: showEventRow,
    onRefresh: refetchMarketEvents,
  });

  useEffect(() => {
    if (isPanning) {
      tooltipEnabledRef.current = false;
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    } else {
      tooltipDebounceRef.current = setTimeout(() => {
        tooltipEnabledRef.current = true;
      }, TOOLTIP_DEBOUNCE_MS);
    }
    return () => {
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
    };
  }, [isPanning]);

  const cancelFuturesOrderMutation = trpc.futuresTrading.cancelOrder.useMutation({
    onSuccess: () => {
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.futuresTrading.getOpenAlgoOrders.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
    },
  });

  const handleOrderCloseRequest = useCallback((orderId: string | null): void => {
    if (!orderId) {
      setOrderToClose(null);
      return;
    }
    if (orderId === 'ts-disable') {
      if (!backendWalletId || !symbol) return;
      updateTsConfig.mutate({
        walletId: backendWalletId,
        symbol,
        useIndividualConfig: true,
        trailingStopEnabled: false,
      });
      return;
    }
    if (orderId.startsWith('sltp:')) {
      setOrderToClose(orderId);
      return;
    }
    if (orderId.startsWith('exchange-order-') || orderId.startsWith('exchange-algo-')) {
      const exchangeOrderId = orderId.replace(/^exchange-(order|algo)-/, '');
      if (!backendWalletId || !symbol || !exchangeOrderId) return;
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(orderId, cancelPatches, { status: 'pending' });
      orderLoadingMapRef.current.set(orderId, Date.now());
      manager?.markDirty('overlays');
      cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: exchangeOrderId })
        .catch((error) => {
          clearOptimistic(orderId, cancelPatches);
          toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
        })
        .finally(() => {
          orderLoadingMapRef.current.delete(orderId);
          manager?.markDirty('overlays');
        });
      return;
    }
    const exec = allExecutions.find((e) => e.id === orderId);
    if (!exec) return;
    if (exec.status === 'pending') {
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(exec.id, cancelPatches, { status: exec.status });
      orderLoadingMapRef.current.set(exec.id, Date.now());
      manager?.markDirty('overlays');
      cancelExecution(exec.id).catch((error: unknown) => {
        clearOptimistic(exec.id, cancelPatches);
        toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(exec.id);
        manager?.markDirty('overlays');
      });
      return;
    }
    setOrderToClose(orderId);
  }, [allExecutions, cancelExecution, setOrderToClose, manager, backendWalletId, symbol, cancelFuturesOrderMutation, applyOptimistic, clearOptimistic, toastError, t, updateTsConfig]);

  const handleConfirmCloseOrder = useCallback(async (): Promise<void> => {
    if (!orderToClose || !manager) return;
    const closingOrderId = orderToClose;
    setOrderToClose(null);

    if (closingOrderId.startsWith('sltp:')) {
      const firstColon = closingOrderId.indexOf(':');
      const secondColon = closingOrderId.indexOf(':', firstColon + 1);
      const type = closingOrderId.substring(firstColon + 1, secondColon) as 'stopLoss' | 'takeProfit';
      const executionIds = closingOrderId.substring(secondColon + 1).split(',').filter(Boolean);

      if (executionIds.length > 0) {
        const patchField = type === 'stopLoss' ? 'stopLoss' : 'takeProfit';
        executionIds.forEach(id => {
          const exec = allExecutions.find(e => e.id === id);
          applyOptimistic(id, { [patchField]: null }, { [patchField]: exec?.[patchField] });
          orderLoadingMapRef.current.set(id, Date.now());
        });
        manager.markDirty('overlays');
        try {
          await cancelProtectionOrder(executionIds, type);
          executionIds.forEach(id => {
            const flashKey = `${id}-${type === 'stopLoss' ? 'sl' : 'tp'}`;
            orderFlashMapRef.current.set(flashKey, performance.now());
          });
        } catch (error) {
          executionIds.forEach(id => clearOptimistic(id, { [patchField]: null }));
          toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
        } finally {
          executionIds.forEach(id => orderLoadingMapRef.current.delete(id));
          manager.markDirty('overlays');
        }
      }

      return;
    }

    const exec = allExecutions.find((e) => e.id === closingOrderId);
    if (exec) {
      closingSnapshotsRef.current.set(exec.id, exec);
      setClosingVersion(v => v + 1);
      orderLoadingMapRef.current.set(exec.id, Date.now());
      manager.markDirty('overlays');
      try {
        const klines = manager.getKlines();
        const lastKline = klines[klines.length - 1];
        const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
        await closeExecution(exec.id, exitPrice);
      } catch (error) {
        toastError(t('trading.order.closeFailed'), error instanceof Error ? error.message : undefined);
      } finally {
        closingSnapshotsRef.current.delete(exec.id);
        setClosingVersion(v => v + 1);
        orderLoadingMapRef.current.delete(exec.id);
        manager.markDirty('overlays');
      }
    }
  }, [orderToClose, manager, allExecutions, closeExecution, cancelProtectionOrder, toastError, t]);

  const {
    renderGrid,
    renderKlines,
    renderLineChart,
    renderVolume,
    renderMovingAverages,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderWatermark,
    getHoveredMATag,
    maValuesCache,
  } = useChartBaseRenderers({
    manager,
    klines: effectiveKlines,
    colors,
    chartType,
    advancedConfig,
    movingAverages,
    showGrid,
    showVolume,
    showCurrentPriceLine,
    showCrosshair,
    showActivityIndicator,
    hoveredKlineIndex: tooltipData.klineIndex,
    highlightedCandlesRef,
    hoveredMAIndexRef,
    mousePositionRef,
    timeframe,
    symbol,
    marketType,
  });

  const {
    renderStochastic,
    renderRSI,
    renderBollingerBands,
    renderATR,
    renderVWAP,
    renderParabolicSAR,
    renderKeltner,
    renderDonchian,
    renderSupertrend,
    renderIchimoku,
    renderOBV,
    renderCMF,
    renderStochRSI,
    renderMACD,
    renderADX,
    renderWilliamsR,
    renderCCI,
    renderKlinger,
    renderElderRay,
    renderAroon,
    renderVortex,
    renderMFI,
    renderROC,
    renderAO,
    renderTSI,
    renderPPO,
    renderCMO,
    renderUltimateOsc,
    renderDEMA,
    renderTEMA,
    renderWMA,
    renderHMA,
    renderPivotPoints,
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderEventScale,
    renderCVD,
    renderImbalance,
    renderVolumeProfile,
    renderFootprint,
    getEventAtPosition,
  } = useChartIndicatorRenderers({
    manager,
    colors,
    chartType,
    indicatorData,
    stochasticData,
    showEventRow,
    marketEvents,
    cvdValuesRef,
    imbalanceValuesRef,
    volumeProfile: volumeProfileData ?? null,
    footprintBars,
  });

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, allExecutions, detectedSetups.filter(s => s.visible), showProfitLossAreas, orderLoadingMapRef, orderFlashMapRef, trailingStopLineConfig, draggedOrderIdRef);

  const currentKlines = manager?.getKlines() ?? [];
  const lastKline = currentKlines[currentKlines.length - 1];
  const currentPrice = lastKline ? getKlineClose(lastKline) : 0;
  const currentPriceRef = useRef(currentPrice);
  currentPriceRef.current = currentPrice;

  const updatePrice = usePriceStore((s) => s.updatePrice);
  useEffect(() => {
    if (symbol && currentPrice > 0 && !isPanning) {
      updatePrice(symbol, currentPrice, 'chart');
    }
  }, [symbol, currentPrice, updatePrice, isPanning]);

  const draggableOrders = useMemo((): Order[] => {
    return allExecutions
      .filter(exec => exec.status === 'open' || exec.status === 'pending')
      .map(exec => ({
        id: exec.id,
        symbol: exec.symbol,
        orderId: '0',
        orderListId: '-1',
        clientOrderId: exec.id,
        price: exec.entryPrice,
        origQty: exec.quantity,
        executedQty: exec.status === 'pending' ? '0' : exec.quantity,
        cummulativeQuoteQty: '0',
        status: exec.status === 'pending' ? 'NEW' as const : 'FILLED' as const,
        timeInForce: 'GTC' as const,
        type: (exec.entryOrderType ?? (exec.status === 'pending' ? 'LIMIT' : 'MARKET')) as Order['type'],
        side: exec.side === 'LONG' ? 'BUY' : 'SELL',
        time: Date.now(),
        updateTime: Date.now(),
        isWorking: true,
        origQuoteOrderQty: '0',
        entryPrice: parseFloat(exec.entryPrice),
        quantity: parseFloat(exec.quantity),
        orderDirection: exec.side === 'LONG' ? 'long' : 'short',
        stopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : undefined,
        takeProfit: exec.takeProfit ? parseFloat(exec.takeProfit) : undefined,
        isAutoTrade: !!exec.setupType,
        walletId: backendWalletId ?? '',
        setupType: exec.setupType ?? undefined,
        isPendingLimitOrder: exec.status === 'pending',
      } as Order));
  }, [allExecutions, backendWalletId]);

  const handleUpdateOrder = useCallback((id: string, updates: Partial<Order>) => {
    if (!id) return;

    if (id.startsWith('exchange-') && updates.entryPrice !== undefined && backendWalletId && symbol) {
      const isAlgo = id.startsWith('exchange-algo-');
      const exchangeOrderId = id.replace(/^exchange-(order|algo)-/, '');
      if (!exchangeOrderId) return;

      const exec = allExecutions.find(e => e.id === id);
      if (!exec) return;

      const newPrice = roundTradingPrice(updates.entryPrice).toString();
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(id, cancelPatches, { status: 'pending' });
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      const optimisticId = `opt-exchange-${Date.now()}`;
      setOptimisticExecutions(prev => [...prev, {
        id: optimisticId,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: newPrice,
        quantity: exec.quantity,
        stopLoss: null,
        takeProfit: null,
        status: 'pending',
        setupType: null,
        marketType: exec.marketType ?? 'FUTURES',
        openedAt: new Date(),
        entryOrderType: exec.entryOrderType,
      }]);

      const side = exec.side === 'LONG' ? 'BUY' as const : 'SELL' as const;
      const orderType = isAlgo
        ? (exec.entryOrderType as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET') ?? 'STOP_MARKET' as const
        : 'LIMIT' as const;

      cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: exchangeOrderId })
        .then(() => addBackendOrder({
          walletId: backendWalletId,
          symbol,
          side,
          type: orderType,
          quantity: exec.quantity,
          ...(isAlgo ? { stopPrice: newPrice } : { price: newPrice }),
          reduceOnly: true,
        }))
        .catch((error) => {
          clearOptimistic(id, cancelPatches);
          setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
          toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
        })
        .finally(() => {
          orderLoadingMapRef.current.delete(id);
          manager?.markDirty('overlays');
        });
      return;
    }

    if (updates.entryPrice !== undefined) {
      const exec = allExecutions.find(e => e.id === id);
      const newPrice = roundTradingPrice(updates.entryPrice).toString();
      const prevValues = { entryPrice: exec?.entryPrice };
      const patches = { entryPrice: newPrice };
      applyOptimistic(id, patches, prevValues);
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      updatePendingEntry({ id, newPrice: updates.entryPrice }).then(() => {
        orderFlashMapRef.current.set(id, performance.now());
      }).catch((error) => {
        clearOptimistic(id, patches);
        toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(id);
        manager?.markDirty('overlays');
      });
      return;
    }

    const updatePayload: { stopLoss?: number; takeProfit?: number } = {};
    if (updates.stopLoss !== undefined) updatePayload.stopLoss = updates.stopLoss;
    if (updates.takeProfit !== undefined) updatePayload.takeProfit = updates.takeProfit;

    if (Object.keys(updatePayload).length > 0) {
      const exec = allExecutions.find(e => e.id === id);
      const patches: OptimisticOverride['patches'] = {};
      const prevValues: OptimisticOverride['previousValues'] = {};
      let flashKey = id;

      if (updatePayload.stopLoss !== undefined) {
        patches.stopLoss = updatePayload.stopLoss.toString();
        prevValues.stopLoss = exec?.stopLoss;
        flashKey = `${id}-sl`;
      }
      if (updatePayload.takeProfit !== undefined) {
        patches.takeProfit = updatePayload.takeProfit.toString();
        prevValues.takeProfit = exec?.takeProfit;
        flashKey = `${id}-tp`;
      }

      applyOptimistic(id, patches, prevValues);
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      updateExecutionSLTP(id, updatePayload).then(() => {
        orderFlashMapRef.current.set(flashKey, performance.now());
      }).catch((error) => {
        clearOptimistic(id, patches);
        toastError(t('trading.order.slTpUpdateFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(id);
        manager?.markDirty('overlays');
      });
    }
  }, [updateExecutionSLTP, updatePendingEntry, manager, backendWalletId, symbol, allExecutions, cancelFuturesOrderMutation, addBackendOrder, toastError, t, applyOptimistic, clearOptimistic]);

  const memoizedPriceToY = useCallback((price: number) => manager?.priceToY(price) ?? 0, [manager]);
  const memoizedYToPrice = useCallback((y: number) => manager?.yToPrice(y) ?? 0, [manager]);
  const memoizedGetOrderAtPosition = useCallback((x: number, y: number) => getOrderAtPosition(x, y), [getOrderAtPosition]);
  const memoizedMarkDirty = useCallback((layer: 'klines' | 'viewport' | 'dimensions' | 'overlays' | 'all') => manager?.markDirty(layer), [manager]);

  const orderDragHandler = useOrderDragHandler({
    orders: draggableOrders,
    updateOrder: handleUpdateOrder,
    priceToY: memoizedPriceToY,
    yToPrice: memoizedYToPrice,
    enabled: hasTradingEnabled && draggableOrders.length > 0,
    slDragEnabled: dragSlEnabled,
    tpDragEnabled: dragTpEnabled,
    slTightenOnly: dragSlEnabled ? slTightenOnly : false,
    getOrderAtPosition: memoizedGetOrderAtPosition,
    markDirty: memoizedMarkDirty,
    draggedOrderIdRef,
  });

  const slTpPlacement = useSlTpPlacementMode();

  const tsPlacementActive = useTrailingStopPlacementStore((s) => s.isPlacing);
  const tsPlacementPreviewPrice = useTrailingStopPlacementStore((s) => s.previewPrice);
  const tsPlacementDeactivate = useTrailingStopPlacementStore((s) => s.deactivate);
  const tsPlacementSetPreview = useTrailingStopPlacementStore((s) => s.setPreviewPrice);

  const isGridModeActive = useGridOrderStore((s) => s.isGridModeActive);
  const gridSnapEnabled = useGridOrderStore((s) => s.snapEnabled);
  const gridSnapDistancePx = useGridOrderStore((s) => s.snapDistancePx);

  const tickSize = symbolFiltersData?.tickSize ?? 0;

  const { getSnappedPrice } = usePriceMagnet({
    manager,
    enabled: isGridModeActive && gridSnapEnabled,
    snapDistancePx: gridSnapDistancePx,
    executions: allExecutions,
    tickSize: tickSize > 0 ? tickSize : undefined,
  });

  const handleGridConfirm = useCallback(async (prices: number[], side: 'BUY' | 'SELL') => {
    if (!backendWalletId || !symbol) return;

    const marketPrice = latestKlinesPriceRef.current;

    for (const price of prices) {
      const quantity = getOrderQuantity(price);
      if (!quantity || parseFloat(quantity) <= 0) continue;

      const isBuy = side === 'BUY';
      const isAboveMarket = marketPrice > 0 && price > marketPrice;
      const isBelowMarket = marketPrice > 0 && price < marketPrice;

      let type: 'LIMIT' | 'STOP_MARKET';
      if (isBuy) {
        type = isAboveMarket ? 'STOP_MARKET' : 'LIMIT';
      } else {
        type = isBelowMarket ? 'STOP_MARKET' : 'LIMIT';
      }

      try {
        await addBackendOrder({
          walletId: backendWalletId,
          symbol,
          side,
          type,
          marketType: marketType ?? 'FUTURES',
          price: type === 'LIMIT' ? roundTradingPrice(price) : undefined,
          stopPrice: type === 'STOP_MARKET' ? roundTradingPrice(price) : undefined,
          quantity,
        });
      } catch {
        break;
      }
    }

    utils.autoTrading.getActiveExecutions.invalidate();
  }, [backendWalletId, symbol, marketType, getOrderQuantity, addBackendOrder, utils]);

  const gridInteraction = useGridInteraction({
    manager,
    enabled: isGridModeActive && hasTradingEnabled,
    getSnappedPrice,
    onGridConfirm: handleGridConfirm,
  });

  const { renderGridPreview } = useGridPreviewRenderer({
    manager,
    getPreviewPrices: gridInteraction.getPreviewPrices,
  });

  const drawingInteraction = useDrawingInteraction({
    manager,
    klines,
    symbol: symbol ?? '',
    interval: timeframe,
  });

  useBackendDrawings(symbol ?? '', timeframe, klines);

  const { render: renderDrawings } = useDrawingsRenderer({
    manager,
    symbol: symbol ?? '',
    interval: timeframe,
    klines,
    colors: { bullish: colors.bullish, bearish: colors.bearish, crosshair: colors.crosshair },
    themeColors: colors,
    pendingDrawingRef: drawingInteraction.pendingDrawingRef,
    lastSnapRef: drawingInteraction.lastSnapRef,
  });

  const {
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
    handleWheel,
  } = useChartInteraction({
    manager,
    canvasRef,
    klines,
    movingAverages,
    maValuesCache,
    advancedConfig,
    showVolume,
    showEventRow,
    isPanning,
    shiftPressed,
    altPressed,
    tooltipEnabledRef,
    mousePositionRef,
    orderPreviewRef,
    hoveredMAIndexRef,
    hoveredOrderIdRef,
    lastHoveredOrderRef,
    lastTooltipOrderRef,
    setTooltipData,
    setOrderToClose: handleOrderCloseRequest,
    getHoveredMATag,
    getHoveredOrder,
    getEventAtPosition,
    getClickedOrderId,
    getSLTPAtPosition,
    onLongEntry: handleLongEntry,
    onShortEntry: handleShortEntry,
    orderDragHandler,
    gridInteraction: isGridModeActive ? gridInteraction : undefined,
    drawingInteraction,
    cursorManager,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
  });

  const handleCanvasMouseMoveWrapped = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (slTpPlacement.active && manager && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;
      slTpPlacement.updatePreviewPrice(manager.yToPrice(mouseY));
      manager.markDirty('overlays');
      cursorManager.setCursor('crosshair');
    }

    if (tsPlacementActive && manager && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;
      tsPlacementSetPreview(manager.yToPrice(mouseY));
      manager.markDirty('overlays');
      cursorManager.setCursor('crosshair');
    }

    handleCanvasMouseMove(event);

    if (!slTpPlacement.active && !tsPlacementActive && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (getSlTpButtonAtPosition(mouseX, mouseY)) {
        cursorManager.setCursor('pointer');
      }
    }
  }, [handleCanvasMouseMove, slTpPlacement, tsPlacementActive, tsPlacementSetPreview, manager, cursorManager, getSlTpButtonAtPosition]);

  const handleCanvasMouseDownWrapped = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manager || !canvasRef.current) {
      handleCanvasMouseDown(event);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const slTpButton = getSlTpButtonAtPosition(mouseX, mouseY);
    if (slTpButton) {
      slTpPlacement.activate(slTpButton.type, slTpButton.executionId);
      event.preventDefault();
      return;
    }

    if (slTpPlacement.active && slTpPlacement.executionId) {
      const price = manager.yToPrice(mouseY);
      const execId = slTpPlacement.executionId;
      const placementType = slTpPlacement.type;
      slTpPlacement.deactivate();

      const exec = allExecutions.find(e => e.id === execId);
      const patchField = placementType === 'stopLoss' ? 'stopLoss' : 'takeProfit';
      const priceStr = price.toString();
      const patches = { [patchField]: priceStr } as OptimisticOverride['patches'];
      const prevValues = { [patchField]: exec?.[patchField] } as OptimisticOverride['previousValues'];
      applyOptimistic(execId, patches, prevValues);
      orderLoadingMapRef.current.set(execId, Date.now());

      const updatePayload: { stopLoss?: number; takeProfit?: number } = {};
      if (placementType === 'stopLoss') updatePayload.stopLoss = price;
      else updatePayload.takeProfit = price;

      updateExecutionSLTP(execId, updatePayload).then(() => {
        const flashKey = `${execId}-${placementType === 'stopLoss' ? 'sl' : 'tp'}`;
        orderFlashMapRef.current.set(flashKey, performance.now());
      }).catch((error) => {
        clearOptimistic(execId, patches);
        toastError(t('trading.order.slTpCreateFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(execId);
        manager.markDirty('overlays');
      });

      event.preventDefault();
      return;
    }

    if (tsPlacementActive) {
      const price = manager.yToPrice(mouseY);
      tsPlacementDeactivate();

      const openExecs = allExecutions.filter(e => e.status === 'open');
      if (openExecs.length === 0) {
        warning(t('positionTrailingStop.noPositionForPlacement'));
        event.preventDefault();
        return;
      }

      const sumByDir = new Map<string, { totalValue: number; totalQty: number }>();
      for (const ex of openExecs) {
        const entry = parseFloat(ex.entryPrice);
        const qty = parseFloat(ex.quantity);
        const prev = sumByDir.get(ex.side) ?? { totalValue: 0, totalQty: 0 };
        sumByDir.set(ex.side, { totalValue: prev.totalValue + entry * qty, totalQty: prev.totalQty + qty });
      }
      const avgEntryByDir = new Map<string, number>();
      for (const [side, { totalValue, totalQty }] of sumByDir) {
        if (totalQty > 0) avgEntryByDir.set(side, totalValue / totalQty);
      }

      const longEntry = avgEntryByDir.get('LONG');
      const shortEntry = avgEntryByDir.get('SHORT');
      const updateFields: Record<string, unknown> = { useIndividualConfig: true, trailingStopEnabled: true };

      if (longEntry && price > longEntry) {
        updateFields['trailingActivationPercentLong'] = (price / longEntry).toString();
        updateFields['trailingActivationModeLong'] = 'manual';
      } else if (shortEntry && price < shortEntry) {
        updateFields['trailingActivationPercentShort'] = (price / shortEntry).toString();
        updateFields['trailingActivationModeShort'] = 'manual';
      } else if (longEntry) {
        updateFields['trailingActivationPercentLong'] = (price / longEntry).toString();
        updateFields['trailingActivationModeLong'] = 'manual';
      } else if (shortEntry) {
        updateFields['trailingActivationPercentShort'] = (price / shortEntry).toString();
        updateFields['trailingActivationModeShort'] = 'manual';
      }

      if (backendWalletId && symbol) {
        updateTsConfig.mutate({ walletId: backendWalletId, symbol, ...updateFields });
      }

      event.preventDefault();
      return;
    }

    handleCanvasMouseDown(event);
  }, [handleCanvasMouseDown, manager, getSlTpButtonAtPosition, slTpPlacement, updateExecutionSLTP, tsPlacementActive, tsPlacementDeactivate, allExecutions, backendWalletId, symbol, updateTsConfig, warning, t, toastError, applyOptimistic, clearOptimistic]);

  useEffect(() => {
    if (!slTpPlacement.active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        slTpPlacement.deactivate();
        manager?.markDirty('overlays');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slTpPlacement.active, slTpPlacement.deactivate, manager]);

  useEffect(() => {
    if (!tsPlacementActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        tsPlacementDeactivate();
        manager?.markDirty('overlays');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tsPlacementActive, tsPlacementDeactivate, manager]);

  useEffect(() => {
    if (tsPlacementActive) tsPlacementDeactivate();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (orderDragHandler.isDragging) orderDragHandler.cancelDrag();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderDragHandler.isDragging, orderDragHandler.cancelDrag]);

  useEffect(() => {
    const handleDeleteDrawing = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const drawingState = useDrawingStore.getState();
        if (drawingState.selectedDrawingId && symbol) {
          drawingState.deleteDrawing(drawingState.selectedDrawingId, symbol, timeframe);
          manager?.markDirty('overlays');
        }
      }
    };

    window.addEventListener('keydown', handleDeleteDrawing);
    return () => window.removeEventListener('keydown', handleDeleteDrawing);
  }, [symbol, manager]);

  useEffect(() => {
    if (!slTpPlacement.active || !slTpPlacement.executionId) return;
    const targetExec = allExecutions.find(e => e.id === slTpPlacement.executionId);
    if (!targetExec || targetExec.status !== 'open') {
      slTpPlacement.deactivate();
    }
  }, [allExecutions, slTpPlacement]);

  const ORDER_LOADING_TIMEOUT_MS = 15_000;

  useEffect(() => {
    if (orderLoadingMapRef.current.size === 0) return;
    const activeIds = new Set(allExecutions.map(e => e.id));
    const now = Date.now();
    let cleared = false;
    for (const [loadingId, startTime] of orderLoadingMapRef.current.entries()) {
      if (now - startTime > ORDER_LOADING_TIMEOUT_MS || activeIds.has(loadingId) === false) {
        orderLoadingMapRef.current.delete(loadingId);
        cleared = true;
      }
    }
    if (cleared) manager?.markDirty('overlays');
  }, [allExecutions, manager]);

  useEffect(() => {
    if (!manager) return;
    const interval = setInterval(() => manager.markDirty('overlays'), 1000);
    return () => clearInterval(interval);
  }, [manager]);

  useEffect(() => {
    if (!manager) return;
    let rafId = 0;
    const animationLoop = () => {
      const hasLoading = orderLoadingMapRef.current.size > 0;
      const hasFlash = orderFlashMapRef.current.size > 0 || useOrderFlashStore.getState().flashes.size > 0;
      if (hasLoading || hasFlash) {
        manager.markDirty('overlays');
        rafId = requestAnimationFrame(animationLoop);
      }
    };
    const checkInterval = setInterval(() => {
      if (orderLoadingMapRef.current.size > 0 || orderFlashMapRef.current.size > 0 || useOrderFlashStore.getState().flashes.size > 0) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(animationLoop);
      }
    }, 100);
    return () => {
      clearInterval(checkInterval);
      cancelAnimationFrame(rafId);
    };
  }, [manager]);

  const handleResetView = (): void => {
    if (manager) {
      manager.resetToInitialView();
    }
  };

  const handleNextKline = (): void => {
    if (manager) {
      manager.panToNextKline();
    }
  };

  const showStochastic = isIndicatorActive('stochastic');
  useEffect(() => {
    if (!showStochastic || klines.length === 0) {
      setStochasticData(null);
      return;
    }

    const calculate = async (): Promise<void> => {
      try {
        const result = await calculateStochastic(klines, 14, 3, 3);
        setStochasticData(result);
      } catch (error) {
        console.error('Failed to calculate stochastic:', error);
        setStochasticData(null);
      }
    };

    calculate();
  }, [showStochastic, klines, calculateStochastic]);

  useChartPanelHeights({
    manager,
    showEventRow,
    activeIndicators: activeIndicators as IndicatorId[],
    advancedConfig,
  });

  useEffect(() => {
    if (!shiftPressed && !altPressed) {
      orderPreviewRef.current = null;
      if (manager) manager.markDirty('overlays');
      return;
    }

    const mousePos = mousePositionRef.current;
    if (mousePos && manager) {
      const dimensions = manager.getDimensions();
      if (!dimensions) return;

      const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

      if (mousePos.y < timeScaleTop) {
        const price = manager.yToPrice(mousePos.y);
        orderPreviewRef.current = {
          price,
          type: shiftPressed ? 'long' : 'short',
        };
        manager.markDirty('overlays');
      }
    }
  }, [shiftPressed, altPressed, manager]);

  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      manager.clear();
      renderWatermark();
      renderGrid();
      renderVolume();
      if (chartType === 'kline' || chartType === 'tick' || chartType === 'volume' || chartType === 'footprint') {
        renderKlines();
      } else {
        renderLineChart();
      }
      renderMovingAverages();
      renderStochastic();
      renderRSI();
      renderBollingerBands();
      renderATR();
      renderVWAP();
      renderParabolicSAR();
      renderKeltner();
      renderDonchian();
      renderSupertrend();
      renderIchimoku();
      renderDEMA();
      renderTEMA();
      renderWMA();
      renderHMA();
      renderPivotPoints();
      renderFibonacci();
      renderDrawings();
      renderFVG();
      renderLiquidityLevels();
      renderEventScale();
      renderOBV();
      renderCMF();
      renderStochRSI();
      renderMACD();
      renderADX();
      renderWilliamsR();
      renderCCI();
      renderKlinger();
      renderElderRay();
      renderAroon();
      renderVortex();
      renderMFI();
      renderROC();
      renderAO();
      renderTSI();
      renderPPO();
      renderCMO();
      renderUltimateOsc();
      renderCVD();
      renderImbalance();
      renderVolumeProfile();
      renderFootprint();
      renderCurrentPriceLine_Line();
      renderOrderLines();
      renderGridPreview();

      const currentDragPreviewPrice = orderDragHandler.getPreviewPrice();
      if (orderDragHandler.isDragging && orderDragHandler.draggedOrder && currentDragPreviewPrice !== null && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const { dragType, draggedOrder } = orderDragHandler;
        const previewPrice = currentDragPreviewPrice;
        const y = manager.priceToY(previewPrice);

        let color: string;
        let label: string;

        if (dragType === 'entry' && isOrderPending(draggedOrder)) {
          const isLong = isOrderLong(draggedOrder);
          color = isLong ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
          label = `${isLong ? 'L' : 'S'} ${previewPrice.toFixed(2)}`;
        } else {
          const isStopLoss = dragType === 'stopLoss';
          const entryPrice = getOrderPrice(draggedOrder);
          const isLong = isOrderLong(draggedOrder);
          const dragExecLeverage = (draggedOrder as Order & { leverage?: number }).leverage ?? 1;
          const pctChange = (isLong
            ? (previewPrice - entryPrice) / entryPrice
            : (entryPrice - previewPrice) / entryPrice) * 100 * dragExecLeverage;
          if (isStopLoss) {
            const slInProfit = isLong ? previewPrice > entryPrice : previewPrice < entryPrice;
            color = slInProfit ? 'rgba(15, 118, 56, 0.8)' : 'rgba(185, 28, 28, 0.8)';
          } else {
            color = 'rgba(15, 118, 56, 0.8)';
          }
          const pctSign = pctChange >= 0 ? '+' : '';
          label = `${isStopLoss ? 'SL' : 'TP'} ${previewPrice.toFixed(2)} (${pctSign}${pctChange.toFixed(2)}%)`;
        }

        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.chartWidth, y);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const labelPadding = 8;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const labelHeight = 18;
        const arrowWidth = 6;
        const labelWidth = textWidth + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, y);
        ctx.lineTo(labelWidth, y - labelHeight / 2);
        ctx.lineTo(0, y - labelHeight / 2);
        ctx.lineTo(0, y + labelHeight / 2);
        ctx.lineTo(labelWidth, y + labelHeight / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, labelPadding, y);

        ctx.restore();
      }

      if (slTpPlacement.active && slTpPlacement.previewPriceRef.current !== null && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (ctx && dimensions) {
          const previewPrice = slTpPlacement.previewPriceRef.current;
          const y = manager.priceToY(previewPrice);
          const isStopLoss = slTpPlacement.type === 'stopLoss';

          const targetExec = allExecutions.find(e => e.id === slTpPlacement.executionId);
          const entryPrice = targetExec ? parseFloat(targetExec.entryPrice) : 0;
          const isLong = targetExec?.side === 'LONG';
          const execLeverage = targetExec?.leverage ?? 1;
          const pctChange = entryPrice > 0
            ? (isLong
                ? (previewPrice - entryPrice) / entryPrice
                : (entryPrice - previewPrice) / entryPrice) * 100 * execLeverage
            : 0;

          let color: string;
          if (isStopLoss) {
            const slInProfit = entryPrice > 0 && (isLong ? previewPrice > entryPrice : previewPrice < entryPrice);
            color = slInProfit ? 'rgba(15, 118, 56, 0.8)' : 'rgba(185, 28, 28, 0.8)';
          } else {
            color = 'rgba(15, 118, 56, 0.8)';
          }

          const pctSign = pctChange >= 0 ? '+' : '';
          const label = `${isStopLoss ? 'SL' : 'TP'} ${formatChartPrice(previewPrice)} (${pctSign}${pctChange.toFixed(2)}%)`;

          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(dimensions.chartWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          const labelPadding = 8;
          const textWidth = ctx.measureText(label).width;
          const labelHeight = 18;
          const arrowWidth = 6;
          const labelWidth = textWidth + labelPadding * 2;

          ctx.beginPath();
          ctx.moveTo(labelWidth + arrowWidth, y);
          ctx.lineTo(labelWidth, y - labelHeight / 2);
          ctx.lineTo(0, y - labelHeight / 2);
          ctx.lineTo(0, y + labelHeight / 2);
          ctx.lineTo(labelWidth, y + labelHeight / 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, labelPadding, y);
          ctx.restore();
        }
      }

      if (tsPlacementActive && tsPlacementPreviewPrice !== null && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (ctx && dimensions) {
          const y = manager.priceToY(tsPlacementPreviewPrice);
          const color = ORDER_LINE_COLORS.TRAILING_STOP_LINE;
          const fillColor = ORDER_LINE_COLORS.TRAILING_STOP_FILL;
          const label = `TS ${formatChartPrice(tsPlacementPreviewPrice)}`;

          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(dimensions.chartWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.globalAlpha = 1;
          ctx.fillStyle = fillColor;
          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          const iconSize = 12;
          const iconPadding = 4;
          const labelPadding = 8;
          const textWidth = ctx.measureText(label).width;
          const labelHeight = 18;
          const arrowWidth = 6;
          const totalLabelWidth = iconSize + iconPadding + textWidth + labelPadding * 2;

          ctx.beginPath();
          ctx.moveTo(totalLabelWidth + arrowWidth, y);
          ctx.lineTo(totalLabelWidth, y - labelHeight / 2);
          ctx.lineTo(0, y - labelHeight / 2);
          ctx.lineTo(0, y + labelHeight / 2);
          ctx.lineTo(totalLabelWidth, y + labelHeight / 2);
          ctx.closePath();
          ctx.fill();

          drawShieldIcon(ctx, labelPadding, y - iconSize / 2, iconSize, ORDER_LINE_COLORS.TRAILING_STOP_ICON_STROKE);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, labelPadding + iconSize + iconPadding, y);
          ctx.restore();
        }
      }

      renderCurrentPriceLine_Label();
      renderCrosshairPriceLine();

      const orderPreviewValue = orderPreviewRef.current;
      if (orderPreviewValue && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const y = manager.priceToY(orderPreviewValue.price);
        const isLong = orderPreviewValue.type === 'long';

        const willBeActive = false;

        const color = isLong ? ORDER_LINE_COLORS.LONG_LINE : ORDER_LINE_COLORS.SHORT_LINE;
        const opacity = willBeActive ? 0.8 : 0.5; ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.chartWidth, y);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const statusLabel = willBeActive ? t('trading.active') : t('trading.pending');
        const directionSymbol = isLong ? '↑' : '↓';
        const label = `${directionSymbol} @ ${orderPreviewValue.price.toFixed(2)} [${statusLabel}]`;
        const labelPadding = 8;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const labelHeight = 18;
        const arrowWidth = 6;
        const labelWidth = textWidth + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, y);
        ctx.lineTo(labelWidth, y - labelHeight / 2);
        ctx.lineTo(0, y - labelHeight / 2);
        ctx.lineTo(0, y + labelHeight / 2);
        ctx.lineTo(labelWidth, y + labelHeight / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, labelPadding, y);

        ctx.restore();
      }

    };

    const renderWithDirtyFlagCleanup = () => {
      render();
      manager.clearDirtyFlags();
    };

    manager.setRenderCallback(renderWithDirtyFlagCleanup);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [
    manager,
    renderWatermark,
    renderGrid,
    renderVolume,
    renderKlines,
    renderLineChart,
    renderMovingAverages,
    renderStochastic,
    renderRSI,
    renderBollingerBands,
    renderATR,
    renderVWAP,
    renderParabolicSAR,
    renderKeltner,
    renderDonchian,
    renderSupertrend,
    renderIchimoku,
    renderOBV,
    renderCMF,
    renderStochRSI,
    renderMACD,
    renderADX,
    renderWilliamsR,
    renderCCI,
    renderKlinger,
    renderElderRay,
    renderAroon,
    renderVortex,
    renderMFI,
    renderROC,
    renderAO,
    renderTSI,
    renderPPO,
    renderCMO,
    renderUltimateOsc,
    renderDEMA,
    renderTEMA,
    renderWMA,
    renderHMA,
    renderPivotPoints,
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderEventScale,
    renderCVD,
    renderImbalance,
    renderVolumeProfile,
    renderFootprint,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderOrderLines,
    renderGridPreview,
    renderDrawings,
    chartType,
    colors,
    allExecutions,
    orderDragHandler,
    slTpPlacement,
    tsPlacementActive,
    tsPlacementPreviewPrice,
    t,
  ]);

  return (
    <>
      <Portal>
        <DialogRoot
          open={!!orderToClose}
          onOpenChange={(e) => !e.open && setOrderToClose(null)}
          placement="center"
        >
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('trading.closeOrder')}</DialogTitle>
                <DialogCloseTrigger />
              </DialogHeader>
              <DialogBody>
                {orderToClose && (() => {
                  if (orderToClose.startsWith('sltp:')) {
                    const firstColon = orderToClose.indexOf(':');
                    const secondColon = orderToClose.indexOf(':', firstColon + 1);
                    const type = orderToClose.substring(firstColon + 1, secondColon);
                    const typeLabel = type === 'stopLoss' ? 'Stop Loss' : 'Take Profit';

                    return (
                      <Box>
                        {t('trading.removeSLTPConfirm', { type: typeLabel })}
                      </Box>
                    );
                  }

                  const exec = allExecutions.find((e) => e.id === orderToClose);
                  if (!exec || !manager) return null;

                  const klines = manager.getKlines();
                  if (!klines.length) return null;

                  const lastKline = klines[klines.length - 1];
                  if (!lastKline) return null;

                  const currentPriceVal = getKlineClose(lastKline);
                  const isLong = exec.side === 'LONG';
                  const entryPrice = parseFloat(exec.entryPrice);
                  const priceChange = currentPriceVal - entryPrice;
                  const percentChange = isLong
                    ? (priceChange / entryPrice) * 100
                    : (-priceChange / entryPrice) * 100;
                  const isProfit = percentChange >= 0;

                  return (
                    <Box>
                      <Box mb={4}>
                        {t('trading.closeOrderConfirm', {
                          type: exec.side,
                          entry: entryPrice.toFixed(2),
                          current: currentPriceVal.toFixed(2),
                        })}
                      </Box>
                      <Box
                        fontSize="lg"
                        fontWeight="bold"
                        color={isProfit ? 'green.500' : 'red.500'}
                      >
                        {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                      </Box>
                    </Box>
                  );
                })()}
              </DialogBody>
              <DialogFooter>
                <DialogActionTrigger asChild>
                  <Button variant="outline">{t('common.cancel')}</Button>
                </DialogActionTrigger>
                <Button
                  onClick={handleConfirmCloseOrder}
                  colorPalette="red"
                >
                  {t('trading.confirmClose')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogPositioner>
        </DialogRoot>
      </Portal>
      <Box
        position="relative"
        width={width}
        height={height}
        overflow="hidden"
        bg={colors.background}
        userSelect="none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDownWrapped}
          onMouseMove={handleCanvasMouseMoveWrapped}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onWheel={handleWheel}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            display: 'block',
          }}
        />
        <ChartNavigation
          onResetView={handleResetView}
          onNextKline={handleNextKline}
          totalPanelHeight={manager?.getTotalPanelHeight() ?? 0}
        />
        {showTooltip && (
          <ChartTooltip
            kline={tooltipData.kline}
            x={tooltipData.x}
            y={tooltipData.y}
            visible={tooltipData.visible}
            containerWidth={tooltipData.containerWidth ?? window.innerWidth}
            containerHeight={tooltipData.containerHeight ?? window.innerHeight}
            {...(tooltipData.movingAverage && { movingAverage: tooltipData.movingAverage })}
            {...(tooltipData.measurement && { measurement: tooltipData.measurement })}
            {...(tooltipData.order && { order: tooltipData.order })}
            {...(tooltipData.currentPrice && { currentPrice: tooltipData.currentPrice })}
            {...(tooltipData.setup && { setup: tooltipData.setup })}
            {...(tooltipData.marketEvent && { marketEvent: tooltipData.marketEvent })}
          />
        )}
      </Box>
    </>
  );
};
