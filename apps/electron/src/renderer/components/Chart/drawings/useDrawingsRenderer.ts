import type { CoordinateMapper, Drawing } from '@marketmind/chart-studies';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore } from '@renderer/store/drawingStore';
import type React from 'react';
import { useCallback } from 'react';
import { renderLine } from './renderers/renderLine';
import { renderRectangle } from './renderers/renderRectangle';
import { renderPencil } from './renderers/renderPencil';
import { renderRuler } from './renderers/renderRuler';
import { renderArea } from './renderers/renderArea';
import { renderFibonacci } from './renderers/renderFibonacci';
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
  colors: {
    bullish: string;
    bearish: string;
    crosshair: string;
  };
  themeColors: ChartThemeColors;
  pendingDrawingRef: React.MutableRefObject<Drawing | null>;
  lastSnapRef: React.MutableRefObject<OHLCSnapIndicator | null>;
}

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
      renderRuler(ctx, drawing, mapper, isSelected, colors);
      break;
    case 'area':
      renderArea(ctx, drawing, mapper, isSelected, colors);
      break;
    case 'fibonacci':
      renderFibonacci(ctx, drawing, mapper, isSelected, chartHeight, chartWidth, themeColors);
      break;
  }

  if (isSelected) {
    renderDrawingHandles(ctx, drawing, mapper);
  }
};

const renderSnapIndicator = (ctx: CanvasRenderingContext2D, snap: OHLCSnapIndicator): void => {
  ctx.save();

  ctx.beginPath();
  ctx.arc(snap.x, snap.y, SNAP_INDICATOR_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = SNAP_INDICATOR_COLOR;
  ctx.fill();

  ctx.font = SNAP_LABEL_FONT;
  ctx.fillStyle = SNAP_LABEL_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(OHLC_LABELS[snap.ohlcType], snap.x + SNAP_LABEL_OFFSET_X, snap.y + SNAP_LABEL_OFFSET_Y);

  ctx.restore();
};

export const useDrawingsRenderer = ({
  manager,
  symbol,
  colors,
  themeColors,
  pendingDrawingRef,
  lastSnapRef,
}: UseDrawingsRendererProps): { render: () => void } => {
  const render = useCallback((): void => {
    if (!manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const store = useDrawingStore.getState();
    const drawings = store.getDrawingsForSymbol(symbol);
    const pendingDrawing = pendingDrawingRef.current;
    const snapIndicator = lastSnapRef.current;

    if (drawings.length === 0 && !pendingDrawing && !snapIndicator) return;

    const selectedId = store.selectedDrawingId;
    const mapper = createMapper(manager);
    const viewport = manager.getViewport();

    const sorted = [...drawings].sort((a, b) => a.zIndex - b.zIndex);

    for (const drawing of sorted) {
      if (!isDrawingInViewport(drawing, viewport.start, viewport.end)) continue;
      renderSingleDrawing(ctx, drawing, mapper, drawing.id === selectedId, dimensions.chartHeight, dimensions.chartWidth, colors, themeColors);
    }

    if (pendingDrawing) {
      renderSingleDrawing(ctx, pendingDrawing, mapper, false, dimensions.chartHeight, dimensions.chartWidth, colors, themeColors);
    }

    if (snapIndicator) {
      renderSnapIndicator(ctx, snapIndicator);
    }
  }, [manager, symbol, colors, themeColors, pendingDrawingRef, lastSnapRef]);

  return { render };
};

const isDrawingInViewport = (drawing: Drawing, viewStart: number, viewEnd: number): boolean => {
  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area': {
      const minIdx = Math.min(drawing.startIndex, drawing.endIndex);
      const maxIdx = Math.max(drawing.startIndex, drawing.endIndex);
      return maxIdx >= viewStart && minIdx <= viewEnd;
    }
    case 'fibonacci': {
      const minIdx = Math.min(drawing.swingLowIndex, drawing.swingHighIndex);
      return minIdx <= viewEnd;
    }
    case 'pencil': {
      if (drawing.points.length === 0) return false;
      const indices = drawing.points.map(p => p.index);
      const minIdx = Math.min(...indices);
      const maxIdx = Math.max(...indices);
      return maxIdx >= viewStart && minIdx <= viewEnd;
    }
  }
};
