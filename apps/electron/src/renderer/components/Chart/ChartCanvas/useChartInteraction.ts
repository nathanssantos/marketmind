import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { Kline, MarketEvent, Order } from '@marketmind/types';
import type { TooltipData } from './useChartState';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect, useRef } from 'react';
import { processTooltipHitTest } from './tooltipHitTest';

const RIGHT_MOUSE_BUTTON = 2;

export interface UseChartInteractionProps {
  manager: CanvasManager | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  klines: Kline[];
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
    isDrawing: () => boolean;
    handleMouseDown: (x: number, y: number) => boolean;
    handleMouseMove: (x: number, y: number) => boolean;
    handleMouseUp: (x: number, y: number) => boolean;
    cancelInteraction: (options?: { revert?: boolean }) => boolean;
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

export const useChartInteraction = ({
  manager,
  canvasRef,
  klines,
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

    processTooltipHitTest({
      manager,
      mouseX,
      mouseY,
      rect,
      klines,
      advancedConfig,
      showVolume,
      showEventRow,
      lastTooltipOrderRef,
      getHoveredOrder,
      getEventAtPosition,
      hoveredMAIndexRef,
      setTooltipData,
    });
  }, [manager, klines, advancedConfig, showVolume, getHoveredOrder, showEventRow, getEventAtPosition, setTooltipData, hoveredMAIndexRef, lastTooltipOrderRef, tooltipEnabledRef]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isPanning) {
      handleMouseMove(event);
      mousePositionRef.current = { x: mouseX, y: mouseY };
      return;
    }

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
      if (handled && drawingInteraction.isDrawing()) {
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

    if (!manager) return;

    const hoveredOrderButton = getClickedOrderId(mouseX, mouseY);
    const hoveredSLTP = getSLTPAtPosition(mouseX, mouseY);
    const hoveredOrder = hoveredSLTP ? null : getHoveredOrder(mouseX, mouseY);

    const newHoveredId = hoveredOrder?.id ?? null;
    if (newHoveredId !== lastHoveredOrderRef.current && !orderDragHandler.isDragging) {
      lastHoveredOrderRef.current = newHoveredId;
      hoveredOrderIdRef.current = newHoveredId;
      manager.markDirty('overlays');
    }

    const isOverOrderElement = orderDragHandler.isDragging || (hoveredOrderButton ?? hoveredSLTP ?? hoveredOrder);

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

      if (isOnPriceScale) updateCursor('ns-resize');
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
    mouseMoveRafRef.current ??= requestAnimationFrame(() => {
      mouseMoveRafRef.current = null;
      const pending = pendingMouseEventRef.current;
      if (pending) {
        processMouseMoveTooltip(pending.x, pending.y, pending.rect);
      }
    });
  }, [
    canvasRef, manager, klines, advancedConfig, isPanning,
    shiftPressed, altPressed,
    mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef,
    setTooltipData, getHoveredOrder,
    getClickedOrderId, getSLTPAtPosition, orderDragHandler, gridInteraction, drawingInteraction, cursorManager,
    handleMouseMove, updateCursor, processMouseMoveTooltip,
  ]);

  const handleCanvasMouseLeave = useCallback((): void => {
    handleMouseLeave();
    gridInteraction?.cancelGrid();
    // Drawing interaction may be mid-placement (placing-second / placing-third
    // / drawing-freeform) or mid-drag. Cancelling here releases the phase
    // back to 'idle' so the next click on the canvas isn't trapped in a
    // stale phase. The drawing store keeps any drawing already-committed —
    // a drag interrupted by a leave just freezes at its current position.
    drawingInteraction?.cancelInteraction();
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
  }, [handleMouseLeave, gridInteraction, drawingInteraction, mousePositionRef, orderPreviewRef, hoveredOrderIdRef, lastHoveredOrderRef, lastTooltipOrderRef, setTooltipData, manager]);

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
          manager.markDirty('overlays');
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

    if (gridInteraction?.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Note: a previous version had an `if (drawingInteraction?.isDrawing())`
    // short-circuit here that swallowed mousedown while a drawing was in
    // any non-idle phase. That broke channel/pitchfork: their finalize
    // click happens during phase 'placing-third', and was being
    // intercepted before reaching the drawing handler. The handler itself
    // already branches on phase + tool, so the guard is redundant.
    if (drawingInteraction?.handleMouseDown(mouseX, mouseY)) {
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

    if (drawingInteraction?.isDrawing()) {
      // Always release drawing state on mouseup, even if `mousePositionRef`
      // is null (which can happen if mouseleave fires between move and up).
      // The bug it covers: phase getting stuck in 'dragging' / 'placing-*'
      // and the next click being treated as a continuation of the previous
      // interaction — the user-visible "mouse grudado" symptom.
      const mousePos = mousePositionRef.current;
      if (mousePos) {
        drawingInteraction.handleMouseUp(mousePos.x, mousePos.y);
      } else {
        drawingInteraction.cancelInteraction();
      }
      handleMouseUp();
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

  // Safety net: if the user releases the mouse outside the canvas while a
  // drawing interaction is in flight, the canvas's mouseup handler never
  // fires. Without a window-level fallback the phase ref stays stuck and
  // subsequent clicks behave as a continuation of the previous interaction
  // ("mouse grudado"). The listener is registered once and reads the latest
  // drawingInteraction through a ref so it doesn't churn on every render.
  const drawingInteractionRef = useRef(drawingInteraction);
  useEffect(() => {
    drawingInteractionRef.current = drawingInteraction;
  }, [drawingInteraction]);
  useEffect(() => {
    const onWindowMouseUp = (): void => {
      const interaction = drawingInteractionRef.current;
      if (!interaction?.isDrawing()) return;
      const pos = mousePositionRef.current;
      if (pos) {
        interaction.handleMouseUp(pos.x, pos.y);
      } else {
        interaction.cancelInteraction();
      }
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [mousePositionRef]);

  return {
    handleCanvasMouseMove,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
    handleWheel,
  };
};
