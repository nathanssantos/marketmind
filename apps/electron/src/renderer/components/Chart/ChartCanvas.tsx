import { Box } from '@chakra-ui/react';
import type { Kline, MarketType, TimeInterval, Viewport } from '@marketmind/types';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useEventRefreshScheduler } from '@renderer/hooks/useEventRefreshScheduler';
import { useLiquidityHeatmap } from '@renderer/hooks/useLiquidityHeatmap';
import { useChartPref, useTradingPref } from '@renderer/store/preferencesStore';
import { useMarketEvents } from '@renderer/hooks/useMarketEvents';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorStore, useSetupStore } from '@renderer/store';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { makeChartKey, useChartHoverStore } from '@renderer/store/chartHoverStore';
import { buildChartLiveDataKey, useChartLiveDataStore, type ChartLiveIndicatorEntry } from '@renderer/store/chartLiveDataStore';
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
  const [showGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair] = useChartPref('showCrosshair', true);
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', false);
  const [showTooltip] = useChartPref('showTooltip', false);
  const [showEventRow] = useChartPref('showEventRow', false);
  const [showActivityIndicator] = useChartPref<boolean>('showActivityIndicator', true);
  const [liquidityColorMode] = useChartPref<'colored' | 'intensity'>('liquidityColorMode', 'colored');
  const [chartFlipped] = useChartPref<boolean>('chartFlipped', false);

  const instances = useIndicatorStore(useShallow((s) => s.instances));
  const hasVisibleType = useCallback(
    (type: string): boolean => instances.some((i) => i.visible && i.catalogType === type),
    [instances],
  );
  const showVolume = hasVisibleType('volume');
  const showOrb = hasVisibleType('orb');
  const heatmapEnabled = hasVisibleType('liquidityHeatmap') || hasVisibleType('liquidationMarkers');
  const colors = useChartColors();

  const { dataRef: heatmapDataRef } = useLiquidityHeatmap(symbol ?? null, heatmapEnabled);

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

  const managerRef = useRef<import('@renderer/utils/canvas/CanvasManager').CanvasManager | null>(null);

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
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
    onNearLeftEdge,
  });

  managerRef.current = manager;

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({ klines: effectiveKlines });
  const { tooltipData, orderToClose } = chartState;

  const setHoveredKlineGlobal = useChartHoverStore((s) => s.setHoveredKline);
  useEffect(() => {
    const chartKey = makeChartKey(symbol, timeframe);
    const kline = tooltipData.visible ? tooltipData.kline : null;
    setHoveredKlineGlobal(chartKey, kline);
  }, [tooltipData.visible, tooltipData.kline, symbol, timeframe, setHoveredKlineGlobal]);

  useEffect(() => {
    const chartKey = makeChartKey(symbol, timeframe);
    return () => setHoveredKlineGlobal(chartKey, null);
  }, [symbol, timeframe, setHoveredKlineGlobal]);
  const { setTooltip: setTooltipData, setOrderToClose } = chartActions;
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
    latestKlinesPriceRef, setOrderToClose,
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
    hoveredKlineIndex: tooltipData.klineIndex, highlightedCandlesRef, mousePositionRef,
    timeframe, symbol, marketType,
  });

  const { outputs: genericOutputs } = useGenericChartIndicators(klines, instances, {
    marketEvents,
    footprintBars,
    liquidityHeatmap: heatmapDataRef.current,
  });

  const setLiveDataEntry = useChartLiveDataStore((s) => s.setEntry);
  const clearLiveDataEntry = useChartLiveDataStore((s) => s.clearEntry);
  const liveKlinesRef = useRef(klines);
  liveKlinesRef.current = klines;
  useEffect(() => {
    if (!symbol || !marketType || !timeframe) return;
    const key = buildChartLiveDataKey(symbol, timeframe, marketType);
    const indicators = new Map<string, ChartLiveIndicatorEntry>();
    for (const inst of instances) {
      if (!inst.visible) continue;
      const outputs = genericOutputs.get(inst.id);
      if (!outputs) continue;
      indicators.set(inst.userIndicatorId, { catalogType: inst.catalogType, outputs });
    }
    setLiveDataEntry(key, { symbol, interval: timeframe, marketType, klines: liveKlinesRef.current, indicators });
    return () => clearLiveDataEntry(key);
  }, [symbol, marketType, timeframe, instances, genericOutputs, setLiveDataEntry, clearLiveDataEntry]);

  const genericRenderers = useGenericChartIndicatorRenderers({
    manager, colors, instances, outputs: genericOutputs,
    external: {
      marketEvents,
      footprintBars,
      liquidityHeatmap: heatmapDataRef.current,
      liquidityColorMode,
      timeframe,
      ...(tooltipData.klineIndex !== undefined && { hoveredKlineIndex: tooltipData.klineIndex }),
      ...(advancedConfig?.volumeHeightRatio !== undefined && { volumeHeightRatio: advancedConfig.volumeHeightRatio }),
    },
  });

  const { render: renderEventScale, getEventAtPosition } = useEventScaleRenderer({
    manager,
    events: marketEvents,
    colors,
    enabled: showEventRow,
  });

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
    manager, canvasRef, klines, advancedConfig,
    showVolume, showEventRow, isPanning, shiftPressed, altPressed,
    tooltipEnabledRef, mousePositionRef, orderPreviewRef, hoveredMAIndexRef,
    hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef,
    setTooltipData, setOrderToClose: handleOrderCloseRequest,
    getHoveredOrder, getEventAtPosition, getClickedOrderId, getSLTPAtPosition,
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

  useChartPanelHeights({ manager, showEventRow, instances, advancedConfig });

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
