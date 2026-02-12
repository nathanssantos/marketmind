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
import { useLocalStorage } from '@renderer/hooks/useLocalStorage';
import { useMarketEvents } from '@renderer/hooks/useMarketEvents';
import { useStochasticWorker } from '@renderer/hooks/useStochasticWorker';
import { useToast } from '@renderer/hooks/useToast';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorStore, useSetupStore } from '@renderer/store';
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { trpc } from '@renderer/utils/trpc';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, isOrderLong, isOrderPending } from '@shared/utils';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ChartNavigation } from './ChartNavigation';
import { ChartTooltip } from './ChartTooltip';
import { KlineTimer } from './KlineTimer';
import { useChartCanvas } from './useChartCanvas';
import { useOrderDragHandler } from './useOrderDragHandler';
import { useOrderLinesRenderer, type BackendExecution } from './useOrderLinesRenderer';
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
  showGrid?: boolean;
  showVolume?: boolean;
  showStochastic?: boolean;
  showRSI?: boolean;
  showBollingerBands?: boolean;
  showATR?: boolean;
  showVWAP?: boolean;
  showCurrentPriceLine?: boolean;
  showCrosshair?: boolean;
  showProfitLossAreas?: boolean;
  showFibonacciProjection?: boolean;
  showMeasurementRuler?: boolean;
  showMeasurementArea?: boolean;
  showTooltip?: boolean;
  showActivityIndicator?: boolean;
  showEventRow?: boolean;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'kline' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  onToggleSetupsVisibility?: () => void;
  setupsVisible?: boolean;
  timeframe?: string;
}

