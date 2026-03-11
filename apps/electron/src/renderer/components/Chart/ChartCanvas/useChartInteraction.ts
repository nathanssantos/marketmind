import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import type { Kline, MarketEvent, Order } from '@marketmind/types';
import type { TooltipData } from './useChartState';
import { pointToLineDistance } from '@marketmind/chart-studies';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
import { useCallback, useEffect, useRef } from 'react';

const RIGHT_MOUSE_BUTTON = 2;

export interface UseChartInteractionProps {
  manager: CanvasManager | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  klines: Kline[];
  movingAverages: MovingAverageConfig[];
  maValuesCache: Map<string, (number | null)[]>;
  advancedConfig?: AdvancedControlsConfig;
  showVolume: boolean;
  showEventRow: boolean;
  isPanning: boolean;
  shiftPressed: boolean;
  altPressed: boolean;
  tooltipEnabledRef: React.MutableRefObject<boolean>;
  mousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  orderPreviewRef: React.MutableRefObject<{ price: number; type: 'long' | 'short' } | null>;
  hoveredMAIndexRef: React.MutableRefObject<number | undefined>;
  hoveredOrderIdRef: React.MutableRefObject<string | null>;
  lastHoveredOrderRef: React.MutableRefObject<string | null>;
  lastTooltipOrderRef: React.MutableRefObject<string | null>;
  setTooltipData: (data: TooltipData) => void;
  setOrderToClose: (orderId: string | null) => void;
  getHoveredMATag: (x: number, y: number) => number | undefined;
  getHoveredOrder: (x: number, y: number) => Order | null;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
  getClickedOrderId: (x: number, y: number) => string | null;
  getSLTPAtPosition: (x: number, y: number) => { type: 'stopLoss' | 'takeProfit'; orderId: string; price: number } | null;
  onLongEntry?: (price: number) => void;
  onShortEntry?: (price: number) => void;
  orderDragHandler: {
    isDragging: boolean;
    handleMouseMove: (y: number) => void;
    handleMouseDown: (x: number, y: number) => boolean;
    handleMouseUp: () => void;
    handleSLTPMouseDown: (x: number, y: number, sltp: { type: 'stopLoss' | 'takeProfit'; orderId: string; price: number }) => boolean;
  };
  gridInteraction?: {
    isDrawing: boolean;
    handleMouseDown: (x: number, y: number) => boolean;
    handleMouseMove: (y: number) => void;
    handleMouseUp: () => void;
    cancelGrid: () => void;
  };
  drawingInteraction?: {
    isDrawing: boolean;
    handleMouseDown: (x: number, y: number) => boolean;
    handleMouseMove: (x: number, y: number) => boolean;
    handleMouseUp: (x: number, y: number) => boolean;
    getCursor: () => string | null;
    snapToOHLC: (x: number, y: number) => { x: number; y: number; snapped: boolean };
  };
  cursorManager: {
    setCursor: (cursor: 'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer') => void;
    getCursor: () => string;
  };
  handleMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
}

export interface UseChartInteractionResult {
  handleCanvasMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: () => void;
  handleCanvasMouseLeave: () => void;
  handleWheel: () => void;
}

const HOVER_THRESHOLD = 8;

