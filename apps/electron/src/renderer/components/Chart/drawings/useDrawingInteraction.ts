import type { Drawing, DrawingType, CoordinateMapper } from '@marketmind/chart-studies';
import { hitTestDrawings, FIBONACCI_DEFAULT_LEVELS } from '@marketmind/chart-studies';
import { formatFibonacciLabel } from '@marketmind/fibonacci';
import type { Kline } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { useCallback, useEffect, useRef } from 'react';
import { useOHLCMagnet } from './useOHLCMagnet';

type InteractionPhase = 'idle' | 'placing-first' | 'placing-second' | 'drawing-freeform' | 'dragging';

interface UseDrawingInteractionProps {
  manager: CanvasManager | null;
  klines: Kline[];
  symbol: string;
  interval: string;
}

export interface OHLCSnapIndicator {
  x: number;
  y: number;
  ohlcType: 'open' | 'high' | 'low' | 'close';
}

interface UseDrawingInteractionResult {
  handleMouseDown: (x: number, y: number) => boolean;
  handleMouseMove: (x: number, y: number) => boolean;
  handleMouseUp: (x: number, y: number) => boolean;
  isDrawing: boolean;
  getCursor: () => string | null;
  pendingDrawingRef: React.MutableRefObject<Drawing | null>;
  lastSnapRef: React.MutableRefObject<OHLCSnapIndicator | null>;
  snapToOHLC: (x: number, y: number) => { x: number; y: number; snapped: boolean };
}

let nextDrawingId = 1;
const generateId = (): string => `drawing-${Date.now()}-${nextDrawingId++}`;

const createMapper = (manager: CanvasManager): CoordinateMapper => ({
  priceToY: (price: number) => manager.priceToY(price),
  yToPrice: (y: number) => manager.yToPrice(y),
  indexToX: (index: number) => manager.indexToX(index),
  xToIndex: (x: number) => {
    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    if (!dimensions) return 0;
    return Math.floor(viewport.start + (x / dimensions.chartWidth) * (viewport.end - viewport.start));
  },
  indexToCenterX: (index: number) => manager.indexToCenterX(index),
});

const computeFibLevels = (lowPrice: number, highPrice: number, direction: 'up' | 'down') => {
  const range = highPrice - lowPrice;
  if (range <= 0) return [];
  return FIBONACCI_DEFAULT_LEVELS.map(level => {
    const price = level <= 1
      ? (direction === 'up' ? lowPrice + range * level : highPrice - range * level)
      : (direction === 'up' ? highPrice + range * (level - 1) : lowPrice - range * (level - 1));
    return { level, price, label: formatFibonacciLabel(level) };
  });
};

