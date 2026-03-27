import type { CoordinateMapper, Drawing, LineDrawing, RulerDrawing, RectangleDrawing, AreaDrawing, PencilDrawing, FibonacciDrawing, ArrowDrawing, TextDrawing, RayDrawing, HorizontalLineDrawing, ChannelDrawing, TrendLineDrawing, PriceRangeDrawing, VerticalLineDrawing, AnchoredVwapDrawing, HighlighterDrawing, EllipseDrawing, PitchforkDrawing, GannFanDrawing } from '@marketmind/chart-studies';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { Kline } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore } from '@renderer/store/drawingStore';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { renderLine } from './renderers/renderLine';
import { renderRectangle } from './renderers/renderRectangle';
import { renderPencil } from './renderers/renderPencil';
import { renderRuler } from './renderers/renderRuler';
import { renderArea } from './renderers/renderArea';
import { renderFibonacci } from './renderers/renderFibonacci';
import { renderArrow } from './renderers/renderArrow';
import { renderRay } from './renderers/renderRay';
import { renderHorizontalLine } from './renderers/renderHorizontalLine';
import { renderChannel } from './renderers/renderChannel';
import { renderTrendLine } from './renderers/renderTrendLine';
import { renderPriceRange } from './renderers/renderPriceRange';
import { renderVerticalLine } from './renderers/renderVerticalLine';
import { renderAnchoredVwap } from './renderers/renderAnchoredVwap';
import { renderHighlighter } from './renderers/renderHighlighter';
import { renderEllipse } from './renderers/renderEllipse';
import { renderPitchfork } from './renderers/renderPitchfork';
import { renderGannFan } from './renderers/renderGannFan';
import { renderText } from './renderers/renderText';
import { renderDrawingHandles } from './drawingHandles';
import type { OHLCSnapIndicator } from './useDrawingInteraction';

const SNAP_INDICATOR_RADIUS = 4;
const SNAP_INDICATOR_COLOR = 'rgba(59, 130, 246, 0.6)';
const SNAP_LABEL_FONT = '10px sans-serif';
const SNAP_LABEL_COLOR = 'rgba(59, 130, 246, 0.9)';
const SNAP_LABEL_OFFSET_X = 8;
const SNAP_LABEL_OFFSET_Y = -8;

const OHLC_LABELS: Record<OHLCSnapIndicator['ohlcType'], string> = {
  open: 'O',
  high: 'H',
  low: 'L',
  close: 'C',
};

interface UseDrawingsRendererProps {
  manager: CanvasManager | null;
  symbol: string;
  interval: string;
  klines: Kline[];
  colors: {
    bullish: string;
    bearish: string;
    crosshair: string;
  };
  themeColors: ChartThemeColors;
  pendingDrawingRef: React.MutableRefObject<Drawing | null>;
  lastSnapRef: React.MutableRefObject<OHLCSnapIndicator | null>;
}

const resolveDrawingIndices = (drawing: Drawing, klines: Kline[]): Drawing => {
  if (klines.length === 0) return drawing;

  const timeToIdx = (time: number | undefined, fallbackIdx: number): number => {
    if (time === undefined) return fallbackIdx;
    let lo = 0;
    let hi = klines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const mt = klines[mid]?.openTime ?? 0;
      if (mt < time) lo = mid + 1;
      else if (mt > time) hi = mid - 1;
      else return mid;
    }
    return Math.max(0, lo);
  };

  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
    case 'arrow':
    case 'ray':
    case 'trendLine':
    case 'priceRange':
    case 'ellipse':
    case 'gannFan': {
      const d = drawing as LineDrawing | RulerDrawing | RectangleDrawing | AreaDrawing | ArrowDrawing | RayDrawing | TrendLineDrawing | PriceRangeDrawing | EllipseDrawing | GannFanDrawing;
      if (!d.startTime && !d.endTime) return drawing;
      return { ...d, startIndex: timeToIdx(d.startTime, d.startIndex), endIndex: timeToIdx(d.endTime, d.endIndex) };
    }
    case 'channel':
    case 'pitchfork': {
      const d = drawing as ChannelDrawing | PitchforkDrawing;
      if (!d.startTime && !d.endTime && !d.widthTime) return drawing;
      return { ...d, startIndex: timeToIdx(d.startTime, d.startIndex), endIndex: timeToIdx(d.endTime, d.endIndex), widthIndex: timeToIdx(d.widthTime, d.widthIndex) };
    }
    case 'pencil':
    case 'highlighter': {
      const d = drawing as PencilDrawing | HighlighterDrawing;
      if (!d.points.some(p => p.time !== undefined)) return drawing;
      return { ...d, points: d.points.map(p => ({ ...p, index: timeToIdx(p.time, p.index) })) };
    }
    case 'fibonacci': {
      const d = drawing as FibonacciDrawing;
      if (!d.swingLowTime && !d.swingHighTime) return drawing;
      return { ...d, swingLowIndex: timeToIdx(d.swingLowTime, d.swingLowIndex), swingHighIndex: timeToIdx(d.swingHighTime, d.swingHighIndex) };
    }
    case 'text': {
      const d = drawing as TextDrawing;
      if (!d.time) return drawing;
      return { ...d, index: timeToIdx(d.time, d.index) };
    }
    case 'horizontalLine':
    case 'verticalLine':
    case 'anchoredVwap': {
      const d = drawing as HorizontalLineDrawing | VerticalLineDrawing | AnchoredVwapDrawing;
      if (!d.time) return drawing;
      return { ...d, index: timeToIdx(d.time, d.index) };
    }
  }
};

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

