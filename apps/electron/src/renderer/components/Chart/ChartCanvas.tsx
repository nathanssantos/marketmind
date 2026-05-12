import { Box } from '@chakra-ui/react';
import type { PatternHit } from '@marketmind/trading-core';
import type { Kline, MarketType, TimeInterval, TradingSetup, Viewport } from '@marketmind/types';
import type { KlineSource } from '@renderer/hooks/useKlineLiveStream';
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdvancedControlsConfig } from './AdvancedControls';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { ChartNavigation } from './ChartNavigation';
import { ChartPerfOverlay } from './ChartPerfOverlay';
import { exposeCanvasManagerForE2E, exposeIsPanningForE2E } from '@renderer/utils/e2eBridge';
import { useChartCanvas } from './useChartCanvas';
import { useOrderLinesRenderer } from './useOrderLinesRenderer';
import type { BackendExecution } from './useOrderLinesRenderer';
import { useEventScaleRenderer } from './useEventScaleRenderer';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { useChartLayerFlags } from '@renderer/store/chartLayersStore';
import { usePatternMarkers } from '@renderer/hooks/usePatternMarkers';
import {
  renderCandlePatterns as drawCandlePatterns,
  findPatternHitAtPosition,
  type PatternHitDraw,
} from './ChartCanvas/renderers/renderCandlePatterns';
import { PatternInfoPopover } from './PatternInfoPopover';
import { PositionActionsPopover } from '@renderer/components/Trading/PositionActionsPopover';
import { PatternConfigDialog } from '@renderer/components/Patterns/PatternConfigDialog';
import { useUserPatterns, type UserPattern } from '@renderer/hooks/useUserPatterns';
import { ChartContextMenuManager } from './ChartContextMenuManager';
import { DrawingToolbar } from './drawings/DrawingToolbar';
import { TextEditOverlay } from './drawings/TextEditOverlay';
import { useDrawingHistoryShortcuts } from './drawings/useDrawingHistoryShortcuts';
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

export interface ChartCanvasProps {
  klines: Kline[];
  /**
   * Optional live-tick source — when provided, intra-candle OHLC updates flow
   * imperatively to the canvas via `klineSource.subscribe`, and `React.memo`'s
   * structural comparator skips re-rendering ChartCanvas on those updates.
   * Without it, ChartCanvas falls back to re-rendering on every klines prop change.
   */
  klineSource?: KlineSource;
  symbol?: string;
  marketType?: MarketType;
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  chartType?: 'kline' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  timeframe?: string;
  onNearLeftEdge?: () => void;
  isLoadingMore?: boolean;
  /**
   * Grid-panel ID this chart instance is rendered into. Used to scope
   * per-panel state (layer-visibility flags in `chartLayersStore`,
   * indicator instances in `indicatorStore`) so two chart panels in
   * the same layout — even on the same (symbol, interval) — keep
   * independent settings. Optional only because the same component
   * is also used outside the layout grid (e.g. a detached window).
   */
  panelId?: string;
}