export const useDrawingInteraction = ({
  manager,
  klines,
  symbol,
  interval,
}: UseDrawingInteractionProps): UseDrawingInteractionResult => {
  const phaseRef = useRef<InteractionPhase>('idle');
  const pendingDrawingRef = useRef<Drawing | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; handleType: string | null; originalDrawing: Drawing } | null>(null);
  const lastSnapRef = useRef<OHLCSnapIndicator | null>(null);

  useEffect(() => {
    phaseRef.current = 'idle';
    pendingDrawingRef.current = null;
    lastSnapRef.current = null;
  }, [symbol]);

  const magnetEnabled = useDrawingStore(s => s.magnetEnabled);
  const { snap } = useOHLCMagnet({ manager, klines, enabled: magnetEnabled });

  const getIndexAndPrice = useCallback((x: number, y: number): { index: number; price: number; time?: number } => {
    if (!manager) return { index: 0, price: 0 };
    const result = snap(x, y);
    const idx = result.snappedIndex;
    const clamped = Math.max(0, Math.min(idx, klines.length - 1));
    const time = klines[Math.round(clamped)]?.openTime;
    return { index: idx, price: result.snappedPrice, time };
  }, [manager, snap, klines]);

  const handleMouseDown = useCallback((x: number, y: number): boolean => {
    if (!manager) return false;

    const store = useDrawingStore.getState();
    const activeTool = store.activeTool;
    const selectedId = store.selectedDrawingId;

    if (!activeTool) {
      const mapper = createMapper(manager);
      const drawings = store.getDrawingsForSymbol(symbol, interval);
      const hit = hitTestDrawings(x, y, drawings, mapper, selectedId);

      if (hit) {
        if (hit.drawingId !== selectedId) {
          store.selectDrawing(hit.drawingId);
        }

        const drawing = drawings.find(d => d.id === hit.drawingId);
        if (drawing && !drawing.locked) {
          const isFibBody = drawing.type === 'fibonacci' && (hit.handleType === null || hit.handleType === 'body');
          if (!isFibBody) {
            phaseRef.current = 'dragging';
            dragStartRef.current = { x, y, handleType: hit.handleType, originalDrawing: { ...drawing } as Drawing };
            return true;
          }
        }
        return true;
      }

      if (selectedId) {
        store.selectDrawing(null);
        return false;
      }
      return false;
    }

    const { index, price, time } = getIndexAndPrice(x, y);

    if (activeTool === 'pencil') {
      const drawing: Drawing = {
        id: generateId(), type: 'pencil', symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        points: [{ index, price, time }],
      };
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'drawing-freeform';
      return true;
    }

    if (activeTool === 'rectangle' || activeTool === 'area') {
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        startIndex: index, startPrice: price, endIndex: index, endPrice: price,
        startTime: time, endTime: time,
      } as Drawing;
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'placing-second';
      return true;
    }

    if (phaseRef.current === 'idle' || phaseRef.current === 'placing-first') {
      phaseRef.current = 'placing-first';
      const drawingType = activeTool as DrawingType;

      if (drawingType === 'fibonacci') {
        const drawing: Drawing = {
          id: generateId(), type: 'fibonacci', symbol, interval, visible: true, locked: false, zIndex: 0,
          createdAt: Date.now(), updatedAt: Date.now(),
          swingLowIndex: index, swingLowPrice: price,
          swingHighIndex: index, swingHighPrice: price,
          swingLowTime: time, swingHighTime: time,
          direction: 'up', levels: [],
        };
        pendingDrawingRef.current = drawing;
        phaseRef.current = 'placing-second';
        return true;
      }

      const drawing: Drawing = {
        id: generateId(), type: drawingType as 'line' | 'ruler', symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        startIndex: index, startPrice: price, endIndex: index, endPrice: price,
        startTime: time, endTime: time,
      } as Drawing;
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'placing-second';
      return true;
    }

    return false;
  }, [manager, symbol, interval, getIndexAndPrice]);

  const handleMouseMove = useCallback((x: number, y: number): boolean => {
    if (!manager) return false;

    const phase = phaseRef.current;
    const pending = pendingDrawingRef.current;

    if (phase === 'placing-second' && pending) {
      const { index, price, time } = getIndexAndPrice(x, y);
      if (pending.type === 'fibonacci') {
        const lowPrice = Math.min(pending.swingLowPrice, price);
        const highPrice = Math.max(pending.swingLowPrice, price);
        const dir = price >= pending.swingLowPrice ? 'up' : 'down';
        pendingDrawingRef.current = {
          ...pending,
          swingHighIndex: index,
          swingHighPrice: price,
          swingHighTime: time,
          direction: dir,
          levels: computeFibLevels(lowPrice, highPrice, dir),
        };
      } else if (pending.type === 'line' || pending.type === 'ruler' || pending.type === 'rectangle' || pending.type === 'area') {
        pendingDrawingRef.current = { ...pending, endIndex: index, endPrice: price, endTime: time } as Drawing;
      }
      manager.markDirty('overlays');
      return true;
    }

    if (phase === 'drawing-freeform' && pending && pending.type === 'pencil') {
      const { index, price, time } = getIndexAndPrice(x, y);
      pendingDrawingRef.current = {
        ...pending,
        points: [...pending.points, { index, price, time }],
      };
      manager.markDirty('overlays');
      return true;
    }

    if (phase === 'dragging' && dragStartRef.current) {
      const store = useDrawingStore.getState();
      const { handleType, originalDrawing } = dragStartRef.current;
      const { index: newIndex, price: newPrice, time: newTime } = getIndexAndPrice(x, y);
      const { index: startDragIndex, price: startDragPrice } = getIndexAndPrice(dragStartRef.current.x, dragStartRef.current.y);

      const deltaIndex = newIndex - startDragIndex;
      const deltaPrice = newPrice - startDragPrice;

      const timeAt = (idx: number) => {
        const c = Math.round(Math.max(0, Math.min(idx, klines.length - 1)));
        return klines[c]?.openTime;
      };

      if (handleType === 'body' || handleType === null) {
        if (originalDrawing.type === 'line' || originalDrawing.type === 'ruler' || originalDrawing.type === 'rectangle' || originalDrawing.type === 'area') {
          const si = originalDrawing.startIndex + deltaIndex;
          const ei = originalDrawing.endIndex + deltaIndex;
          store.updateDrawing(originalDrawing.id, {
            startIndex: si, startPrice: originalDrawing.startPrice + deltaPrice,
            endIndex: ei, endPrice: originalDrawing.endPrice + deltaPrice,
            startTime: timeAt(si), endTime: timeAt(ei),
          } as Partial<Drawing>);
        } else if (originalDrawing.type === 'fibonacci') {
          const lowPrice = originalDrawing.swingLowPrice + deltaPrice;
          const highPrice = originalDrawing.swingHighPrice + deltaPrice;
          const sli = originalDrawing.swingLowIndex + deltaIndex;
          const shi = originalDrawing.swingHighIndex + deltaIndex;
          store.updateDrawing(originalDrawing.id, {
            swingLowIndex: sli, swingLowPrice: lowPrice,
            swingHighIndex: shi, swingHighPrice: highPrice,
            swingLowTime: timeAt(sli), swingHighTime: timeAt(shi),
            levels: computeFibLevels(Math.min(lowPrice, highPrice), Math.max(lowPrice, highPrice), originalDrawing.direction),
          } as Partial<Drawing>);
        } else if (originalDrawing.type === 'pencil') {
          store.updateDrawing(originalDrawing.id, {
            points: originalDrawing.points.map(p => {
              const ni = p.index + deltaIndex;
              return { index: ni, price: p.price + deltaPrice, time: timeAt(ni) };
            }),
          } as Partial<Drawing>);
        }
      } else if (handleType === 'start' && (originalDrawing.type === 'line' || originalDrawing.type === 'ruler' || originalDrawing.type === 'rectangle' || originalDrawing.type === 'area')) {
        store.updateDrawing(originalDrawing.id, { startIndex: newIndex, startPrice: newPrice, startTime: newTime } as Partial<Drawing>);
      } else if (handleType === 'end' && (originalDrawing.type === 'line' || originalDrawing.type === 'ruler' || originalDrawing.type === 'rectangle' || originalDrawing.type === 'area')) {
        store.updateDrawing(originalDrawing.id, { endIndex: newIndex, endPrice: newPrice, endTime: newTime } as Partial<Drawing>);
      } else if (handleType === 'swingLow' && originalDrawing.type === 'fibonacci') {
        const lowPrice = newPrice;
        const highPrice = originalDrawing.swingHighPrice;
        const dir = highPrice >= lowPrice ? 'up' : 'down';
        store.updateDrawing(originalDrawing.id, {
          swingLowIndex: newIndex, swingLowPrice: newPrice, swingLowTime: newTime, direction: dir,
          levels: computeFibLevels(Math.min(lowPrice, highPrice), Math.max(lowPrice, highPrice), dir),
        } as Partial<Drawing>);
      } else if (handleType === 'swingHigh' && originalDrawing.type === 'fibonacci') {
        const lowPrice = originalDrawing.swingLowPrice;
        const highPrice = newPrice;
        const dir = newPrice >= originalDrawing.swingLowPrice ? 'up' : 'down';
        store.updateDrawing(originalDrawing.id, {
          swingHighIndex: newIndex, swingHighPrice: newPrice, swingHighTime: newTime, direction: dir,
          levels: computeFibLevels(Math.min(lowPrice, highPrice), Math.max(lowPrice, highPrice), dir),
        } as Partial<Drawing>);
      }

      manager.markDirty('overlays');
      return true;
    }

    if (!useDrawingStore.getState().activeTool) {
      const mapper = createMapper(manager);
      const drawings = useDrawingStore.getState().getDrawingsForSymbol(symbol, interval);
      const selectedId = useDrawingStore.getState().selectedDrawingId;
      const hit = hitTestDrawings(x, y, drawings, mapper, selectedId);
      return hit !== null;
    }

    return false;
  }, [manager, symbol, interval, getIndexAndPrice]);

  const handleMouseUp = useCallback((x: number, y: number): boolean => {
    const phase = phaseRef.current;

    if (phase === 'placing-second' && pendingDrawingRef.current) {
      const { index, price } = getIndexAndPrice(x, y);
      let drawing = pendingDrawingRef.current;

      if (drawing.type === 'fibonacci') {
        const lowPrice = Math.min(drawing.swingLowPrice, price);
        const highPrice = Math.max(drawing.swingLowPrice, price);
        const dir = price >= drawing.swingLowPrice ? 'up' : 'down';
        drawing = {
          ...drawing,
          swingHighIndex: index,
          swingHighPrice: price,
          direction: dir,
          levels: computeFibLevels(lowPrice, highPrice, dir),
        };
      } else if (drawing.type === 'line' || drawing.type === 'ruler' || drawing.type === 'rectangle' || drawing.type === 'area') {
        drawing = { ...drawing, endIndex: index, endPrice: price } as Drawing;
      }

      const isZeroLength =
        (drawing.type === 'fibonacci' && drawing.swingLowPrice === drawing.swingHighPrice) ||
        ((drawing.type === 'rectangle' || drawing.type === 'area') && (drawing.startIndex === drawing.endIndex || drawing.startPrice === drawing.endPrice)) ||
        ((drawing.type === 'line' || drawing.type === 'ruler') && drawing.startIndex === drawing.endIndex && drawing.startPrice === drawing.endPrice);

      const store = useDrawingStore.getState();

      if (isZeroLength) {
        store.setActiveTool(null);
        pendingDrawingRef.current = null;
        phaseRef.current = 'idle';
        manager?.markDirty('overlays');
        return true;
      }

      store.addDrawing(drawing);
      store.selectDrawing(drawing.id);
      store.setActiveTool(null);
      pendingDrawingRef.current = null;
      phaseRef.current = 'idle';
      manager?.markDirty('overlays');
      return true;
    }

    if (phase === 'drawing-freeform' && pendingDrawingRef.current) {
      const drawing = pendingDrawingRef.current;
      const store = useDrawingStore.getState();
      store.addDrawing(drawing);
      store.selectDrawing(drawing.id);
      store.setActiveTool(null);
      pendingDrawingRef.current = null;
      phaseRef.current = 'idle';
      manager?.markDirty('overlays');
      return true;
    }

    if (phase === 'dragging') {
      dragStartRef.current = null;
      phaseRef.current = 'idle';
      return true;
    }

    return false;
  }, [manager, getIndexAndPrice]);

  const isDrawing = phaseRef.current !== 'idle';

  const getCursor = useCallback((): string | null => {
    const store = useDrawingStore.getState();
    if (store.activeTool) return 'crosshair';
    if (phaseRef.current === 'dragging') return 'grabbing';
    return null;
  }, []);

  const snapToOHLC = useCallback((x: number, y: number): { x: number; y: number; snapped: boolean } => {
    if (!manager) {
      lastSnapRef.current = null;
      return { x, y, snapped: false };
    }
    const result = snap(x, y);
    if (!result.snapped || !result.ohlcType) {
      lastSnapRef.current = null;
      return { x, y, snapped: false };
    }
    const snappedX = manager.indexToCenterX(result.snappedIndex);
    const snappedY = manager.priceToY(result.snappedPrice);
    lastSnapRef.current = { x: snappedX, y: snappedY, ohlcType: result.ohlcType };
    return { x: snappedX, y: snappedY, snapped: true };
  }, [manager, snap]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDrawing,
    getCursor,
    pendingDrawingRef,
    lastSnapRef,
    snapToOHLC,
  };
};
