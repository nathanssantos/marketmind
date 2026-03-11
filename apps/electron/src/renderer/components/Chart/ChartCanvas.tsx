import { Button } from '@/renderer/components/ui/button';
import {
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
} from '@/renderer/components/ui/dialog';
import { Box, Portal } from '@chakra-ui/react';
import { calculateFibonacciProjection, calculateProjectionLevels } from '@marketmind/indicators';
import type { Kline, MarketType, Order, TimeInterval, Viewport } from '@marketmind/types';
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
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { trpc } from '@renderer/utils/trpc';
import { CHART_CONFIG } from '@shared/constants';
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
import { formatChartPrice } from '@renderer/utils/formatters';
import { useOrderLinesRenderer, type BackendExecution } from './useOrderLinesRenderer';
import { usePriceMagnet } from './usePriceMagnet';
import { useDrawingInteraction } from './drawings/useDrawingInteraction';
import { useDrawingsRenderer } from './drawings/useDrawingsRenderer';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { useBackendDrawings } from '@renderer/hooks/useBackendDrawings';
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

export interface ChartCanvasProps {
  klines: Kline[];
  symbol?: string;
  marketType?: MarketType;
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'kline' | 'line';
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
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', true);
  const [showFibonacciProjection] = useChartPref('showFibonacciProjection', true);
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

  const hasTradingEnabled = !!backendWalletId;

  const [optimisticExecutions, setOptimisticExecutions] = useState<BackendExecution[]>([]);
  const orderLoadingMapRef = useRef<Map<string, boolean>>(new Map());
  const orderFlashMapRef = useRef<Map<string, number>>(new Map());

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