export const useChartInteraction = ({
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
  setOrderToClose,
  getHoveredMATag,
  getHoveredOrder,
  getEventAtPosition,
  getClickedOrderId,
  getSLTPAtPosition,
  onLongEntry,
  onShortEntry,
  orderDragHandler,
  gridInteraction,
  drawingInteraction,
  cursorManager,
  handleMouseMove,
  handleMouseDown,
  handleMouseUp,
  handleMouseLeave,
}: UseChartInteractionProps): UseChartInteractionResult => {
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMouseEventRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);

  const updateCursor = useCallback((newCursor: 'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer') => {
    cursorManager.setCursor(newCursor);
  }, [cursorManager]);

  const startInteraction = useCallback((): void => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, []);

  const endInteraction = useCallback((): void => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      interactionTimeoutRef.current = null;
    }, 300);
  }, []);

  const processMouseMoveTooltip = useCallback((mouseX: number, mouseY: number, rect: DOMRect): void => {
    if (!manager || !tooltipEnabledRef.current) return;

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!dimensions || !bounds) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    const isOnTimeScale = mouseY >= timeScaleTop;
    const isInChartArea = mouseX < dimensions.chartWidth && mouseY < timeScaleTop;

    const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

    if (isOnPriceScale && hoveredTagIndex === undefined) {
      hoveredMAIndexRef.current = undefined;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    if (isOnTimeScale) {
      hoveredMAIndexRef.current = undefined;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    if (showEventRow && manager) {
      const eventRowY = manager.getEventRowY();
      const eventRowHeight = manager.getEventRowHeight();
      if (mouseY >= eventRowY && mouseY <= eventRowY + eventRowHeight) {
        const event = getEventAtPosition(mouseX, mouseY);
        if (event) {
          setTooltipData({
            kline: null, x: mouseX, y: mouseY, visible: true,
            containerWidth: rect.width, containerHeight: rect.height,
            marketEvent: event,
          });
          return;
        }
      }
    }

    const hoveredOrderForTooltip = getHoveredOrder(mouseX, mouseY);
    const hoveredOrderIdForTooltip = hoveredOrderForTooltip?.id || null;

    if (hoveredOrderForTooltip && klines.length > 0) {
      if (hoveredOrderIdForTooltip !== lastTooltipOrderRef.current) {
        lastTooltipOrderRef.current = hoveredOrderIdForTooltip;
        const lastKline = klines[klines.length - 1];
        const currentPriceVal = lastKline ? getKlineClose(lastKline) : undefined;
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect?.width, containerHeight: rect?.height,
          order: hoveredOrderForTooltip,
          ...(currentPriceVal && { currentPrice: currentPriceVal }),
        });
      }
      return;
    }

    if (!hoveredOrderForTooltip && lastTooltipOrderRef.current) {
      lastTooltipOrderRef.current = null;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    let closestMAIndex: number | undefined = undefined;
    let closestMADistance = Infinity;
    let closestMAValue: number | undefined = undefined;

    if (hoveredTagIndex !== undefined) {
      closestMAIndex = hoveredTagIndex;
    } else if (movingAverages.length > 0) {
      const effectiveWidth = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
      const visibleRange = viewport.end - viewport.start;
      const widthPerKline = effectiveWidth / visibleRange;
      const { klineWidth } = viewport;
      const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

      for (let maIdx = 0; maIdx < movingAverages.length; maIdx++) {
        const ma = movingAverages[maIdx];
        if (!ma || ma.visible === false) continue;
        const cacheKey = `${ma.type}-${ma.period}`;
        const maValues = maValuesCache.get(cacheKey);
        if (!maValues) continue;

        const startIdx = Math.max(0, Math.floor(viewport.start));
        const endIdx = Math.min(klines.length, Math.ceil(viewport.end));

        for (let i = startIdx; i < endIdx - 1; i++) {
          const value1 = maValues[i];
          const value2 = maValues[i + 1];
          if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) continue;

          const x1 = manager.indexToX(i) + klineCenterOffset;
          const y1 = manager.priceToY(value1);
          const x2 = manager.indexToX(i + 1) + klineCenterOffset;
          const y2 = manager.priceToY(value2);
          const distance = pointToLineDistance(mouseX, mouseY, x1, y1, x2, y2);

          if (distance < HOVER_THRESHOLD && distance < closestMADistance) {
            closestMADistance = distance;
            closestMAIndex = maIdx;
            closestMAValue = (value1 + value2) / 2;
          }
        }
        if (closestMADistance < HOVER_THRESHOLD * 0.5) break;
      }
    }

    hoveredMAIndexRef.current = closestMAIndex;

    if (closestMAIndex !== undefined) {
      const ma = movingAverages[closestMAIndex];
      if (ma) {
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect.width, containerHeight: rect.height,
          movingAverage: { period: ma.period, type: ma.type, color: ma.color, ...(closestMAValue !== undefined && { value: closestMAValue }) },
        });
        return;
      }
    }

    if (!isInChartArea) {
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = dimensions.chartWidth / visibleRange;
    const hoveredIndex = Math.floor(viewport.start + (mouseX / dimensions.chartWidth) * visibleRange);

    if (hoveredIndex >= 0 && hoveredIndex < klines.length) {
      const kline = klines[hoveredIndex];
      if (kline) {
        const relativeIndex = hoveredIndex - viewport.start;
        const hitAreaLeft = relativeIndex * widthPerKline;
        const hitAreaRight = hitAreaLeft + widthPerKline;

        const openY = manager.priceToY(getKlineOpen(kline));
        const closeY = manager.priceToY(getKlineClose(kline));
        const highY = manager.priceToY(getKlineHigh(kline));
        const lowY = manager.priceToY(getKlineLow(kline));
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);

        const volumeHeightRatio = advancedConfig?.volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO;
        const volumeOverlayHeight = dimensions.chartHeight * volumeHeightRatio;
        const volumeBaseY = dimensions.chartHeight;
        const volumeRatio = getKlineVolume(kline) / bounds.maxVolume;
        const barHeight = volumeRatio * volumeOverlayHeight;
        const volumeTop = volumeBaseY - barHeight;

        const isOnKlineBody = mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= bodyTop && mouseY <= bodyBottom;
        const isOnKlineWick = mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= highY && mouseY <= lowY;
        const isOnVolumeBar = showVolume && mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= volumeTop && mouseY <= volumeBaseY;

        if (isOnKlineBody || isOnKlineWick || isOnVolumeBar) {
          setTooltipData({
            kline, x: mouseX, y: mouseY, visible: true,
            containerWidth: rect.width, containerHeight: rect.height, klineIndex: hoveredIndex,
          });
          return;
        }
      }
    }

    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
  }, [manager, klines, movingAverages, maValuesCache, advancedConfig, showVolume, getHoveredMATag, getHoveredOrder, showEventRow, getEventAtPosition, setTooltipData, hoveredMAIndexRef, lastTooltipOrderRef, tooltipEnabledRef]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (orderDragHandler.isDragging) {
      orderDragHandler.handleMouseMove(mouseY);
      return;
    }

    if (gridInteraction?.isDrawing) {
      gridInteraction.handleMouseMove(mouseY);
      return;
    }

    if (drawingInteraction) {
      const handled = drawingInteraction.handleMouseMove(mouseX, mouseY);
      if (handled && drawingInteraction.isDrawing) {
        mousePositionRef.current = { x: mouseX, y: mouseY };
        const drawingCursor = drawingInteraction.getCursor();
        if (drawingCursor) updateCursor(drawingCursor as 'crosshair');
        return;
      }
      const drawingCursor = drawingInteraction.getCursor();
      if (drawingCursor) {
        updateCursor(drawingCursor as 'crosshair');
      }
      if (handled) {
        updateCursor('grab');
      }
    }

    handleMouseMove(event);

    if (isPanning) {
      mousePositionRef.current = { x: mouseX, y: mouseY };
      return;
    }

    if (!manager) return;

    const hoveredOrderButton = getClickedOrderId(mouseX, mouseY);
    const hoveredSLTP = getSLTPAtPosition(mouseX, mouseY);
    const hoveredOrder = hoveredSLTP ? null : getHoveredOrder(mouseX, mouseY);

    const newHoveredId = hoveredOrder?.id || null;
    if (newHoveredId !== lastHoveredOrderRef.current) {
      lastHoveredOrderRef.current = newHoveredId;
      hoveredOrderIdRef.current = newHoveredId;
      manager.markDirty('overlays');
    }

    const isOverOrderElement = orderDragHandler.isDragging || hoveredOrderButton || hoveredSLTP || hoveredOrder;

    if (orderDragHandler.isDragging) {
      updateCursor('ns-resize');
    } else if (hoveredOrderButton) {
      updateCursor('pointer');
    } else if (hoveredSLTP) {
      updateCursor('ns-resize');
    } else if (hoveredOrder) {
      const isActivePosition = hoveredOrder.id?.startsWith('position-');
      updateCursor(isActivePosition ? 'pointer' : 'ns-resize');
    }

    if (drawingInteraction) {
      const snapped = drawingInteraction.snapToOHLC(mouseX, mouseY);
      mousePositionRef.current = snapped.snapped ? { x: snapped.x, y: snapped.y } : { x: mouseX, y: mouseY };
    } else {
      mousePositionRef.current = { x: mouseX, y: mouseY };
    }
    manager.markDirty('overlays');

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    if (!isOverOrderElement) {
      const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
      const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
      const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
      const lastKlineX = manager.indexToX(klines.length - 1);
      const patternExtensionArea = lastKlineX + CHART_CONFIG.PATTERN_EXTENSION_DISTANCE;
      const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;
      const isInExtendedPatternArea = mouseX >= chartAreaRight && mouseX <= patternExtensionArea && mouseY < timeScaleTop;
      const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
      const isOnTimeScale = mouseY >= timeScaleTop;

      const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

      if (hoveredTagIndex !== undefined) updateCursor('pointer');
      else if (isOnPriceScale) updateCursor('ns-resize');
      else if (isOnTimeScale) updateCursor('crosshair');
      else if (isInChartArea || isInExtendedPatternArea) updateCursor('crosshair');
    }

    const timeScaleY = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    if ((shiftPressed || altPressed) && mouseY < timeScaleY) {
      const price = manager.yToPrice(mouseY);
      orderPreviewRef.current = { price, type: shiftPressed ? 'long' : 'short' };
      manager.markDirty('overlays');
    } else if (orderPreviewRef.current !== null) {
      orderPreviewRef.current = null;
      manager.markDirty('overlays');
    }

    pendingMouseEventRef.current = { x: mouseX, y: mouseY, rect };
    if (mouseMoveRafRef.current === null) {
      mouseMoveRafRef.current = requestAnimationFrame(() => {
        mouseMoveRafRef.current = null;
        const pending = pendingMouseEventRef.current;
        if (pending) {
          processMouseMoveTooltip(pending.x, pending.y, pending.rect);
        }
      });
    }
  }, [
    canvasRef, manager, klines, advancedConfig, isPanning,
    shiftPressed, altPressed,
    mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef,
    setTooltipData, getHoveredMATag, getHoveredOrder,
    getClickedOrderId, getSLTPAtPosition, orderDragHandler, gridInteraction, drawingInteraction, cursorManager,
    handleMouseMove, updateCursor, processMouseMoveTooltip,
  ]);

  const handleCanvasMouseLeave = useCallback((): void => {
    handleMouseLeave();
    gridInteraction?.cancelGrid();
    mousePositionRef.current = null;
    orderPreviewRef.current = null;
    hoveredOrderIdRef.current = null;
    lastHoveredOrderRef.current = null;
    lastTooltipOrderRef.current = null;
    setTooltipData({
      kline: null,
      x: 0,
      y: 0,
      visible: false,
    });
    if (manager) {
      manager.markDirty('overlays');
    }
  }, [handleMouseLeave, gridInteraction, mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef, setTooltipData, manager]);

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!manager || !canvasRef.current) return;

    if (event.button === RIGHT_MOUSE_BUTTON) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const sltpAtPosition = getSLTPAtPosition(mouseX, mouseY);

    const clickedOrderId = getClickedOrderId(mouseX, mouseY);
    if (clickedOrderId) {
      setOrderToClose(clickedOrderId);
      return;
    }

    if (sltpAtPosition) {
      if (orderDragHandler.handleSLTPMouseDown(mouseX, mouseY, sltpAtPosition)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    if ((shiftPressed || altPressed) && manager) {
      const dimensions = manager.getDimensions();
      if (dimensions) {
        const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
        const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
        if (mouseX < priceScaleLeft && mouseY < timeScaleTop) {
          const price = manager.yToPrice(mouseY);
          if (shiftPressed) onLongEntry?.(price);
          else onShortEntry?.(price);
          event.preventDefault();
          return;
        }
      }
    }

    if (!shiftPressed && !altPressed && orderDragHandler.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (gridInteraction && gridInteraction.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (drawingInteraction && drawingInteraction.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    handleMouseDown(event);
    startInteraction();
  }, [manager, canvasRef, advancedConfig, shiftPressed, altPressed, getSLTPAtPosition, getClickedOrderId, setOrderToClose, orderDragHandler, gridInteraction, drawingInteraction, handleMouseDown, startInteraction, onLongEntry, onShortEntry]);

  const handleCanvasMouseUp = useCallback((): void => {
    if (orderDragHandler.isDragging) {
      orderDragHandler.handleMouseUp();
      return;
    }

    if (gridInteraction?.isDrawing) {
      gridInteraction.handleMouseUp();
      return;
    }

    if (drawingInteraction?.isDrawing) {
      const mousePos = mousePositionRef.current;
      if (mousePos) {
        drawingInteraction.handleMouseUp(mousePos.x, mousePos.y);
      }
      return;
    }

    handleMouseUp();
    endInteraction();
  }, [orderDragHandler, gridInteraction, drawingInteraction, mousePositionRef, handleMouseUp, endInteraction]);

  const handleWheel = useCallback((): void => {
    startInteraction();
    endInteraction();
  }, [startInteraction, endInteraction]);

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
      if (mouseMoveRafRef.current !== null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = null;
      }
    };
  }, []);

  return {
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
    handleWheel,
  };
};