const ChartCanvasInternal = ({
  klines,
  klineSource,
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
  panelId,
}: ChartCanvasProps): ReactElement => {
  perfMonitor.recordComponentRender('ChartCanvas', `${symbol ?? '?'}@${timeframe}`);

  const [showGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair] = useChartPref('showCrosshair', true);
  const [stackPriceTags] = useChartPref<boolean>('stackPriceTags', true);
  const [showProfitLossAreas] = useChartPref('showProfitLossAreas', false);
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

  useDrawingHistoryShortcuts({ symbol: symbol ?? '', interval: timeframe, enabled: !!symbol });

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

  const tradingData = useChartTradingData({ symbol, marketType });
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

  const { effectiveKlines } = useChartAlternativeKlines({
    klines,
    symbol,
    needsScalpingMetrics,
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
    if (!manager || !klineSource) return;
    return klineSource.subscribe(() => {
      const latest = klineSource.klinesRef.current;
      manager.setKlines(latest);
      manager.markDirty('klines');
    });
  }, [manager, klineSource]);

  useEffect(() => {
    exposeCanvasManagerForE2E(manager);
    return () => exposeCanvasManagerForE2E(null);
  }, [manager]);

  useEffect(() => {
    exposeIsPanningForE2E(isPanning);
  }, [isPanning]);

  const { state: chartState, actions: chartActions, refs: chartRefs } = useChartState({ klines: effectiveKlines });
  const { orderToClose } = chartState;

  const hoveredKlineIndexRef = useRef<number | undefined>(undefined);
  const chartKey = makeChartKey(symbol, timeframe);
  const setHoveredKlineGlobal = useChartHoverStore((s) => s.setHoveredKline);
  const setCurrentKlineGlobal = useChartHoverStore((s) => s.setCurrentKline);
  const clearChartHover = useChartHoverStore((s) => s.clearChart);

  const setHoveredKline = useCallback((kline: Kline | null, klineIndex?: number): void => {
    const nextIndex = kline ? klineIndex : undefined;
    if (hoveredKlineIndexRef.current !== nextIndex) {
      hoveredKlineIndexRef.current = nextIndex;
      managerRef.current?.markDirty('overlays');
    }
    setHoveredKlineGlobal(chartKey, kline);
  }, [chartKey, setHoveredKlineGlobal]);

  useEffect(() => {
    return () => clearChartHover(chartKey);
  }, [chartKey, clearChartHover]);

  useEffect(() => {
    const latest = effectiveKlines.length > 0 ? effectiveKlines[effectiveKlines.length - 1]! : null;
    setCurrentKlineGlobal(chartKey, latest);
  }, [effectiveKlines, chartKey, setCurrentKlineGlobal]);

  useEffect(() => {
    if (!klineSource) return;
    return klineSource.subscribe(() => {
      const arr = klineSource.klinesRef.current;
      const latest = arr.length > 0 ? arr[arr.length - 1]! : null;
      setCurrentKlineGlobal(chartKey, latest);
    });
  }, [klineSource, chartKey, setCurrentKlineGlobal]);

  const { setOrderToClose } = chartActions;
  const { mousePosition: mousePositionRef, orderPreview: orderPreviewRef, hoveredMAIndex: hoveredMAIndexRef, hoveredOrderId: hoveredOrderIdRef, lastHoveredOrder: lastHoveredOrderRef } = chartRefs;

  const setGridModeActive = useGridOrderStore((s) => s.setGridModeActive);

  // Bridge from the ESC handler (declared early in the render) to the
  // drawingInteraction returned later by useChartAuxiliarySetup. Without a
  // ref we'd have a forward-reference problem: useTradingShortcuts captures
  // its onEscape closure before auxiliarySetup runs.
  const drawingInteractionRef = useRef<{ cancelInteraction: (options?: { revert?: boolean }) => boolean; isDrawing: () => boolean } | null>(null);

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
      // If a drawing edit is in flight (drag or mid-placement), ESC should
      // cancel it and — for a drag — revert the drawing back to where it
      // was when the drag started. Same UX as ESC on an order drag. We do
      // this BEFORE deselecting so a single ESC press can both abort the
      // edit and snap the drawing back; a subsequent ESC will deselect.
      const drawingInteraction = drawingInteractionRef.current;
      if (drawingInteraction?.isDrawing()) {
        drawingInteraction.cancelInteraction({ revert: true });
        manager?.markDirty('overlays');
        return;
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
    if (isPanning) setHoveredKline(null);
  }, [isPanning, setHoveredKline]);

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
      liquidityHeatmap: heatmapDataRef.current,
    },
    managerRef,
    liveDataTarget,
    klineSource,
    panelId,
  );

  const volumeHeightRatio = advancedConfig?.volumeHeightRatio;
  const external = useMemo(() => ({
    marketEvents,
    liquidityHeatmapRef: heatmapDataRef,
    liquidityColorMode,
    timeframe,
    hoveredKlineIndexRef,
    ...(volumeHeightRatio !== undefined && { volumeHeightRatio }),
  }), [marketEvents, heatmapDataRef, liquidityColorMode, timeframe, hoveredKlineIndexRef, volumeHeightRatio]);

  const rawGenericRenderers = useGenericChartIndicatorRenderers({
    manager, colors, outputsRef: genericOutputsRef,
    external,
    panelId,
  });

  const { render: renderEventScale } = useEventScaleRenderer({
    manager,
    events: marketEvents,
    colors,
    enabled: showEventRow,
  });

  const draggedOrderIdRef = useRef<string | null>(null);

  const { renderOrderLines: rawRenderOrderLines, getClickedOrderId, getClickedPositionActions, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, allExecutions, detectedSetupsVisibleRef, showProfitLossAreas, orderLoadingMapRef, orderFlashMapRef, trailingStopLineConfig, draggedOrderIdRef, colors, true, stackPriceTags);

  const auxiliarySetup = useChartAuxiliarySetup({
    manager, klines, symbol: symbol ?? '', timeframe, colors, hasTradingEnabled,
    allExecutions, draggableOrders, handleUpdateOrder, handleGridConfirm,
    dragSlEnabled, dragTpEnabled, slTightenOnly, symbolFiltersData,
    getOrderAtPosition, draggedOrderIdRef,
  });

  const { orderDragHandler, slTpPlacement, tsPlacementActive, tsPlacementPreviewPrice, tsPlacementDeactivate, tsPlacementSetPreview, isGridModeActive, gridInteraction, renderGridPreview, drawingInteraction, renderDrawings: rawRenderDrawings } = auxiliarySetup;

  // v1.5 — Layers popover gates: when the user toggles a layer off,
  // skip its render call so the canvas re-paints without it. Flags
  // are session-only, per (symbol, interval).
  const layerFlags = useChartLayerFlags(panelId ?? '');
  const renderOrderLines = useCallback<typeof rawRenderOrderLines>(
    (...args) => {
      if (!layerFlags.orderLines) return false;
      return rawRenderOrderLines(...args);
    },
    [rawRenderOrderLines, layerFlags.orderLines],
  );
  const renderDrawings = useCallback<typeof rawRenderDrawings>(
    (...args) => {
      if (!layerFlags.drawings) return;
      return rawRenderDrawings(...args);
    },
    [rawRenderDrawings, layerFlags.drawings],
  );
  const genericRenderers = useMemo(() => {
    if (layerFlags.indicators) return rawGenericRenderers;
    const noop = () => undefined;
    return {
      renderAllOverlayIndicators: noop,
      renderAllPanelIndicators: noop,
      renderAllCustomIndicators: noop,
      renderInstance: noop,
    };
  }, [rawGenericRenderers, layerFlags.indicators]);

  // Keep the ESC-handler bridge ref pointed at the latest drawingInteraction.
  drawingInteractionRef.current = drawingInteraction;

  const { handleCanvasMouseMove, handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasMouseLeave, handleWheel } = useChartInteraction({
    manager, canvasRef, klines, advancedConfig,
    showVolume, isPanning, shiftPressed, altPressed,
    mousePositionRef, orderPreviewRef, hoveredMAIndexRef,
    hoveredOrderIdRef, lastHoveredOrderRef,
    setHoveredKline, setOrderToClose: handleOrderCloseRequest,
    getHoveredOrder, getClickedOrderId, getSLTPAtPosition,
    getClickedPositionActions,
    onPositionActions: (payload: { positionId: string; rect: { x: number; y: number; width: number; height: number } }) => setPositionActionsAnchor(payload),
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

  useChartPanelHeights({ manager, showEventRow, advancedConfig, indicatorsEnabled: layerFlags.indicators, panelId });

  // Candle-pattern hits for this panel — closed-bars-only, memoized so live
  // ticks don't re-evaluate. Layer flag gates the actual render call below.
  const patternHits = usePatternMarkers(panelId, klines);
  const patternDrawsRef = useRef<PatternHitDraw[]>([]);
  const renderCandlePatternsCb = useCallback(() => {
    patternDrawsRef.current.length = 0;
    if (!layerFlags.candlePatterns || !manager || patternHits.length === 0) return;
    const ctx = manager.getContext();
    if (!ctx) return;
    ctx.save();
    drawCandlePatterns(ctx, manager, klines, patternHits, colors, patternDrawsRef.current);
    ctx.restore();
  }, [layerFlags.candlePatterns, manager, patternHits, klines, colors]);

  // M1.1 — click a pattern glyph → info popover at the click point.
  // M2 — popover gains an "Edit pattern" button that opens the config dialog.
  const { patterns: userPatterns, update: updateUserPattern } = useUserPatterns();
  const [patternPopover, setPatternPopover] = useState<
    | { hit: PatternHit; anchor: { x: number; y: number }; barTime?: number; category?: string; description?: string; userPattern?: UserPattern }
    | null
  >(null);
  const [patternEditTarget, setPatternEditTarget] = useState<UserPattern | null>(null);

  const [positionActionsAnchor, setPositionActionsAnchor] = useState<
    | { positionId: string; rect: { x: number; y: number; width: number; height: number } }
    | null
  >(null);
  // The synthetic id rendered by renderPositions encodes (symbol, side):
  // `position-SYMBOL-LONG|SHORT`. Decode it back so we can pick the open
  // execution out of `allExecutions` — its real DB id is what the
  // popover's mutations need as `positionId`.
  const currentPositionForActions = useMemo(() => {
    if (!positionActionsAnchor) return null;
    const match = /^position-(.+)-(LONG|SHORT)$/.exec(positionActionsAnchor.positionId);
    if (!match) return null;
    const [, posSymbol, posSide] = match;
    const exec = allExecutions.find(
      (e) => e.symbol === posSymbol && e.side === posSide && e.status === 'open',
    );
    if (!exec) return null;
    return { id: exec.id, side: exec.side, quantity: exec.quantity };
  }, [positionActionsAnchor, allExecutions]);

  // Update cursor to `pointer` when hovering a pattern glyph so it reads as
  // clickable. Imperative — bypass React re-renders to keep mousemove cheap.
  const handlePatternHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!layerFlags.candlePatterns || patternDrawsRef.current.length === 0) {
        if (canvas.dataset['patternCursor'] === 'pointer') {
          canvas.style.cursor = 'crosshair';
          delete canvas.dataset['patternCursor'];
        }
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const draw = findPatternHitAtPosition(patternDrawsRef.current, e.clientX - rect.left, e.clientY - rect.top);
      if (draw && canvas.dataset['patternCursor'] !== 'pointer') {
        canvas.style.cursor = 'pointer';
        canvas.dataset['patternCursor'] = 'pointer';
      } else if (!draw && canvas.dataset['patternCursor'] === 'pointer') {
        canvas.style.cursor = 'crosshair';
        delete canvas.dataset['patternCursor'];
      }
    },
    [layerFlags.candlePatterns, canvasRef],
  );

  const handlePatternClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!layerFlags.candlePatterns || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const draw = findPatternHitAtPosition(patternDrawsRef.current, localX, localY);
      if (!draw) return;
      // Stop propagation so the click doesn't also trigger drawing-tool / order
      // placement handlers that listen to the canvas. Mousedown/up still flow
      // through their normal paths so drag gestures aren't broken.
      e.stopPropagation();
      const userPattern = userPatterns.find((p) => p.patternId === draw.hit.patternId);
      const kline = klines[draw.hit.index];
      setPatternPopover({
        hit: draw.hit,
        anchor: { x: e.clientX, y: e.clientY },
        ...(kline ? { barTime: Number(kline.openTime) } : {}),
        ...(userPattern
          ? { category: userPattern.definition.category, description: userPattern.definition.description, userPattern }
          : {}),
      });
    },
    [layerFlags.candlePatterns, canvasRef, klines, userPatterns],
  );

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
    renderCandlePatterns: renderCandlePatternsCb,
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
      <PositionActionsPopover
        open={!!positionActionsAnchor}
        onOpenChange={(open) => { if (!open) setPositionActionsAnchor(null); }}
        anchorRect={positionActionsAnchor?.rect ?? null}
        symbol={symbol ?? ''}
        walletId={backendWalletId}
        currentPosition={currentPositionForActions}
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
          onMouseMove={(e) => { handlePatternHover(e); handleCanvasMouseMoveWrapped(e); }}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handlePatternClick}
          onWheel={handleWheel}
          style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
        />
        <DrawingToolbar manager={manager} symbol={symbol ?? ''} interval={timeframe} />
        <TextEditOverlay manager={manager} symbol={symbol ?? ''} interval={timeframe} />
        <ChartNavigation onResetView={handleResetView} onNextKline={handleNextKline} totalPanelHeight={manager?.getTotalPanelHeight() ?? 0} />
        <ChartPerfOverlay />
      </Box>
      </ChartContextMenuManager>
      {patternPopover ? (
        <PatternInfoPopover
          anchor={patternPopover.anchor}
          hit={patternPopover.hit}
          {...(patternPopover.category ? { category: patternPopover.category } : {})}
          {...(patternPopover.description ? { description: patternPopover.description } : {})}
          {...(patternPopover.barTime !== undefined ? { barTime: patternPopover.barTime } : {})}
          {...(patternPopover.userPattern
            ? {
                onEdit: () => {
                  setPatternEditTarget(patternPopover.userPattern!);
                  setPatternPopover(null);
                },
              }
            : {})}
          onClose={() => setPatternPopover(null)}
        />
      ) : null}
      <PatternConfigDialog
        isOpen={patternEditTarget !== null}
        onClose={() => setPatternEditTarget(null)}
        mode="edit"
        {...(patternEditTarget ? { pattern: patternEditTarget } : {})}
        isLoading={updateUserPattern.isPending}
        previewKlines={klines}
        onSubmit={(def) => {
          if (!patternEditTarget) return;
          void updateUserPattern.mutateAsync({ id: patternEditTarget.id, definition: def })
            .then(() => setPatternEditTarget(null));
        }}
      />
    </>
  );
};

