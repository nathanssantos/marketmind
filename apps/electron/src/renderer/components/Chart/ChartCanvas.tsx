import { Box } from '@chakra-ui/react';
import type { Kline, MarketType, TimeInterval, TradingSetup, Viewport } from '@marketmind/types';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useEventRefreshScheduler } from '@renderer/hooks/useEventRefreshScheduler';
import { useLiquidityHeatmap } from '@renderer/hooks/useLiquidityHeatmap';
import { useChartPref, useTradingPref } from '@renderer/store/preferencesStore';
import { useMarketEvents } from '@renderer/hooks/useMarketEvents';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorVisibility } from '@renderer/hooks/useIndicatorVisibility';
import { useSetupStore } from '@renderer/store';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { subscribeToPrice, usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { makeChartKey, useChartHoverStore } from '@renderer/store/chartHoverStore';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose } from '@shared/utils';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AdvancedControlsConfig } from './AdvancedControls';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { ChartNavigation } from './ChartNavigation';
import { ChartPerfOverlay } from './ChartPerfOverlay';
import { ChartTooltipOverlay } from './ChartCanvas/ChartTooltipOverlay';
import { exposeCanvasManagerForE2E, exposeIsPanningForE2E } from '@renderer/utils/e2eBridge';
import { tooltipStore } from './ChartCanvas/tooltipStore';
import { useChartCanvas } from './useChartCanvas';
import { useOrderLinesRenderer } from './useOrderLinesRenderer';
import type { BackendExecution } from './useOrderLinesRenderer';
import { useEventScaleRenderer } from './useEventScaleRenderer';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { ChartContextMenuManager } from './ChartContextMenuManager';
import { DrawingToolbar } from './drawings/DrawingToolbar';
import { TextEditOverlay } from './drawings/TextEditOverlay';
import {
  useChartState,
  useCursorManager,
  useChartPanelHeights,
  useChartBaseRenderers,
  useGenericChartIndicators,
  useGenericChartIndicatorRenderers,
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
  chartType = 'kline',
  advancedConfig,
  timeframe = '1h',
  onNearLeftEdge,
  isLoadingMore: _isLoadingMore,
}: ChartCanvasProps): ReactElement => {
  perfMonitor.recordComponentRender('ChartCanvas', `${symbol ?? '?'}@${timeframe}`);

  const [showGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair] = useChartPref('showCrosshair', true);
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', false);
  const [showTooltip] = useChartPref('showTooltip', false);
  const [showEventRow] = useChartPref('showEventRow', false);
  const [showActivityIndicator] = useChartPref<boolean>('showActivityIndicator', true);
  const [liquidityColorMode] = useChartPref<'colored' | 'intensity'>('liquidityColorMode', 'colored');
  const [chartFlipped] = useChartPref<boolean>('chartFlipped', false);

  const { showVolume, showOrb, heatmapEnabled } = useIndicatorVisibility();
  const colors = useChartColors();

  const { dataRef: heatmapDataRef } = useLiquidityHeatmap(symbol ?? null, heatmapEnabled);

  const [dragSlEnabled] = useTradingPref<boolean>('dragSlEnabled', true);
  const [dragTpEnabled] = useTradingPref<boolean>('dragTpEnabled', true);
  const [slTightenOnly] = useTradingPref<boolean>('slTightenOnly', false);

  const detectedSetupsVisibleRef = useRef<TradingSetup[]>(
    useSetupStore.getState().detectedSetups.filter((s) => s.visible),
  );

  const drawingKey = compositeKey(symbol ?? '', timeframe);
  const hasDrawings = useDrawingStore((s) => (s.drawingsByKey[drawingKey]?.length ?? 0) > 0);

  const highlightedCandlesRef = useRef(useStrategyVisualizationStore.getState().highlightedCandles);
  useEffect(() => {
    const unsubscribe = useStrategyVisualizationStore.subscribe(
      (state) => state.highlightedCandles,
      (highlightedCandles) => {
        perfMonitor.recordStoreWake('strategyVisualizationStore', 'highlightedCandles');
        highlightedCandlesRef.current = highlightedCandles;
      },
    );
    return () => unsubscribe();
  }, []);

  const tradingData = useChartTradingData({ symbol, marketType, chartType });
  const {
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
  } = tradingData;

  const managerRef = useRef<CanvasManager | null>(null);

  useEffect(() => {
    const unsubscribe = useSetupStore.subscribe(
      (state) => state.detectedSetups,
      (detectedSetups) => {
        perfMonitor.recordStoreWake('setupStore', 'detectedSetups');
        detectedSetupsVisibleRef.current = detectedSetups.filter((s) => s.visible);
        managerRef.current?.markDirty('overlays');
      },
    );
    return () => unsubscribe();
  }, []);

  const { effectiveKlines, footprintBars } = useChartAlternativeKlines({
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
    ...(symbol !== undefined && { symbol }),
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
    onNearLeftEdge,
  });

  managerRef.current = manager;

  useEffect(() => {
    exposeCanvasManagerForE2E(manager);
    return () => exposeCanvasManagerForE2E(null);
  }, [manager]);

  useEffect(() => {
    exposeIsPanningForE2E(isPanning);
  }, [isPanning]);

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({ klines: effectiveKlines });
  const { orderToClose } = chartState;

  const hoveredKlineIndexRef = useRef<number | undefined>(tooltipStore.getSnapshot().klineIndex);
  useEffect(() => {
    const unsubscribe = tooltipStore.subscribeHoveredKlineIndex((index) => {
      perfMonitor.recordStoreWake('tooltipStore', 'klineIndex');
      if (hoveredKlineIndexRef.current === index) return;
      hoveredKlineIndexRef.current = index;
      managerRef.current?.markDirty('overlays');
    });
    return unsubscribe;
  }, []);

  const setHoveredKlineGlobal = useChartHoverStore((s) => s.setHoveredKline);
  useEffect(() => {
    const chartKey = makeChartKey(symbol, timeframe);
    let lastVisible = false;
    let lastKline = tooltipStore.getSnapshot().kline;
    const unsubscribe = tooltipStore.subscribe(() => {
      perfMonitor.recordStoreWake('tooltipStore', 'full');
      const snap = tooltipStore.getSnapshot();
      if (snap.visible === lastVisible && snap.kline === lastKline) return;
      lastVisible = snap.visible;
      lastKline = snap.kline;
      setHoveredKlineGlobal(chartKey, snap.visible ? snap.kline : null);
    });
    return () => {
      unsubscribe();
      setHoveredKlineGlobal(chartKey, null);
    };
  }, [symbol, timeframe, setHoveredKlineGlobal]);
  const { setTooltip: setTooltipData, setOrderToClose } = chartActions;
  const { mousePosition: mousePositionRef, orderPreview: orderPreviewRef, hoveredMAIndex: hoveredMAIndexRef, hoveredOrderId: hoveredOrderIdRef, lastHoveredOrder: lastHoveredOrderRef, lastTooltipOrder: lastTooltipOrderRef, tooltipEnabled: tooltipEnabledRef, tooltipDebounce: tooltipDebounceRef } = chartRefs;

  const setGridModeActive = useGridOrderStore((s) => s.setGridModeActive);

  const klinePrice = klines.length > 0 ? getKlineClose(klines[klines.length - 1]!) : 0;
  const klinePriceRef = useRef(klinePrice);
  klinePriceRef.current = klinePrice;
  const latestKlinesPriceRef = useRef<number>(
    (symbol ? usePriceStore.getState().getPrice(symbol) : null) ?? klinePrice,
  );
  const symbolPriceRef = useRef<number | null>(symbol ? usePriceStore.getState().getPrice(symbol) : null);

  useEffect(() => {
    const apply = (next: number): void => {
      if (next === latestKlinesPriceRef.current) return;
      latestKlinesPriceRef.current = next;
      managerRef.current?.markDirty('overlays');
    };
    if (!symbol) {
      symbolPriceRef.current = null;
      apply(klinePriceRef.current);
      return;
    }
    symbolPriceRef.current = usePriceStore.getState().getPrice(symbol);
    apply(symbolPriceRef.current ?? klinePriceRef.current);
    return subscribeToPrice(symbol, (price) => {
      perfMonitor.recordStoreWake('priceStore', symbol);
      if (price === symbolPriceRef.current) return;
      symbolPriceRef.current = price;
      apply(price);
    });
  }, [symbol]);

  useEffect(() => {
    if (symbolPriceRef.current !== null) return;
    latestKlinesPriceRef.current = klinePrice;
  }, [klinePrice]);

  const tradingActions = useChartTradingActions({
    symbol, marketType, manager, backendWalletId,
    backendExecutions: backendExecutions as unknown as BackendExecution[] | undefined, allExecutions,
    setOptimisticExecutions, orderLoadingMapRef, orderFlashMapRef,
    closingSnapshotsRef, setClosingVersion, applyOptimistic, clearOptimistic,
    latestKlinesPriceRef, setOrderToClose,
  });

  const { handleLongEntry, handleShortEntry, handleOrderCloseRequest, handleConfirmCloseOrder, handleUpdateOrder, handleGridConfirm, draggableOrders, updateTsConfig, warning: tradingWarning } = tradingActions;

  const { shiftPressed, altPressed } = useTradingShortcuts({
    onLongEntry: (price: number) => { void handleLongEntry(price); },
    onShortEntry: (price: number) => { void handleShortEntry(price); },
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

  const { renderGrid, renderKlines, renderLineChart, renderCurrentPriceLine_Line, renderCurrentPriceLine_Label, renderCrosshairPriceLine, renderWatermark } = useChartBaseRenderers({
    manager, colors, chartType, advancedConfig,
    showGrid, showCurrentPriceLine, showCrosshair, showActivityIndicator,
    hoveredKlineIndexRef, highlightedCandlesRef, mousePositionRef,
    timeframe, symbol, marketType,
  });

  const liveDataTarget = useMemo(
    () => (symbol && marketType && timeframe ? { symbol, marketType, timeframe } : null),
    [symbol, marketType, timeframe],
  );

  const { outputsRef: genericOutputsRef } = useGenericChartIndicators(
    klines,
    {
      marketEvents,
      footprintBars,
      liquidityHeatmap: heatmapDataRef.current,
    },
    managerRef,
    liveDataTarget,
  );

  const volumeHeightRatio = advancedConfig?.volumeHeightRatio;
  const external = useMemo(() => ({
    marketEvents,
    footprintBars,
    liquidityHeatmapRef: heatmapDataRef,
    liquidityColorMode,
    timeframe,
    hoveredKlineIndexRef,
    ...(volumeHeightRatio !== undefined && { volumeHeightRatio }),
  }), [marketEvents, footprintBars, heatmapDataRef, liquidityColorMode, timeframe, hoveredKlineIndexRef, volumeHeightRatio]);

  const genericRenderers = useGenericChartIndicatorRenderers({
    manager, colors, outputsRef: genericOutputsRef,
    external,
  });

  const { render: renderEventScale, getEventAtPosition } = useEventScaleRenderer({
    manager,
    events: marketEvents,
    colors,
    enabled: showEventRow,
  });

  const draggedOrderIdRef = useRef<string | null>(null);

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, allExecutions, detectedSetupsVisibleRef, showProfitLossAreas, orderLoadingMapRef, orderFlashMapRef, trailingStopLineConfig, draggedOrderIdRef);

  const auxiliarySetup = useChartAuxiliarySetup({
    manager, klines, symbol: symbol ?? '', timeframe, colors, hasTradingEnabled,
    allExecutions, draggableOrders, handleUpdateOrder, handleGridConfirm,
    dragSlEnabled, dragTpEnabled, slTightenOnly, symbolFiltersData,
    getOrderAtPosition, draggedOrderIdRef,
  });

  const { orderDragHandler, slTpPlacement, tsPlacementActive, tsPlacementPreviewPrice, tsPlacementDeactivate, tsPlacementSetPreview, isGridModeActive, gridInteraction, renderGridPreview, drawingInteraction, renderDrawings } = auxiliarySetup;

  const { handleCanvasMouseMove, handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasMouseLeave, handleWheel } = useChartInteraction({
    manager, canvasRef, klines, advancedConfig,
    showVolume, showEventRow, isPanning, shiftPressed, altPressed,
    tooltipEnabledRef, mousePositionRef, orderPreviewRef, hoveredMAIndexRef,
    hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef,
    setTooltipData, setOrderToClose: handleOrderCloseRequest,
    getHoveredOrder, getEventAtPosition, getClickedOrderId, getSLTPAtPosition,
    onLongEntry: (price: number) => { void handleLongEntry(price); },
    onShortEntry: (price: number) => { void handleShortEntry(price); },
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

  useChartPanelHeights({ manager, showEventRow, advancedConfig });

  useEffect(() => {
    if (!manager || !advancedConfig) return;
    manager.setChartPadding(advancedConfig.paddingTop, advancedConfig.paddingBottom);
    manager.markDirty('all');
  }, [manager, advancedConfig?.paddingTop, advancedConfig?.paddingBottom]);

  useEffect(() => {
    if (!manager) return;
    manager.setFlipped(chartFlipped);
  }, [manager, chartFlipped]);

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
    baseRenderers: { renderGrid, renderKlines, renderLineChart, renderCurrentPriceLine_Line, renderCurrentPriceLine_Label, renderCrosshairPriceLine, renderWatermark },
    genericRenderers, renderOrderLines, renderGridPreview, renderDrawings, renderEventScale,
    orderDragHandler, slTpPlacement, tsPlacementActive, tsPlacementPreviewPrice, orderPreviewRef,
  });

  const handleResetView = useCallback((): void => { if (manager) manager.resetToInitialView(); }, [manager]);
  const handleNextKline = useCallback((): void => { if (manager) manager.panToNextKline(); }, [manager]);

  return (
    <>
      <ChartCloseDialog
        orderToClose={orderToClose}
        onOpenChange={(open) => !open && setOrderToClose(null)}
        onConfirmClose={() => { void handleConfirmCloseOrder(orderToClose); }}
        allExecutions={allExecutions}
        manager={manager}
      />
      <ChartContextMenuManager
        hasDrawings={hasDrawings}
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
        <ChartPerfOverlay />
        <ChartTooltipOverlay enabled={showTooltip} />
      </Box>
      </ChartContextMenuManager>
    </>
  );
};
