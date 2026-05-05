import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { hitTestDrawings, FIBONACCI_DEFAULT_LEVELS, DEFAULT_FONT_SIZE, resolveDrawingIndices } from '@marketmind/chart-studies';
import { formatFibonacciLabel } from '@marketmind/fibonacci';
import type { Kline } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { createDrawingMapper } from '@renderer/utils/canvas/canvasHelpers';
import { INDICATOR_COLORS } from '@shared/constants';
import { useDrawingStore, compositeKey } from '@renderer/store/drawingStore';
import { useCallback, useEffect, useRef } from 'react';
import { useOHLCMagnet } from './useOHLCMagnet';
import { getHandlePoints } from './drawingHandles';

const DRAWING_HANDLE_SNAP_PIXEL_THRESHOLD = 12;

type InteractionPhase = 'idle' | 'placing-first' | 'placing-second' | 'placing-third' | 'drawing-freeform' | 'dragging';

interface UseDrawingInteractionProps {
  manager: CanvasManager | null;
  klines: Kline[];
  symbol: string;
  interval: string;
}

export interface OHLCSnapIndicator {
  x: number;
  y: number;
  /**
   * `'handle'` is used when the magnet is snapping to an existing
   * drawing's anchor point (corner / endpoint / fib swing / etc.) —
   * same visual indicator dot, no OHLC letter label.
   */
  ohlcType: 'open' | 'high' | 'low' | 'close' | 'handle';
}

interface CancelInteractionOptions {
  /**
   * When true and a drag is in progress, restore the drawing back to the
   * snapshot taken at mousedown. Used by ESC so the user can abort an
   * accidental drag the same way they abort an accidental order placement.
   * Default false: drag is released in place (e.g. for mouseleave).
   */
  revert?: boolean;
}

interface UseDrawingInteractionResult {
  handleMouseDown: (x: number, y: number) => boolean;
  handleMouseMove: (x: number, y: number) => boolean;
  handleMouseUp: (x: number, y: number) => boolean;
  cancelInteraction: (options?: CancelInteractionOptions) => boolean;
  // Read live from `phaseRef.current` so callers always see the latest value.
  // Returning a snapshotted boolean would be stale: the hook does not
  // re-render between mouse events (no zustand subscription tracks the
  // phase), so a snapshot taken at the previous render would still show
  // 'idle' after a mousedown that just transitioned to 'placing-second'.
  isDrawing: () => boolean;
  getCursor: () => string | null;
  pendingDrawingRef: React.MutableRefObject<Drawing | null>;
  lastSnapRef: React.MutableRefObject<OHLCSnapIndicator | null>;
  snapToOHLC: (x: number, y: number) => { x: number; y: number; snapped: boolean };
}

type TwoPointType = 'line' | 'ruler' | 'arrow' | 'rectangle' | 'area' | 'ray' | 'channel' | 'trendLine' | 'priceRange' | 'ellipse' | 'gannFan';
const TWO_POINT_TYPES = new Set<string>(['line', 'ruler', 'arrow', 'rectangle', 'area', 'ray', 'channel', 'trendLine', 'priceRange', 'ellipse', 'gannFan']);
const isTwoPointDrawing = (d: Drawing): d is Drawing & { type: TwoPointType; startIndex: number; startPrice: number; endIndex: number; endPrice: number; startTime?: number; endTime?: number } =>
  TWO_POINT_TYPES.has(d.type);

let nextDrawingId = 1;
const generateId = (): string => `drawing-${Date.now()}-${nextDrawingId++}`;

