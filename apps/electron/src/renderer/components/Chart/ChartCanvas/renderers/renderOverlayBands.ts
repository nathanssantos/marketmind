import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import type { GenericRenderer, IndicatorValueSeries } from './types';
import { getInstanceParam } from './types';

const UPPER_KEYS = ['upper', 'top', 'high'];
const MIDDLE_KEYS = ['middle', 'basis', 'mid'];
const LOWER_KEYS = ['lower', 'bottom', 'low'];

const pickSeries = (values: Record<string, IndicatorValueSeries>, candidates: string[]): IndicatorValueSeries | null => {
  for (const key of candidates) {
    if (values[key]) return values[key]!;
  }
  return null;
};

interface Pt { x: number; y: number }

const drawPolyline = (ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lineWidth: number, dashed = false) => {
  if (pts.length < 1) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
};

export const renderOverlayBands: GenericRenderer = (ctx, input) => {
  const { manager } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const upperSeries = pickSeries(input.values, UPPER_KEYS);
  const middleSeries = pickSeries(input.values, MIDDLE_KEYS);
  const lowerSeries = pickSeries(input.values, LOWER_KEYS);
  if (!upperSeries || !lowerSeries) return;

  const { chartWidth, chartHeight } = dimensions;
  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  const baseColor = getInstanceParam<string>(input.instance, input.definition, 'color') ?? INDICATOR_COLORS.BOLLINGER_MIDDLE;
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? INDICATOR_LINE_WIDTHS.OVERLAY) as number;

  const upperPts: Pt[] = [];
  const middlePts: Pt[] = [];
  const lowerPts: Pt[] = [];

  for (let i = visibleStart; i < visibleEnd; i++) {
    const upper = upperSeries[i];
    const lower = lowerSeries[i];
    if (upper == null || lower == null) continue;
    const x = manager.indexToCenterX(i);
    upperPts.push({ x, y: manager.priceToY(upper) });
    lowerPts.push({ x, y: manager.priceToY(lower) });
    if (middleSeries) {
      const middle = middleSeries[i];
      if (middle != null) middlePts.push({ x, y: manager.priceToY(middle) });
    }
  }

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  if (upperPts.length > 1 && lowerPts.length > 1) {
    canvasCtx.fillStyle = INDICATOR_COLORS.BOLLINGER_FILL;
    canvasCtx.beginPath();
    canvasCtx.moveTo(upperPts[0]!.x, upperPts[0]!.y);
    for (let i = 1; i < upperPts.length; i++) canvasCtx.lineTo(upperPts[i]!.x, upperPts[i]!.y);
    for (let i = lowerPts.length - 1; i >= 0; i--) canvasCtx.lineTo(lowerPts[i]!.x, lowerPts[i]!.y);
    canvasCtx.closePath();
    canvasCtx.fill();
  }

  drawPolyline(canvasCtx, upperPts, baseColor, lineWidth);
  drawPolyline(canvasCtx, lowerPts, baseColor, lineWidth);
  if (middlePts.length > 0) {
    drawPolyline(canvasCtx, middlePts, baseColor, INDICATOR_LINE_WIDTHS.OVERLAY_MIDDLE, true);
  }

  canvasCtx.restore();
};