const arePropsStructurallyEqual = (prev: ChartCanvasProps, next: ChartCanvasProps): boolean => {
  if (prev.symbol !== next.symbol) return false;
  if (prev.marketType !== next.marketType) return false;
  if (prev.timeframe !== next.timeframe) return false;
  if (prev.chartType !== next.chartType) return false;
  if (prev.width !== next.width) return false;
  if (prev.height !== next.height) return false;
  if (prev.advancedConfig !== next.advancedConfig) return false;
  if (prev.initialViewport !== next.initialViewport) return false;
  if (prev.onViewportChange !== next.onViewportChange) return false;
  if (prev.onNearLeftEdge !== next.onNearLeftEdge) return false;
  if (prev.isLoadingMore !== next.isLoadingMore) return false;
  if (prev.klineSource !== next.klineSource) return false;

  if (!prev.klineSource) {
    if (prev.klines !== next.klines) return false;
    return true;
  }

  const pk = prev.klines;
  const nk = next.klines;
  if (pk.length !== nk.length) return false;
  if (pk.length === 0) return true;
  const pl = pk[pk.length - 1]!;
  const nl = nk[nk.length - 1]!;
  return pl.openTime === nl.openTime;
};

export const ChartCanvas = memo(ChartCanvasInternal, arePropsStructurallyEqual);
