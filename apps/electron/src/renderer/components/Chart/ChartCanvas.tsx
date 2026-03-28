import { Box } from '@chakra-ui/react';
import type { Kline, MarketType, TimeInterval, Viewport } from '@marketmind/types';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useEventRefreshScheduler } from '@renderer/hooks/useEventRefreshScheduler';
import { useChartPref, useTradingPref } from '@renderer/store/preferencesStore';
import { useMarketEvents } from '@renderer/hooks/useMarketEvents';
import { useStochasticWorker } from '@renderer/hooks/useStochasticWorker';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorStore, useSetupStore } from '@renderer/store';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose } from '@shared/utils';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ChartNavigation } from './ChartNavigation';
import { ChartTooltip } from './ChartTooltip';
import { useChartCanvas } from './useChartCanvas';
import { useOrderLinesRenderer } from './useOrderLinesRenderer';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { ChartContextMenuManager } from './ChartContextMenuManager';
import { DrawingToolbar } from './drawings/DrawingToolbar';
import { TextEditOverlay } from './drawings/TextEditOverlay';
import type { MovingAverageConfig } from './useMovingAverageRenderer';
import {
  useChartState,
  useCursorManager,
  useChartIndicators,
  useChartPanelHeights,
  useChartBaseRenderers,
  useChartIndicatorRenderers,
  useChartInteraction,
  useChartTradingData,
  useChartTradingActions,
  useChartKeyboardShortcuts,
  useChartOverlayEffects,
  useChartRenderPipeline,
  useChartAlternativeKlines,
  useChartAuxiliarySetup,
  useChartPlacementHandlers,
  ChartCloseDialog,
  type IndicatorId,
} from './ChartCanvas/index';