  const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: backendWalletId ?? '' },
    {
      enabled: !!backendWalletId && !!symbol,
      refetchInterval: 10000,
    }
  );

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
      }));
  }, [backendExecutions, symbol, marketType]);

  const allExecutions = useMemo((): BackendExecution[] => {
    const realIds = new Set(filteredBackendExecutions.map(e => e.id));
    const uniqueOptimistic = optimisticExecutions.filter(
      o => o.symbol === symbol && !realIds.has(o.id)
    );
    return [...filteredBackendExecutions, ...uniqueOptimistic];
  }, [filteredBackendExecutions, optimisticExecutions, symbol]);

  const quickTradeSizePercent = useQuickTradeStore((s) => s.sizePercent);
  const quickTradeUseMinNotional = useQuickTradeStore((s) => s.useMinNotional);

  const { data: symbolFiltersData } = trpc.trading.getSymbolFilters.useQuery(
    { symbol: symbol!, marketType: marketType ?? 'FUTURES' },
    { enabled: !!symbol, staleTime: 60 * 60 * 1000 }
  );
  const minNotional = symbolFiltersData?.minNotional ?? 5;

  const getOrderQuantity = useCallback((price: number): string => {
    const balance = parseFloat(activeWallet?.currentBalance ?? '0');
    if (quickTradeUseMinNotional) {
      const qty = price > 0 ? minNotional / price : 0;
      return roundTradingQty(qty);
    }
    const pct = quickTradeSizePercent / 100;
    const qty = balance > 0 && price > 0 ? (balance * pct) / price : 1;
    return roundTradingQty(qty);
  }, [activeWallet?.currentBalance, quickTradeSizePercent, quickTradeUseMinNotional, minNotional]);

  const latestKlinesPriceRef = useRef(klines.length > 0 ? getKlineClose(klines[klines.length - 1]!) : 0);
  latestKlinesPriceRef.current = klines.length > 0 ? getKlineClose(klines[klines.length - 1]!) : 0;

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
    } finally {
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
    } finally {
      setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
    }
  }, [addBackendOrder, symbol, marketType, getOrderQuantity, warning, toastError, t, backendWalletId, utils]);

  const {
    canvasRef,
    manager,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useChartCanvas({
    klines,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
    onNearLeftEdge,
  });

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({
    klines,
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
      }, 150);
    }
    return () => {
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
    };
  }, [isPanning]);

  const handleOrderCloseRequest = useCallback((orderId: string | null): void => {
    if (!orderId) {
      setOrderToClose(null);
      return;
    }
    if (orderId.startsWith('sltp-')) {
      setOrderToClose(orderId);
      return;
    }
    const exec = allExecutions.find((e) => e.id === orderId);
    if (exec?.status === 'pending') {
      orderLoadingMapRef.current.set(exec.id, true);
      manager?.markDirty('overlays');
      cancelExecution(exec.id).finally(() => {
        orderLoadingMapRef.current.delete(exec.id);
        manager?.markDirty('overlays');
      });
      return;
    }
    setOrderToClose(orderId);
  }, [allExecutions, cancelExecution, setOrderToClose, manager]);

  const handleConfirmCloseOrder = useCallback(async (): Promise<void> => {
    if (!orderToClose || !manager) return;

    if (orderToClose.startsWith('sltp-')) {
      const parts = orderToClose.split('-');
      const type = parts[1] as 'stopLoss' | 'takeProfit';
      const executionIds = parts[2]?.split(',') || [];

      if (executionIds.length > 0) {
        executionIds.forEach(id => orderLoadingMapRef.current.set(id, true));
        manager.markDirty('overlays');
        try {
          await cancelProtectionOrder(executionIds, type);
        } finally {
          executionIds.forEach(id => orderLoadingMapRef.current.delete(id));
          manager.markDirty('overlays');
        }
      }

      setOrderToClose(null);
      return;
    }

    const exec = allExecutions.find((e) => e.id === orderToClose);
    if (exec) {
      orderLoadingMapRef.current.set(exec.id, true);
      manager.markDirty('overlays');
      try {
        const klines = manager.getKlines();
        const lastKline = klines[klines.length - 1];
        const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
        await closeExecution(exec.id, exitPrice);
      } finally {
        orderLoadingMapRef.current.delete(exec.id);
        manager.markDirty('overlays');
      }
    }

    setOrderToClose(null);
  }, [orderToClose, manager, allExecutions, closeExecution, cancelProtectionOrder]);

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
    klines,
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

  const fibonacciProjectionData = useMemo(() => {
    const activePosition = allExecutions.find(
      exec => (exec.status === 'open' || exec.status === 'pending')
    );

    if (activePosition) {
      if (activePosition.fibonacciProjection) {
        const saved = activePosition.fibonacciProjection;
        const direction = activePosition.side as 'LONG' | 'SHORT';
        const levels = calculateProjectionLevels(saved.swingLow, saved.swingHigh, direction);
        return {
          ...saved,
          levels,
        };
      }

      if (manager) {
        const klinesData = manager.getKlines();
        if (klinesData.length > 0) {
          const triggerTime = activePosition.triggerKlineOpenTime;
          let entryIndex = -1;

          if (triggerTime) {
            const triggerTimestamp = typeof triggerTime === 'number' ? triggerTime : new Date(triggerTime).getTime();
            entryIndex = klinesData.findIndex(k => k.openTime === triggerTimestamp);
          }

          if (entryIndex !== -1) {
            const direction = activePosition.side as 'LONG' | 'SHORT';
            const projection = calculateFibonacciProjection(klinesData, entryIndex, timeframe as TimeInterval, direction);

            if (projection) {
              return {
                swingLow: projection.swingLow,
                swingHigh: projection.swingHigh,
                levels: projection.levels,
                primaryLevel: 2,
                range: projection.range,
              };
            }
          }
        }
      }
    }

    const visibleSetup = detectedSetups.find(s => s.visible && s.fibonacciProjection);
    if (visibleSetup?.fibonacciProjection) {
      const saved = visibleSetup.fibonacciProjection;
      const direction = visibleSetup.direction === 'LONG' ? 'LONG' : 'SHORT';
      const levels = calculateProjectionLevels(saved.swingLow, saved.swingHigh, direction);
      return {
        ...saved,
        levels,
      };
    }
    return null;
  }, [allExecutions, detectedSetups, manager]);

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
    renderFibonacciProjection,
    getEventAtPosition,
  } = useChartIndicatorRenderers({
    manager,
    colors,
    indicatorData,
    stochasticData,
    showFibonacciProjection,
    showEventRow,
    marketEvents,
    fibonacciProjectionData,
  });

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, allExecutions, detectedSetups.filter(s => s.visible), showProfitLossAreas, orderLoadingMapRef, orderFlashMapRef);

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
        orderId: 0,
        orderListId: -1,
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

    if (updates.entryPrice !== undefined) {
      updatePendingEntry({ id, newPrice: updates.entryPrice }).then(() => {
        orderFlashMapRef.current.set(id, performance.now());
        manager?.markDirty('overlays');
      }).catch((error) => {
        toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
      });
      return;
    }

    const updatePayload: { stopLoss?: number; takeProfit?: number } = {};

    if (updates.stopLoss !== undefined) {
      updatePayload.stopLoss = updates.stopLoss;
    }
    if (updates.takeProfit !== undefined) {
      updatePayload.takeProfit = updates.takeProfit;
    }

    if (Object.keys(updatePayload).length > 0) {
      updateExecutionSLTP(id, updatePayload).then(() => {
        orderFlashMapRef.current.set(id, performance.now());
        manager?.markDirty('overlays');
      }).catch((error) => {
        toastError(t('trading.order.slTpUpdateFailed'), error instanceof Error ? error.message : undefined);
      });
    }
  }, [updateExecutionSLTP, updatePendingEntry, manager]);

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
  });

  const slTpPlacement = useSlTpPlacementMode();

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
          price: type === 'LIMIT' ? roundTradingPrice(price) : undefined,
          stopPrice: type === 'STOP_MARKET' ? roundTradingPrice(price) : undefined,
          quantity,
        });
      } catch {
        break;
      }
    }

    utils.autoTrading.getActiveExecutions.invalidate();
  }, [backendWalletId, symbol, getOrderQuantity, addBackendOrder, utils]);

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
  });

  useBackendDrawings(symbol ?? '');

  const { render: renderDrawings } = useDrawingsRenderer({
    manager,
    symbol: symbol ?? '',
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
    handleCanvasMouseMove(event);

    if (!slTpPlacement.active && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (getSlTpButtonAtPosition(mouseX, mouseY)) {
        cursorManager.setCursor('pointer');
      }
    }
  }, [handleCanvasMouseMove, slTpPlacement, manager, cursorManager, getSlTpButtonAtPosition]);

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

      const updatePayload: { stopLoss?: number; takeProfit?: number } = {};
      if (placementType === 'stopLoss') updatePayload.stopLoss = price;
      else updatePayload.takeProfit = price;

      orderLoadingMapRef.current.set(execId, true);
      manager.markDirty('overlays');

      updateExecutionSLTP(execId, updatePayload).then(() => {
        orderLoadingMapRef.current.delete(execId);
        orderFlashMapRef.current.set(execId, performance.now());
        manager.markDirty('overlays');
      }).catch((error) => {
        orderLoadingMapRef.current.delete(execId);
        manager.markDirty('overlays');
        toastError(t('trading.order.slTpCreateFailed'), error instanceof Error ? error.message : undefined);
      });

      event.preventDefault();
      return;
    }

    handleCanvasMouseDown(event);
  }, [handleCanvasMouseDown, manager, getSlTpButtonAtPosition, slTpPlacement, updateExecutionSLTP, t, toastError]);

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
    const handleDeleteDrawing = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const drawingState = useDrawingStore.getState();
        if (drawingState.selectedDrawingId && symbol) {
          drawingState.deleteDrawing(drawingState.selectedDrawingId, symbol);
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
      if (chartType === 'kline') {
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
      renderFibonacciProjection();
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
          const currentPriceValue = currentPriceRef.current;
          const willExecuteImmediately =
            (isLong && previewPrice <= currentPriceValue) ||
            (!isLong && previewPrice >= currentPriceValue);

          if (willExecuteImmediately) {
            color = 'rgba(59, 130, 246, 0.9)';
            label = `${isLong ? 'L' : 'S'} ${currentPriceValue.toFixed(2)} [MARKET]`;
          } else {
            color = 'rgba(100, 116, 139, 0.7)';
            label = `${isLong ? 'L' : 'S'} ${previewPrice.toFixed(2)} [PENDING]`;
          }
        } else {
          const isStopLoss = dragType === 'stopLoss';
          color = isStopLoss ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)';
          const entryPrice = getOrderPrice(draggedOrder);
          const isLong = isOrderLong(draggedOrder);
          const pctChange = isStopLoss
            ? (isLong ? (previewPrice - entryPrice) / entryPrice : (entryPrice - previewPrice) / entryPrice) * 100
            : (isLong ? (previewPrice - entryPrice) / entryPrice : (entryPrice - previewPrice) / entryPrice) * 100;
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
          const color = isStopLoss ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)';

          const targetExec = allExecutions.find(e => e.id === slTpPlacement.executionId);
          const entryPrice = targetExec ? parseFloat(targetExec.entryPrice) : 0;
          const isLong = targetExec?.side === 'LONG';
          const pctChange = entryPrice > 0
            ? (isLong
                ? (previewPrice - entryPrice) / entryPrice
                : (entryPrice - previewPrice) / entryPrice) * 100
            : 0;
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

        const color = isLong ? colors.bullish : colors.bearish;
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
                  if (orderToClose.startsWith('sltp-')) {
                    const parts = orderToClose.split('-');
                    const type = parts[1];
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