const renderSingleDrawing = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartHeight: number,
  chartWidth: number,
  colors: { bullish: string; bearish: string; crosshair: string },
  themeColors: ChartThemeColors,
  klines: Kline[],
): void => {
  if (!drawing.visible) return;

  switch (drawing.type) {
    case 'line':
      renderLine(ctx, drawing, mapper, isSelected);
      break;
    case 'rectangle':
      renderRectangle(ctx, drawing, mapper, isSelected);
      break;
    case 'pencil':
      renderPencil(ctx, drawing, mapper, isSelected);
      break;
    case 'ruler':
      renderRuler(ctx, drawing, mapper, isSelected, colors, themeColors);
      break;
    case 'area':
      renderArea(ctx, drawing, mapper, isSelected, colors, themeColors);
      break;
    case 'fibonacci':
      renderFibonacci(ctx, drawing, mapper, isSelected, chartHeight, chartWidth, themeColors);
      break;
    case 'arrow':
      renderArrow(ctx, drawing, mapper, isSelected);
      break;
    case 'ray':
      renderRay(ctx, drawing, mapper, isSelected, chartWidth, chartHeight);
      break;
    case 'text':
      renderText(ctx, drawing, mapper, isSelected);
      break;
    case 'horizontalLine':
      renderHorizontalLine(ctx, drawing, mapper, isSelected, chartWidth);
      break;
    case 'channel':
      renderChannel(ctx, drawing, mapper, isSelected, chartWidth, chartHeight);
      break;
    case 'trendLine':
      renderTrendLine(ctx, drawing, mapper, isSelected, chartWidth, chartHeight);
      break;
    case 'priceRange':
      renderPriceRange(ctx, drawing, mapper, isSelected);
      break;
    case 'verticalLine':
      renderVerticalLine(ctx, drawing, mapper, isSelected, chartHeight);
      break;
    case 'anchoredVwap':
      renderAnchoredVwap(ctx, drawing, mapper, isSelected, klines);
      break;
    case 'highlighter':
      renderHighlighter(ctx, drawing, mapper, isSelected);
      break;
    case 'ellipse':
      renderEllipse(ctx, drawing, mapper, isSelected);
      break;
    case 'pitchfork':
      renderPitchfork(ctx, drawing, mapper, isSelected, chartWidth, chartHeight);
      break;
    case 'gannFan':
      renderGannFan(ctx, drawing, mapper, isSelected, chartWidth, chartHeight);
      break;
  }

  if (isSelected) {
    renderDrawingHandles(ctx, drawing, mapper);
  }
};