const applyDragUpdate = (
  store: ReturnType<typeof useDrawingStore.getState>,
  originalDrawing: Drawing,
  handleType: string | null,
  deltaIndex: number,
  deltaPrice: number,
  newIndex: number,
  newPrice: number,
  newTime: number | undefined,
  timeAt: (idx: number) => number | undefined,
): void => {
  if (handleType === 'body' || handleType === null) {
    if (originalDrawing.type === 'channel' || originalDrawing.type === 'pitchfork') {
      const si = originalDrawing.startIndex + deltaIndex;
      const ei = originalDrawing.endIndex + deltaIndex;
      const wi = originalDrawing.widthIndex + deltaIndex;
      store.updateDrawing(originalDrawing.id, {
        startIndex: si, startPrice: originalDrawing.startPrice + deltaPrice,
        endIndex: ei, endPrice: originalDrawing.endPrice + deltaPrice,
        startTime: timeAt(si), endTime: timeAt(ei),
        widthIndex: wi, widthPrice: originalDrawing.widthPrice + deltaPrice,
        widthTime: timeAt(wi),
      });
      return;
    }

    if (isTwoPointDrawing(originalDrawing)) {
      const si = originalDrawing.startIndex + deltaIndex;
      const ei = originalDrawing.endIndex + deltaIndex;
      store.updateDrawing(originalDrawing.id, {
        startIndex: si, startPrice: originalDrawing.startPrice + deltaPrice,
        endIndex: ei, endPrice: originalDrawing.endPrice + deltaPrice,
        startTime: timeAt(si), endTime: timeAt(ei),
      });
      return;
    }

    if (originalDrawing.type === 'fibonacci') {
      const lowPrice = originalDrawing.swingLowPrice + deltaPrice;
      const highPrice = originalDrawing.swingHighPrice + deltaPrice;
      const sli = originalDrawing.swingLowIndex + deltaIndex;
      const shi = originalDrawing.swingHighIndex + deltaIndex;
      store.updateDrawing(originalDrawing.id, {
        swingLowIndex: sli, swingLowPrice: lowPrice,
        swingHighIndex: shi, swingHighPrice: highPrice,
        swingLowTime: timeAt(sli), swingHighTime: timeAt(shi),
        levels: computeFibLevels(Math.min(lowPrice, highPrice), Math.max(lowPrice, highPrice), originalDrawing.direction),
      });
      return;
    }

    if (originalDrawing.type === 'longPosition' || originalDrawing.type === 'shortPosition') {
      const ei = originalDrawing.entryIndex + deltaIndex;
      store.updateDrawing(originalDrawing.id, {
        entryIndex: ei, entryPrice: originalDrawing.entryPrice + deltaPrice,
        entryTime: timeAt(ei),
        stopLossPrice: originalDrawing.stopLossPrice + deltaPrice,
        takeProfitPrice: originalDrawing.takeProfitPrice + deltaPrice,
      });
      return;
    }

    if (originalDrawing.type === 'text' || originalDrawing.type === 'horizontalLine' || originalDrawing.type === 'verticalLine' || originalDrawing.type === 'anchoredVwap') {
      store.updateDrawing(originalDrawing.id, {
        index: originalDrawing.index + deltaIndex,
        price: originalDrawing.price + deltaPrice,
        time: timeAt(originalDrawing.index + deltaIndex),
      });
      return;
    }

    if (originalDrawing.type === 'pencil' || originalDrawing.type === 'highlighter') {
      store.updateDrawing(originalDrawing.id, {
        points: originalDrawing.points.map(p => {
          const ni = p.index + deltaIndex;
          return { index: ni, price: p.price + deltaPrice, time: timeAt(ni) };
        }),
      });
    }
    return;
  }

  if (handleType === 'width' && (originalDrawing.type === 'channel' || originalDrawing.type === 'pitchfork')) {
    store.updateDrawing(originalDrawing.id, { widthIndex: newIndex, widthPrice: newPrice, widthTime: newTime });
    return;
  }

  if ((handleType === 'start' || handleType === 'end') && isTwoPointDrawing(originalDrawing)) {
    const field = handleType === 'start'
      ? { startIndex: newIndex, startPrice: newPrice, startTime: newTime }
      : { endIndex: newIndex, endPrice: newPrice, endTime: newTime };
    store.updateDrawing(originalDrawing.id, field);
    return;
  }

  if (handleType === 'swingLow' && originalDrawing.type === 'fibonacci') {
    const dir = originalDrawing.swingHighPrice >= newPrice ? 'up' : 'down';
    store.updateDrawing(originalDrawing.id, {
      swingLowIndex: newIndex, swingLowPrice: newPrice, swingLowTime: newTime, direction: dir,
      levels: computeFibLevels(Math.min(newPrice, originalDrawing.swingHighPrice), Math.max(newPrice, originalDrawing.swingHighPrice), dir),
    });
    return;
  }

  if (handleType === 'swingHigh' && originalDrawing.type === 'fibonacci') {
    const dir = newPrice >= originalDrawing.swingLowPrice ? 'up' : 'down';
    store.updateDrawing(originalDrawing.id, {
      swingHighIndex: newIndex, swingHighPrice: newPrice, swingHighTime: newTime, direction: dir,
      levels: computeFibLevels(Math.min(originalDrawing.swingLowPrice, newPrice), Math.max(originalDrawing.swingLowPrice, newPrice), dir),
    });
  }

  if ((originalDrawing.type === 'longPosition' || originalDrawing.type === 'shortPosition')) {
    if (handleType === 'start') store.updateDrawing(originalDrawing.id, { entryPrice: newPrice, entryIndex: newIndex, entryTime: newTime });
    else if (handleType === 'end') store.updateDrawing(originalDrawing.id, { stopLossPrice: newPrice });
    else if (handleType === 'width') store.updateDrawing(originalDrawing.id, { takeProfitPrice: newPrice });
  }
};

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
    const roundedIdx = Math.round(idx);
    const time = roundedIdx >= 0 && roundedIdx < klines.length ? klines[roundedIdx]?.openTime : undefined;
    return { index: idx, price: result.snappedPrice, time };
  }, [manager, snap, klines]);

  /**
   * Freehand variant for pencil / highlighter — keeps the index as a
   * float so the rendered line follows the cursor smoothly instead of
   * stair-stepping on integer kline boundaries (the OHLC magnet's
   * `Math.round(rawIndex)` is bypassed entirely). Time is interpolated
   * to the nearest kline so pagination prepends still re-anchor the
   * stroke correctly.
   */
  const getFreehandIndexAndPrice = useCallback((x: number, y: number): { index: number; price: number; time?: number } => {
    if (!manager) return { index: 0, price: 0 };
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    if (!dimensions || !viewport) return { index: 0, price: 0 };
    const rawIndex = viewport.start + (x / dimensions.chartWidth) * (viewport.end - viewport.start);
    const price = manager.yToPrice(y);
    const roundedIdx = Math.round(rawIndex);
    const time = roundedIdx >= 0 && roundedIdx < klines.length ? klines[roundedIdx]?.openTime : undefined;
    return { index: rawIndex, price, time };
  }, [manager, klines]);

  const handleMouseDown = useCallback((x: number, y: number): boolean => {
    if (!manager) return false;

    const store = useDrawingStore.getState();
    const activeTool = store.activeTool;
    const selectedId = store.selectedDrawingId;

    if (!activeTool) {
      const mapper = createDrawingMapper(manager);
      const rawDrawings = store.getDrawingsForSymbol(symbol, interval);
      const drawings = rawDrawings.map(d => resolveDrawingIndices(d, klines));
      const hit = hitTestDrawings(x, y, drawings, mapper, selectedId);

      if (!hit) {
        if (selectedId) store.selectDrawing(null);
        return false;
      }

      const drawing = drawings.find(d => d.id === hit.drawingId);
      if (!drawing || drawing.locked) {
        if (hit.drawingId !== selectedId) store.selectDrawing(hit.drawingId);
        return true;
      }

      const isFibBody = drawing.type === 'fibonacci' && (hit.handleType === null || hit.handleType === 'body');

      // First click on an unselected drawing only selects it — handles become
      // visible, and the user has to mousedown again to drag. The exception
      // is when the hit landed directly on a handle (handleType !== null and
      // not 'body'): handles are only rendered after selection so this can
      // only happen on a click against an already-selected drawing, but we
      // treat it as a drag-prepared selection anyway in case selection state
      // is racing the renderer.
      const isHandleHit = hit.handleType !== null && hit.handleType !== 'body' && !isFibBody;
      if (hit.drawingId !== selectedId) {
        store.selectDrawing(hit.drawingId);
        if (!isHandleHit) return true;
      }

      if (isFibBody) return true;

      const rawDrawing = rawDrawings.find(d => d.id === hit.drawingId);
      if (!rawDrawing) return true;

      phaseRef.current = 'dragging';
      dragStartRef.current = { x, y, handleType: hit.handleType, originalDrawing: { ...rawDrawing } };
      return true;
    }

    const { index, price, time } = getIndexAndPrice(x, y);

    if (activeTool === 'pencil' || activeTool === 'highlighter') {
      const fh = getFreehandIndexAndPrice(x, y);
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        points: [{ index: fh.index, price: fh.price, time: fh.time }],
      };
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'drawing-freeform';
      return true;
    }

    if (activeTool === 'text') {
      const drawing: Drawing = {
        id: generateId(), type: 'text', symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        index, price, time,
        text: '', fontSize: DEFAULT_FONT_SIZE, fontWeight: 'normal', textDecoration: 'none', color: INDICATOR_COLORS.LABEL_TEXT,
      };
      store.addDrawing(drawing);
      store.selectDrawing(drawing.id);
      manager?.markDirty('overlays');
      return true;
    }

    if (activeTool === 'horizontalLine' || activeTool === 'verticalLine' || activeTool === 'anchoredVwap') {
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        index, price, time,
      };
      store.addDrawing(drawing);
      store.selectDrawing(drawing.id);
      manager?.markDirty('overlays');
      return true;
    }

    if (activeTool === 'rectangle' || activeTool === 'area') {
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        startIndex: index, startPrice: price, endIndex: index, endPrice: price,
        startTime: time, endTime: time,
      };
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'placing-second';
      return true;
    }

    if (activeTool === 'longPosition' || activeTool === 'shortPosition') {
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        entryIndex: index, entryPrice: price, entryTime: time,
        stopLossPrice: price, takeProfitPrice: price,
      };
      pendingDrawingRef.current = drawing;
      phaseRef.current = 'placing-second';
      return true;
    }

    if (activeTool === 'channel' || activeTool === 'pitchfork') {
      if (phaseRef.current === 'placing-third' && pendingDrawingRef.current && (pendingDrawingRef.current.type === 'channel' || pendingDrawingRef.current.type === 'pitchfork')) {
        const finalDrawing: Drawing = { ...pendingDrawingRef.current, widthIndex: index, widthPrice: price, widthTime: time };
        store.addDrawing(finalDrawing);
        store.selectDrawing(finalDrawing.id);
        pendingDrawingRef.current = null;
        phaseRef.current = 'idle';
        manager?.markDirty('overlays');
        return true;
      }
      const drawing: Drawing = {
        id: generateId(), type: activeTool, symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        startIndex: index, startPrice: price, endIndex: index, endPrice: price,
        startTime: time, endTime: time, widthIndex: index, widthPrice: price, widthTime: time,
      };
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
        id: generateId(), type: drawingType as 'line' | 'ruler' | 'arrow' | 'ray' | 'trendLine' | 'priceRange' | 'ellipse' | 'gannFan', symbol, interval, visible: true, locked: false, zIndex: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
        startIndex: index, startPrice: price, endIndex: index, endPrice: price,
        startTime: time, endTime: time,
      };
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

    if (phase === 'placing-third' && pending && (pending.type === 'channel' || pending.type === 'pitchfork')) {
      const { index, price, time } = getIndexAndPrice(x, y);
      pendingDrawingRef.current = { ...pending, widthIndex: index, widthPrice: price, widthTime: time };
      manager.markDirty('overlays');
      return true;
    }

    if (phase === 'placing-second' && pending) {
      const { index, price, time } = getIndexAndPrice(x, y);
      if (pending.type === 'longPosition' || pending.type === 'shortPosition') {
        const risk = Math.abs(pending.entryPrice - price);
        const isLong = pending.type === 'longPosition';
        const tp = isLong ? pending.entryPrice + risk : pending.entryPrice - risk;
        pendingDrawingRef.current = { ...pending, stopLossPrice: price, takeProfitPrice: tp };
      } else if (pending.type === 'fibonacci') {
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
      } else if (isTwoPointDrawing(pending)) {
        pendingDrawingRef.current = { ...pending, endIndex: index, endPrice: price, endTime: time };
      }
      manager.markDirty('overlays');
      return true;
    }

    if (phase === 'drawing-freeform' && pending && (pending.type === 'pencil' || pending.type === 'highlighter')) {
      const lastPt = pending.points[pending.points.length - 1];
      if (lastPt) {
        const lx = manager.indexToCenterX(lastPt.index);
        const ly = manager.priceToY(lastPt.price);
        const dx = x - lx;
        const dy = y - ly;
        if (dx * dx + dy * dy < 9) return true;
      }
      const { index, price, time } = getFreehandIndexAndPrice(x, y);
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
        const rounded = Math.round(idx);
        if (rounded < 0 || rounded >= klines.length) return undefined;
        return klines[rounded]?.openTime;
      };

      applyDragUpdate(store, originalDrawing, handleType, deltaIndex, deltaPrice, newIndex, newPrice, newTime, timeAt);

      manager.markDirty('overlays');
      return true;
    }

    if (!useDrawingStore.getState().activeTool) {
      const mapper = createDrawingMapper(manager);
      const rawDrawings = useDrawingStore.getState().getDrawingsForSymbol(symbol, interval);
      const resolvedDrawings = rawDrawings.map(d => resolveDrawingIndices(d, klines));
      const selectedId = useDrawingStore.getState().selectedDrawingId;
      const hit = hitTestDrawings(x, y, resolvedDrawings, mapper, selectedId);
      return hit !== null;
    }

    return false;
  }, [manager, symbol, interval, getIndexAndPrice]);

  const handleMouseUp = useCallback((x: number, y: number): boolean => {
    const phase = phaseRef.current;

    if (phase === 'placing-second' && pendingDrawingRef.current && (pendingDrawingRef.current.type === 'channel' || pendingDrawingRef.current.type === 'pitchfork')) {
      const { index, price, time } = getIndexAndPrice(x, y);
      const drawing = pendingDrawingRef.current;
      if (drawing.startIndex === index && drawing.startPrice === price) {
        useDrawingStore.getState().setActiveTool(null);
        pendingDrawingRef.current = null;
        phaseRef.current = 'idle';
        manager?.markDirty('overlays');
        return true;
      }
      pendingDrawingRef.current = { ...drawing, endIndex: index, endPrice: price, endTime: time };
      phaseRef.current = 'placing-third';
      return true;
    }

    if (phase === 'placing-second' && pendingDrawingRef.current && (pendingDrawingRef.current.type === 'longPosition' || pendingDrawingRef.current.type === 'shortPosition')) {
      const { price } = getIndexAndPrice(x, y);
      const drawing = pendingDrawingRef.current;
      const store = useDrawingStore.getState();

      if (drawing.entryPrice === price) {
        store.setActiveTool(null);
        pendingDrawingRef.current = null;
        phaseRef.current = 'idle';
        manager?.markDirty('overlays');
        return true;
      }

      const risk = Math.abs(drawing.entryPrice - price);
      const isLong = drawing.type === 'longPosition';
      const tp = isLong ? drawing.entryPrice + risk : drawing.entryPrice - risk;
      const finalDrawing = { ...drawing, stopLossPrice: price, takeProfitPrice: tp } as Drawing;

      store.addDrawing(finalDrawing);
      store.selectDrawing(finalDrawing.id);
      pendingDrawingRef.current = null;
      phaseRef.current = 'idle';
      manager?.markDirty('overlays');
      return true;
    }

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
      } else if (isTwoPointDrawing(drawing)) {
        drawing = { ...drawing, endIndex: index, endPrice: price };
      }

      // A click without drag (start === end on both axes) leaves a degenerate
      // drawing on the chart that's effectively invisible but still selectable
      // — confusing for users. Cancel placement when start === end across
      // every 2-point type, plus the fibonacci-specific case where both
      // swings collapse to the same price.
      const isZeroLength =
        (drawing.type === 'fibonacci' && drawing.swingLowPrice === drawing.swingHighPrice && drawing.swingLowIndex === drawing.swingHighIndex) ||
        ((drawing.type === 'rectangle' || drawing.type === 'area') && (drawing.startIndex === drawing.endIndex || drawing.startPrice === drawing.endPrice)) ||
        (isTwoPointDrawing(drawing) && drawing.startIndex === drawing.endIndex && drawing.startPrice === drawing.endPrice);

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

  const cancelInteraction = useCallback((options: CancelInteractionOptions = {}): boolean => {
    const phase = phaseRef.current;
    if (phase === 'idle') return false;

    if (phase === 'dragging') {
      // Default behaviour (mouseleave / window mouseup safety net): leave
      // the drawing where it landed and just release the drag state.
      // ESC behaviour (revert=true): restore the drawing to the snapshot
      // captured when the drag started — same UX as cancelling an order
      // drag with ESC.
      if (options.revert && dragStartRef.current) {
        const { originalDrawing } = dragStartRef.current;
        useDrawingStore.getState().updateDrawing(originalDrawing.id, originalDrawing);
      }
      dragStartRef.current = null;
      phaseRef.current = 'idle';
      manager?.markDirty('overlays');
      return true;
    }

    // Placement in progress: discard the pending drawing entirely. A
    // mid-placement abandon (mouse left the canvas, modifier-cancel, etc.)
    // shouldn't litter the chart with half-built drawings.
    pendingDrawingRef.current = null;
    phaseRef.current = 'idle';
    manager?.markDirty('overlays');
    return true;
  }, [manager]);

  const isDrawing = useCallback((): boolean => phaseRef.current !== 'idle', []);

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

    // Drawing-handle magnet pass — when the cursor is near another
    // drawing's anchor (corner / endpoint / fib swing / position
    // entry-SL-TP), prefer that snap target over OHLC. The user
    // wants to snap to an existing drawing's anchor more often than
    // to a candle vertex when both are nearby; the explicit anchor
    // is what the user placed deliberately. Same visual indicator as
    // OHLC snap, just no letter label.
    if (useDrawingStore.getState().magnetEnabled) {
      const store = useDrawingStore.getState();
      const drawings = store.drawingsByKey[compositeKey(symbol, interval)] ?? [];
      const mapper = createDrawingMapper(manager);
      const draggingId = dragStartRef.current?.originalDrawing.id;
      let bestDist = DRAWING_HANDLE_SNAP_PIXEL_THRESHOLD;
      let bestPoint: { x: number; y: number } | null = null;
      for (const drawing of drawings) {
        if (!drawing.visible) continue;
        // Don't snap to the drawing being dragged — would pin it to
        // its own current handle position.
        if (drawing.id === draggingId) continue;
        const resolved = resolveDrawingIndices(drawing, klines);
        const points = getHandlePoints(resolved, mapper);
        for (const pt of points) {
          const dx = x - pt.x;
          const dy = y - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestPoint = pt;
          }
        }
      }
      if (bestPoint) {
        lastSnapRef.current = { x: bestPoint.x, y: bestPoint.y, ohlcType: 'handle' };
        return { x: bestPoint.x, y: bestPoint.y, snapped: true };
      }
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
  }, [manager, snap, symbol, interval]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancelInteraction,
    isDrawing,
    getCursor,
    pendingDrawingRef,
    lastSnapRef,
    snapToOHLC,
  };
};