export const ChartCanvas = ({
  klines,
  symbol,
  marketType,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  showGrid = true,
  showVolume = true,
  showStochastic = false,
  showRSI = false,
  showBollingerBands = false,
  showATR = false,
  showVWAP = false,
  showCurrentPriceLine = true,
  showCrosshair = true,
  showProfitLossAreas = true,
  showFibonacciProjection = false,
  showMeasurementRuler = false,
  showMeasurementArea = false,
  showTooltip = true,
  showActivityIndicator = true,
  showEventRow = false,
  movingAverages = [],
  chartType = 'kline',
  advancedConfig,
  onToggleSetupsVisibility: _onToggleSetupsVisibility,
  setupsVisible: _setupsVisible = true,
  timeframe = '12h',
}: ChartCanvasProps): ReactElement => {
  const { t } = useTranslation();
  const { warning } = useToast();
  const colors = useChartColors();

  const { activeWallet } = useActiveWallet();
  const backendWalletId = activeWallet?.id;
  const {
    createOrder: addBackendOrder,
    closeExecution,
    updateExecutionSLTP,
    cancelProtectionOrder,
  } = useBackendTradingMutations();

  const hasTradingEnabled = !!backendWalletId;

  const [quantityBySymbol] = useLocalStorage<Record<string, number>>('marketmind:quantityBySymbol', {});
  const getQuantityForSymbol = (sym: string) => quantityBySymbol[sym] ?? 1;

  const detectedSetups = useSetupStore((state) => state.detectedSetups);

  const highlightedCandlesRef = useRef(useStrategyVisualizationStore.getState().highlightedCandles);
  useEffect(() => {
    const unsubscribe = useStrategyVisualizationStore.subscribe((state) => {
      highlightedCandlesRef.current = state.highlightedCandles;
    });
    return () => unsubscribe();
  }, []);

  const { watcherStatus } = useBackendAutoTrading(backendWalletId ?? '');
  const isAutoTradingActive = watcherStatus?.active ?? false;

  const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: backendWalletId ?? '', limit: 50 },
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

  const handleLongEntry = useCallback((price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    addBackendOrder({
      walletId: backendWalletId,
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      price: price.toString(),
      quantity: (getQuantityForSymbol(symbol) ?? 1).toString(),
    });
  }, [addBackendOrder, symbol, getQuantityForSymbol, warning, t, backendWalletId]);

  const handleShortEntry = useCallback((price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    addBackendOrder({
      walletId: backendWalletId,
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      price: price.toString(),
      quantity: (getQuantityForSymbol(symbol) ?? 1).toString(),
    });
  }, [addBackendOrder, symbol, getQuantityForSymbol, warning, t, backendWalletId]);

  const { shiftPressed, altPressed } = useTradingShortcuts({
    onLongEntry: handleLongEntry,
    onShortEntry: handleShortEntry,
    enabled: hasTradingEnabled && !isAutoTradingActive,
  });

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
  });

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({
    klines,
    movingAverages,
  });

  const { tooltipData, measurementArea, isMeasuring, orderToClose, stochasticData } = chartState;
  const {
    setTooltip: setTooltipData,
    setMeasurementArea,
    setIsMeasuring,
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
    measurementArea: measurementAreaRef,
    measurementRaf: measurementRafRef,
  } = chartRefs;

  const cursorManager = useCursorManager(canvasRef);
  const { calculateStochastic } = useStochasticWorker();

  const activeIndicators = useIndicatorStore(useShallow((s) => s.activeIndicators));

  const indicatorData = useChartIndicators({
    klines,
    activeIndicators: activeIndicators as IndicatorId[],
    showRSI,
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

  const handleConfirmCloseOrder = useCallback(async (): Promise<void> => {
    if (!orderToClose || !manager) return;

    if (orderToClose.startsWith('sltp-')) {
      const parts = orderToClose.split('-');
      const type = parts[1] as 'stopLoss' | 'takeProfit';
      const executionIds = parts[2]?.split(',') || [];

      if (executionIds.length > 0) {
        await cancelProtectionOrder(executionIds, type);
      }

      setOrderToClose(null);
      return;
    }

    const exec = filteredBackendExecutions.find((e) => e.id === orderToClose);
    if (exec) {
      const klines = manager.getKlines();
      const lastKline = klines[klines.length - 1];
      const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
      await closeExecution(exec.id, exitPrice);
    }

    setOrderToClose(null);
  }, [orderToClose, manager, filteredBackendExecutions, closeExecution, cancelProtectionOrder]);

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
    const activePosition = filteredBackendExecutions.find(
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
  }, [filteredBackendExecutions, detectedSetups, manager]);

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
    showStochastic,
    showRSI,
    showBollingerBands,
    showATR,
    showVWAP,
    showFibonacciProjection,
    showEventRow,
    marketEvents,
    fibonacciProjectionData,
  });

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, filteredBackendExecutions, detectedSetups.filter(s => s.visible), showProfitLossAreas);

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
    return filteredBackendExecutions
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
        type: exec.status === 'pending' ? 'LIMIT' as const : 'MARKET' as const,
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
        isAutoTrade: true,
        walletId: backendWalletId ?? '',
        setupType: exec.setupType ?? undefined,
        isPendingLimitOrder: exec.status === 'pending',
      } as Order));
  }, [filteredBackendExecutions, backendWalletId]);

  const handleUpdateOrder = useCallback((id: string, updates: Partial<Order>) => {
    if (!id) return;

    const updatePayload: { stopLoss?: number; takeProfit?: number } = {};

    if (updates.stopLoss !== undefined) {
      updatePayload.stopLoss = updates.stopLoss;
    }
    if (updates.takeProfit !== undefined) {
      updatePayload.takeProfit = updates.takeProfit;
    }

    if (Object.keys(updatePayload).length > 0) {
      updateExecutionSLTP(id, updatePayload).catch((error) => {
        console.error('Failed to update SL/TP:', error);
      });
    }
  }, [updateExecutionSLTP]);

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
    getOrderAtPosition: memoizedGetOrderAtPosition,
    markDirty: memoizedMarkDirty,
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
    showMeasurementRuler,
    showMeasurementArea,
    isPanning,
    isMeasuring,
    measurementArea,
    shiftPressed,
    altPressed,
    hasTradingEnabled,
    isAutoTradingActive,
    tooltipEnabledRef,
    mousePositionRef,
    orderPreviewRef,
    hoveredMAIndexRef,
    hoveredOrderIdRef,
    lastHoveredOrderRef,
    lastTooltipOrderRef,
    measurementAreaRef,
    measurementRafRef,
    setTooltipData,
    setIsMeasuring,
    setMeasurementArea,
    setOrderToClose,
    getHoveredMATag,
    getHoveredOrder,
    getEventAtPosition,
    getClickedOrderId,
    getSLTPAtPosition,
    orderDragHandler,
    cursorManager,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
  });

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
    showStochastic,
    showRSI,
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

    if (isAutoTradingActive) {
      orderPreviewRef.current = null;
      if (manager) manager.markDirty('overlays');
      return;
    }

    const mousePos = mousePositionRef.current;
    if (mousePos && manager && hasTradingEnabled) {
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
  }, [shiftPressed, altPressed, manager, hasTradingEnabled, isAutoTradingActive]);

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

      if (orderDragHandler.isDragging && orderDragHandler.draggedOrder && orderDragHandler.previewPrice && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const { dragType, previewPrice, draggedOrder } = orderDragHandler;
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
          label = `${isStopLoss ? 'SL' : 'TP'} ${previewPrice.toFixed(2)}`;
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

      renderCurrentPriceLine_Label();
      renderCrosshairPriceLine();

      const orderPreviewValue = orderPreviewRef.current;
      if (orderPreviewValue && manager && !isAutoTradingActive) {
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

      const currentMeasurement = measurementAreaRef.current || measurementArea;
      if (currentMeasurement && isMeasuring) {
        const ctx = manager.getContext();
        if (!ctx) return;

        const { startX, startY, endX, endY } = currentMeasurement;

        const startPrice = manager.yToPrice(startY);
        const endPrice = manager.yToPrice(endY);
        const priceChange = endPrice - startPrice;
        const isPositive = priceChange >= 0;

        ctx.save();

        if (showMeasurementArea) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
          ctx.fillRect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
          );

          ctx.strokeStyle = colors.crosshair;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
          );
        }

        if (showMeasurementRuler) {
          ctx.strokeStyle = isPositive ? colors.bullish : colors.bearish;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

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
    chartType,
    measurementArea,
    isMeasuring,
    showMeasurementArea,
    showMeasurementRuler,
    colors,
    filteredBackendExecutions,
    orderDragHandler,
    isAutoTradingActive,
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

                  const exec = filteredBackendExecutions.find((e) => e.id === orderToClose);
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
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
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
        <KlineTimer
          timeframe={timeframe}
          lastKlineTime={klines[klines.length - 1]?.openTime}
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
