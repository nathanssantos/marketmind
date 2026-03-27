import type { Drawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import type { CanvasManager } from './CanvasManager';
import { CANVAS_EDGE_PADDING, SELECTION_WIDTH_BOOST } from '@shared/constants';

export const extendLineToEdges = (
  sx: number, sy: number, ex: number, ey: number,
  chartWidth: number, chartHeight: number,
): [number, number, number, number] => {
  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) return [sx, sy, ex, ey];
  if (dx === 0) return [sx, -CANVAS_EDGE_PADDING, ex, chartHeight + CANVAS_EDGE_PADDING];

  const slope = dy / dx;
  let lx = -CANVAS_EDGE_PADDING;
  let ly = sy + slope * (lx - sx);
  let rx = chartWidth + CANVAS_EDGE_PADDING;
  let ry = sy + slope * (rx - sx);

  if (ly < -CANVAS_EDGE_PADDING) {
    ly = -CANVAS_EDGE_PADDING;
    lx = sx + (-CANVAS_EDGE_PADDING - sy) / slope;
  } else if (ly > chartHeight + CANVAS_EDGE_PADDING) {
    ly = chartHeight + CANVAS_EDGE_PADDING;
    lx = sx + (chartHeight + CANVAS_EDGE_PADDING - sy) / slope;
  }
  if (ry < -CANVAS_EDGE_PADDING) {
    ry = -CANVAS_EDGE_PADDING;
    rx = sx + (-CANVAS_EDGE_PADDING - sy) / slope;
  } else if (ry > chartHeight + CANVAS_EDGE_PADDING) {
    ry = chartHeight + CANVAS_EDGE_PADDING;
    rx = sx + (chartHeight + CANVAS_EDGE_PADDING - sy) / slope;
  }

  return [lx, ly, rx, ry];
};

export const hexToRgba = (hex: string, alpha: number): string => {
  if (hex.startsWith('#') && hex.length >= 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
};

export const applyDrawingStyle = (
  ctx: CanvasRenderingContext2D,
  drawing: Pick<Drawing, 'color' | 'lineWidth'>,
  isSelected: boolean,
  defaultColor: string,
): number => {
  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? defaultColor);
  ctx.lineWidth = isSelected ? baseWidth + SELECTION_WIDTH_BOOST : baseWidth;
  return baseWidth;
};

export interface TwoPointCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const mapTwoPointCoords = (
  drawing: { startIndex: number; startPrice: number; endIndex: number; endPrice: number },
  mapper: CoordinateMapper,
): TwoPointCoords => ({
  x1: mapper.indexToCenterX(drawing.startIndex),
  y1: mapper.priceToY(drawing.startPrice),
  x2: mapper.indexToCenterX(drawing.endIndex),
  y2: mapper.priceToY(drawing.endPrice),
});

export const createDrawingMapper = (manager: CanvasManager): CoordinateMapper => ({
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
