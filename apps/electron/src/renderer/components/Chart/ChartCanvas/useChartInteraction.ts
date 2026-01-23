import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import type { Kline, MarketEvent, Order } from '@marketmind/types';
import type { TooltipData, MeasurementArea } from './useChartState';
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
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  isPanning: boolean;
  isMeasuring: boolean;
  measurementArea: MeasurementArea | null;
  shiftPressed: boolean;
  altPressed: boolean;
  hasTradingEnabled: boolean;
  isAutoTradingActive: boolean;
  tooltipEnabledRef: React.MutableRefObject<boolean>;
  mousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  orderPreviewRef: React.MutableRefObject<{ price: number; type: 'long' | 'short' } | null>;
  hoveredMAIndexRef: React.MutableRefObject<number | undefined>;
  hoveredOrderIdRef: React.MutableRefObject<string | null>;
  lastHoveredOrderRef: React.MutableRefObject<string | null>;
  lastTooltipOrderRef: React.MutableRefObject<string | null>;
  measurementAreaRef: React.MutableRefObject<MeasurementArea | null>;
  measurementRafRef: React.MutableRefObject<number | null>;
  setTooltipData: (data: TooltipData) => void;
  setIsMeasuring: (value: boolean) => void;
  setMeasurementArea: (area: MeasurementArea | null) => void;
  setOrderToClose: (orderId: string | null) => void;
  getHoveredMATag: (x: number, y: number) => number | undefined;
  getHoveredOrder: (x: number, y: number) => Order | null;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
  getClickedOrderId: (x: number, y: number) => string | null;
  getSLTPAtPosition: (x: number, y: number) => { type: 'stopLoss' | 'takeProfit'; orderId: string; price: number } | null;
  orderDragHandler: {
    isDragging: boolean;
    handleMouseMove: (y: number) => void;
    handleMouseDown: (x: number, y: number) => boolean;
    handleMouseUp: () => void;
    handleSLTPMouseDown: (x: number, y: number, sltp: { type: 'stopLoss' | 'takeProfit'; orderId: string; price: number }) => boolean;
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

const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;
  let xx: number, yy: number;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const useChartInteraction = ({
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
    const HOVER_THRESHOLD = 8;

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
          const distance = distanceToLine(mouseX, mouseY, x1, y1, x2, y2);

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

    if (isMeasuring && manager && measurementArea) {
      const viewport = manager.getViewport();
      const dimensions = manager.getDimensions();
      if (!dimensions) return;

      const hoveredIndex = Math.floor(viewport.start + (mouseX / dimensions.chartWidth) * (viewport.end - viewport.start));

      const updatedMeasurement = {
        ...measurementArea,
        endX: mouseX,
        endY: mouseY,
        endIndex: hoveredIndex,
      };

      measurementAreaRef.current = updatedMeasurement;
      manager.markDirty('overlays');

      mousePositionRef.current = { x: mouseX, y: mouseY };

      if (measurementRafRef.current) {
        cancelAnimationFrame(measurementRafRef.current);
      }

      measurementRafRef.current = requestAnimationFrame(() => {
        measurementRafRef.current = null;

        const startIndex = Math.min(measurementArea.startIndex, hoveredIndex);
        const endIndex = Math.max(measurementArea.startIndex, hoveredIndex);
        const klineCount = Math.abs(endIndex - startIndex);

        const startPrice = manager.yToPrice(measurementArea.startY);
        const endPrice = manager.yToPrice(mouseY);
        const priceChange = endPrice - startPrice;
        const percentChange = (priceChange / startPrice) * 100;

        setMeasurementArea(updatedMeasurement);
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect.width, containerHeight: rect.height,
          measurement: { klineCount, priceChange, percentChange, startPrice, endPrice },
        });
      });

      return;
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

    if (orderDragHandler.isDragging) {
      updateCursor('ns-resize');
    } else if (hoveredOrderButton) {
      updateCursor('pointer');
    } else if (hoveredSLTP) {
      updateCursor('ns-resize');
    } else if (hoveredOrder) {
      updateCursor('ns-resize');
    } else if (cursorManager.getCursor() !== 'crosshair') {
      updateCursor('crosshair');
    }

    mousePositionRef.current = { x: mouseX, y: mouseY };
    manager.markDirty('overlays');

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

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

    if (hasTradingEnabled && !isAutoTradingActive && (shiftPressed || altPressed) && mouseY < timeScaleTop) {
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
    canvasRef, manager, klines, advancedConfig, isPanning, isMeasuring, measurementArea,
    shiftPressed, altPressed, hasTradingEnabled, isAutoTradingActive,
    mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef,
    measurementAreaRef, measurementRafRef,
    setTooltipData, setMeasurementArea, getHoveredMATag, getHoveredOrder,
    getClickedOrderId, getSLTPAtPosition, orderDragHandler, cursorManager,
    handleMouseMove, updateCursor, processMouseMoveTooltip,
  ]);

  const handleCanvasMouseLeave = useCallback((): void => {
    handleMouseLeave();
    mousePositionRef.current = null;
    orderPreviewRef.current = null;
    hoveredOrderIdRef.current = null;
    lastHoveredOrderRef.current = null;
    lastTooltipOrderRef.current = null;
    measurementAreaRef.current = null;
    if (measurementRafRef.current) {
      cancelAnimationFrame(measurementRafRef.current);
      measurementRafRef.current = null;
    }
    setIsMeasuring(false);
    setMeasurementArea(null);
    setTooltipData({
      kline: null,
      x: 0,
      y: 0,
      visible: false,
    });
    if (manager) {
      manager.markDirty('overlays');
    }
  }, [handleMouseLeave, mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef, measurementAreaRef, measurementRafRef, setIsMeasuring, setMeasurementArea, setTooltipData, manager]);

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

    if (!shiftPressed && !altPressed && orderDragHandler.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if ((showMeasurementRuler || showMeasurementArea) && manager && canvasRef.current) {
      const dimensions = manager.getDimensions();
      if (!dimensions) return;

      const timeScaleTop = dimensions.height - 40;
      const priceScaleLeft = dimensions.width - (advancedConfig?.rightMargin ?? 72);

      if (mouseX < priceScaleLeft && mouseY < timeScaleTop) {
        const viewport = manager.getViewport();
        const hoveredIndex = Math.floor(viewport.start + (mouseX / dimensions.chartWidth) * (viewport.end - viewport.start));

        const initialMeasurement = {
          startX: mouseX,
          startY: mouseY,
          endX: mouseX,
          endY: mouseY,
          startIndex: hoveredIndex,
          endIndex: hoveredIndex,
        };

        measurementAreaRef.current = initialMeasurement;
        setIsMeasuring(true);
        setMeasurementArea(initialMeasurement);
        manager.markDirty('overlays');
        return;
      }
    }

    handleMouseDown(event);
    startInteraction();
  }, [manager, canvasRef, advancedConfig, shiftPressed, altPressed, showMeasurementRuler, showMeasurementArea, getSLTPAtPosition, getClickedOrderId, setOrderToClose, orderDragHandler, measurementAreaRef, setIsMeasuring, setMeasurementArea, handleMouseDown, startInteraction]);

  const handleCanvasMouseUp = useCallback((): void => {
    if (orderDragHandler.isDragging) {
      orderDragHandler.handleMouseUp();
      return;
    }

    if (isMeasuring) {
      if (measurementRafRef.current) {
        cancelAnimationFrame(measurementRafRef.current);
        measurementRafRef.current = null;
      }
      measurementAreaRef.current = null;
      setIsMeasuring(false);
      setMeasurementArea(null);
      if (manager) {
        manager.markDirty('overlays');
      }
      return;
    }

    handleMouseUp();
    endInteraction();
  }, [orderDragHandler, isMeasuring, measurementAreaRef, measurementRafRef, setIsMeasuring, setMeasurementArea, manager, handleMouseUp, endInteraction]);

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
      if (measurementRafRef.current !== null) {
        cancelAnimationFrame(measurementRafRef.current);
        measurementRafRef.current = null;
      }
    };
  }, [measurementRafRef]);

  return {
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
    handleWheel,
  };
};