const renderSnapIndicator = (ctx: CanvasRenderingContext2D, snap: OHLCSnapIndicator, themeColors?: ChartThemeColors): void => {
  ctx.save();

  ctx.beginPath();
  ctx.arc(snap.x, snap.y, SNAP_INDICATOR_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = themeColors?.drawing?.snapIndicator ?? SNAP_INDICATOR_COLOR;
  ctx.fill();

  ctx.font = SNAP_LABEL_FONT;
  ctx.fillStyle = themeColors?.drawing?.snapLabel ?? SNAP_LABEL_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(OHLC_LABELS[snap.ohlcType], snap.x + SNAP_LABEL_OFFSET_X, snap.y + SNAP_LABEL_OFFSET_Y);

  ctx.restore();
};

export const useDrawingsRenderer = ({
  manager,
  symbol,
  interval,
  klines,
  colors,
  themeColors,
  pendingDrawingRef,
  lastSnapRef,
}: UseDrawingsRendererProps): { render: () => void } => {
  const klinesRef = useRef(klines);
  klinesRef.current = klines;
  const drawingIndexCache = useRef(new Map<string, Drawing>());
  const lastKlinesLengthRef = useRef(0);
  const lastFirstKlineTimeRef = useRef(0);
  useEffect(() => {
    if (!manager || !symbol) return;
    const key = `${symbol}:${interval}`;
    const unsubscribe = useDrawingStore.subscribe((state, prevState) => {
      const curr = state.drawingsByKey[key];
      const prev = prevState.drawingsByKey[key];
      if (curr !== prev) manager.markDirty('overlays');
    });
    return unsubscribe;
  }, [manager, symbol, interval]);

  const render = useCallback((): void => {
    if (!manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const store = useDrawingStore.getState();
    const rawDrawings = store.getDrawingsForSymbol(symbol, interval);
    const pendingDrawing = pendingDrawingRef.current;
    const snapIndicator = lastSnapRef.current;

    if (rawDrawings.length === 0 && !pendingDrawing && !snapIndicator) return;

    const currentKlines = klinesRef.current;
    const selectedId = store.selectedDrawingId;
    const mapper = createMapper(manager);
    const viewport = manager.getViewport();

    const sorted = [...rawDrawings].sort((a, b) => a.zIndex - b.zIndex);

    const firstTime = currentKlines[0]?.openTime ?? 0;
    if (currentKlines.length !== lastKlinesLengthRef.current || firstTime !== lastFirstKlineTimeRef.current) {
      drawingIndexCache.current.clear();
      lastKlinesLengthRef.current = currentKlines.length;
      lastFirstKlineTimeRef.current = firstTime;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dimensions.chartWidth, dimensions.chartHeight);
    ctx.clip();

    for (const raw of sorted) {
      const cacheKey = `${raw.id}-${raw.updatedAt}`;
      let drawing = drawingIndexCache.current.get(cacheKey);
      if (!drawing) {
        drawing = resolveDrawingIndices(raw, currentKlines);
        drawingIndexCache.current.set(cacheKey, drawing);
      }
      if (!isDrawingInViewport(drawing, viewport.start, viewport.end)) continue;
      renderSingleDrawing(ctx, drawing, mapper, drawing.id === selectedId, dimensions.chartHeight, dimensions.chartWidth, colors, themeColors, currentKlines);
    }

    if (pendingDrawing) {
      renderSingleDrawing(ctx, pendingDrawing, mapper, false, dimensions.chartHeight, dimensions.chartWidth, colors, themeColors, currentKlines);
    }

    ctx.restore();

    if (snapIndicator) {
      renderSnapIndicator(ctx, snapIndicator, themeColors);
    }
  }, [manager, symbol, colors, themeColors, pendingDrawingRef, lastSnapRef]);

  return { render };
};

const isDrawingInViewport = (drawing: Drawing, viewStart: number, viewEnd: number): boolean => {
  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
    case 'arrow':
    case 'priceRange':
    case 'ellipse': {
      const minIdx = Math.min(drawing.startIndex, drawing.endIndex);
      const maxIdx = Math.max(drawing.startIndex, drawing.endIndex);
      return maxIdx >= viewStart && minIdx <= viewEnd;
    }
    case 'ray':
    case 'channel':
    case 'pitchfork':
    case 'anchoredVwap': {
      const idx = 'startIndex' in drawing ? Math.min(drawing.startIndex, drawing.endIndex) : drawing.index;
      return idx <= viewEnd;
    }
    case 'trendLine':
    case 'gannFan':
    case 'horizontalLine':
      return true;
    case 'fibonacci': {
      const minIdx = Math.min(drawing.swingLowIndex, drawing.swingHighIndex);
      return minIdx <= viewEnd;
    }
    case 'pencil':
    case 'highlighter': {
      if (drawing.points.length === 0) return false;
      const indices = drawing.points.map(p => p.index);
      const minIdx = Math.min(...indices);
      const maxIdx = Math.max(...indices);
      return maxIdx >= viewStart && minIdx <= viewEnd;
    }
    case 'text':
    case 'verticalLine':
      return drawing.index >= viewStart && drawing.index <= viewEnd;
  }
};