const TOOLTIP_DEBOUNCE_MS = 150;

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
  activeIndicatorsOverride?: string[];
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
  activeIndicatorsOverride,
}: ChartCanvasProps): ReactElement => {
  const [showGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair] = useChartPref('showCrosshair', true);
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', false);
  const [showTooltip] = useChartPref('showTooltip', false);
  const [showEventRow] = useChartPref('showEventRow', false);
  const [showOrb] = useChartPref('showOrb', false);

  const storeIsActive = useIndicatorStore((s) => s.isActive);
  const storeShowVolume = useIndicatorStore((s) => s.activeIndicators.includes('volume'));
  const storeShowActivity = useIndicatorStore((s) => s.activeIndicators.includes('activityIndicator'));

  const isIndicatorActive = activeIndicatorsOverride
    ? (id: IndicatorId) => activeIndicatorsOverride.includes(id)
    : storeIsActive;
  const showVolume = activeIndicatorsOverride
    ? activeIndicatorsOverride.includes('volume')
    : storeShowVolume;
  const showActivityIndicator = activeIndicatorsOverride
    ? activeIndicatorsOverride.includes('activityIndicator')
    : storeShowActivity;
  const colors = useChartColors();

  const [dragSlEnabled] = useTradingPref<boolean>('dragSlEnabled', true);
  const [dragTpEnabled] = useTradingPref<boolean>('dragTpEnabled', true);
  const [slTightenOnly] = useTradingPref<boolean>('slTightenOnly', false);

  const detectedSetups = useSetupStore((state) => state.detectedSetups);
  const drawingKey = compositeKey(symbol ?? '', timeframe);
  const drawingsForContextMenu = useDrawingStore(s => s.drawingsByKey[drawingKey]);

  const highlightedCandlesRef = useRef(useStrategyVisualizationStore.getState().highlightedCandles);
  useEffect(() => {
    const unsubscribe = useStrategyVisualizationStore.subscribe((state) => {
      highlightedCandlesRef.current = state.highlightedCandles;
    });
    return () => unsubscribe();
  }, []);

  const tradingData = useChartTradingData({ symbol, marketType, chartType });
  const {
    activeWallet,
    backendWalletId,
    hasTradingEnabled,
    backendExecutions,
    allExecutions,
    trailingStopLineConfig,
    watcherStatus,
    setOptimisticExecutions,
    orderLoadingMapRef,
    orderFlashMapRef,
    closingSnapshotsRef,
    setClosingVersion,
    applyOptimistic,
    clearOptimistic,
    symbolFiltersData,
    exchangeOpenOrders,
    exchangeAlgoOrders,
    needsScalpingMetrics,
    resolvedTicksPerBar,
    resolvedVolumePerBar,
    volumeProfileData,
  } = tradingData;

  const managerRef = useRef<import('@renderer/utils/canvas/CanvasManager').CanvasManager | null>(null);

  const { effectiveKlines, footprintBars, cvdValuesRef, imbalanceValuesRef } = useChartAlternativeKlines({
    klines,
    chartType,
    symbol,
    needsScalpingMetrics,
    resolvedTicksPerBar,
    resolvedVolumePerBar,
    managerRef,
  });

  const { canvasRef, manager, isPanning, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } = useChartCanvas({
    klines: effectiveKlines,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
    onNearLeftEdge,
  });

  managerRef.current = manager;

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({ klines: effectiveKlines, movingAverages });
  const { tooltipData, orderToClose, stochasticData } = chartState;
  const { setTooltip: setTooltipData, setOrderToClose, setStochasticData } = chartActions;
  const { mousePosition: mousePositionRef, orderPreview: orderPreviewRef, hoveredMAIndex: hoveredMAIndexRef, hoveredOrderId: hoveredOrderIdRef, lastHoveredOrder: lastHoveredOrderRef, lastTooltipOrder: lastTooltipOrderRef, tooltipEnabled: tooltipEnabledRef, tooltipDebounce: tooltipDebounceRef } = chartRefs;

  const setGridModeActive = useGridOrderStore((s) => s.setGridModeActive);

  const realtimePrice = usePriceStore((s) => symbol ? s.getPrice(symbol) : null);
  const klinePrice = klines.length > 0 ? getKlineClose(klines[klines.length - 1]!) : 0;
  const latestKlinesPriceRef = useRef(realtimePrice ?? klinePrice);
  latestKlinesPriceRef.current = realtimePrice ?? klinePrice;

  const tradingActions = useChartTradingActions({
    symbol, marketType, manager, backendWalletId,
    backendExecutions: backendExecutions as any, allExecutions,
    setOptimisticExecutions, orderLoadingMapRef, orderFlashMapRef,
    closingSnapshotsRef, setClosingVersion, applyOptimistic, clearOptimistic,
    activeWalletBalance: activeWallet?.currentBalance ?? undefined, latestKlinesPriceRef, setOrderToClose,
  });

  const { handleLongEntry, handleShortEntry, handleOrderCloseRequest, handleConfirmCloseOrder, handleUpdateOrder, handleGridConfirm, draggableOrders, updateTsConfig, warning: tradingWarning } = tradingActions;

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
      if (drawingState.activeTool) drawingState.setActiveTool(null);
      if (drawingState.selectedDrawingId) {
        drawingState.selectDrawing(null);
        manager?.markDirty('overlays');
      }
    },
    enabled: true,
  });

  const cursorManager = useCursorManager(canvasRef);
  const showStochasticEarly = isIndicatorActive('stochastic');
  const stochasticResult = useStochasticWorker(klines, showStochasticEarly, 14, 3, 3);
  const storeActiveIndicators = useIndicatorStore(useShallow((s) => s.activeIndicators));
  const storeIndicatorParams = useIndicatorStore((s) => s.indicatorParams);
  const activeIndicators = (activeIndicatorsOverride ?? storeActiveIndicators) as IndicatorId[];

  const indicatorData = useChartIndicators({ klines, activeIndicators, indicatorParams: storeIndicatorParams });

  const { events: marketEvents, refetch: refetchMarketEvents } = useMarketEvents({ klines, enabled: showEventRow || showOrb });

  useEventRefreshScheduler({
    activeWatchers: watcherStatus?.activeWatchers ?? [],
    chartInterval: timeframe as TimeInterval,
    enabled: showEventRow || showOrb,
    onRefresh: refetchMarketEvents,
  });

  useEffect(() => {
    if (isPanning) {
      tooltipEnabledRef.current = false;
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    } else {
      tooltipDebounceRef.current = setTimeout(() => { tooltipEnabledRef.current = true; }, TOOLTIP_DEBOUNCE_MS);
    }
    return () => { if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current); };
  }, [isPanning]);

  const { renderGrid, renderKlines, renderLineChart, renderVolume, renderMovingAverages, renderCurrentPriceLine_Line, renderCurrentPriceLine_Label, renderCrosshairPriceLine, renderWatermark, getHoveredMATag, maValuesCache } = useChartBaseRenderers({
    manager, klines: effectiveKlines, colors, chartType, advancedConfig, movingAverages,
    showGrid, showVolume, showCurrentPriceLine, showCrosshair, showActivityIndicator,
    hoveredKlineIndex: tooltipData.klineIndex, highlightedCandlesRef, hoveredMAIndexRef, mousePositionRef,
    timeframe, symbol, marketType,
  });

  const indicatorRenderers = useChartIndicatorRenderers({
    manager, colors, chartType, indicatorData, indicatorParams: storeIndicatorParams, stochasticData,
    showEventRow, showOrb, marketEvents, cvdValuesRef, imbalanceValuesRef,
    volumeProfile: volumeProfileData ?? null, footprintBars,
  });

  const { getEventAtPosition } = indicatorRenderers;

  const draggedOrderIdRef = useRef<string | null>(null);

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, allExecutions, detectedSetups.filter(s => s.visible), showProfitLossAreas, orderLoadingMapRef, orderFlashMapRef, trailingStopLineConfig, draggedOrderIdRef);

  const auxiliarySetup = useChartAuxiliarySetup({
    manager, klines, symbol: symbol ?? '', timeframe, colors, hasTradingEnabled,
    allExecutions, draggableOrders, handleUpdateOrder, handleGridConfirm,
    dragSlEnabled, dragTpEnabled, slTightenOnly, symbolFiltersData,
    getOrderAtPosition, draggedOrderIdRef,
  });

  const { orderDragHandler, slTpPlacement, tsPlacementActive, tsPlacementPreviewPrice, tsPlacementDeactivate, tsPlacementSetPreview, isGridModeActive, gridInteraction, renderGridPreview, drawingInteraction, renderDrawings } = auxiliarySetup;

  const currentKlines = manager?.getKlines() ?? [];
  const lastKline = currentKlines[currentKlines.length - 1];
  const currentPrice = lastKline ? getKlineClose(lastKline) : 0;

  const updatePrice = usePriceStore((s) => s.updatePrice);
  useEffect(() => {
    if (symbol && currentPrice > 0 && !isPanning) updatePrice(symbol, currentPrice, 'chart');
  }, [symbol, currentPrice, updatePrice, isPanning]);

  const { handleCanvasMouseMove, handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasMouseLeave, handleWheel } = useChartInteraction({
    manager, canvasRef, klines, movingAverages, maValuesCache, advancedConfig,
    showVolume, showEventRow, isPanning, shiftPressed, altPressed,
    tooltipEnabledRef, mousePositionRef, orderPreviewRef, hoveredMAIndexRef,
    hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef,
    setTooltipData, setOrderToClose: handleOrderCloseRequest,
    getHoveredMATag, getHoveredOrder, getEventAtPosition, getClickedOrderId, getSLTPAtPosition,
    onLongEntry: handleLongEntry, onShortEntry: handleShortEntry,
    orderDragHandler, gridInteraction: isGridModeActive ? gridInteraction : undefined,
    drawingInteraction, cursorManager,
    handleMouseMove, handleMouseDown, handleMouseUp, handleMouseLeave,
  });

  const { handleCanvasMouseMoveWrapped, handleCanvasMouseDownWrapped } = useChartPlacementHandlers({
    manager, canvasRef, allExecutions, backendWalletId, symbol,
    slTpPlacement, tsPlacementActive, tsPlacementDeactivate, tsPlacementSetPreview,
    cursorManager, getSlTpButtonAtPosition, applyOptimistic, orderLoadingMapRef,
    handleUpdateOrder, updateTsConfig, warning: tradingWarning,
    handleCanvasMouseMove, handleCanvasMouseDown,
  });

  useChartKeyboardShortcuts({ manager, symbol, timeframe, slTpPlacement, tsPlacementActive, tsPlacementDeactivate, orderDragHandler, allExecutions });

  useChartOverlayEffects({ manager, allExecutions, orderLoadingMapRef, orderFlashMapRef, backendExecutions, exchangeOpenOrders, exchangeAlgoOrders });

  useEffect(() => {
    setStochasticData(stochasticResult);
  }, [stochasticResult, setStochasticData]);

  useChartPanelHeights({ manager, showEventRow, activeIndicators: activeIndicators as IndicatorId[], advancedConfig });

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
        orderPreviewRef.current = { price: manager.yToPrice(mousePos.y), type: shiftPressed ? 'long' : 'short' };
        manager.markDirty('overlays');
      }
    }
  }, [shiftPressed, altPressed, manager]);

  useChartRenderPipeline({
    manager, chartType, colors, allExecutions,
    baseRenderers: { renderGrid, renderKlines, renderLineChart, renderVolume, renderMovingAverages, renderCurrentPriceLine_Line, renderCurrentPriceLine_Label, renderCrosshairPriceLine, renderWatermark, getHoveredMATag, maValuesCache },
    indicatorRenderers, renderOrderLines, renderGridPreview, renderDrawings,
    orderDragHandler, slTpPlacement, tsPlacementActive, tsPlacementPreviewPrice, orderPreviewRef,
  });

  const handleResetView = useCallback((): void => { if (manager) manager.resetToInitialView(); }, [manager]);
  const handleNextKline = useCallback((): void => { if (manager) manager.panToNextKline(); }, [manager]);

  return (
    <>
      <ChartCloseDialog
        orderToClose={orderToClose}
        onOpenChange={(open) => !open && setOrderToClose(null)}
        onConfirmClose={() => handleConfirmCloseOrder(orderToClose)}
        allExecutions={allExecutions}
        manager={manager}
      />
      <ChartContextMenuManager
        hasDrawings={(drawingsForContextMenu?.length ?? 0) > 0}
        onClearAllDrawings={() => {
          if (symbol) useDrawingStore.getState().setDrawingsForSymbol(symbol, timeframe, []);
          manager?.markDirty('overlays');
        }}
      >
      <Box position="relative" width={width} height={height} overflow="hidden" bg={colors.background} userSelect="none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDownWrapped}
          onMouseMove={handleCanvasMouseMoveWrapped}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onWheel={handleWheel}
          style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
        />
        <DrawingToolbar manager={manager} symbol={symbol ?? ''} interval={timeframe} />
        <TextEditOverlay manager={manager} symbol={symbol ?? ''} interval={timeframe} />
        <ChartNavigation onResetView={handleResetView} onNextKline={handleNextKline} totalPanelHeight={manager?.getTotalPanelHeight() ?? 0} />
        {showTooltip && (
          <ChartTooltip
            kline={tooltipData.kline} x={tooltipData.x} y={tooltipData.y} visible={tooltipData.visible}
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
      </ChartContextMenuManager>
    </>
  );
};
