import type { HorizontalLineDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';
import { applyDrawingStyle } from '@renderer/utils/canvas/canvasHelpers';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { LINE_DASHES } from '@shared/constants';

const PRICE_TAG_WIDTH = 64;

const formatPriceForTag = (price: number): string => {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
};

export const renderHorizontalLine = (
  ctx: CanvasRenderingContext2D,
  drawing: HorizontalLineDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
): void => {
  const y = mapper.priceToY(drawing.price);
  const gripX = mapper.indexToCenterX(drawing.index);

  ctx.save();
  applyDrawingStyle(ctx, drawing, isSelected, DRAWING_COLORS.horizontalLine);
  ctx.setLineDash([...LINE_DASHES.STANDARD]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (isSelected) {
    ctx.fillStyle = DRAWING_COLORS.handle;
    ctx.strokeStyle = DRAWING_COLORS.handleStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gripX, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Renders the price-axis tag for a horizontal-line drawing. Kept
 * separate from `renderHorizontalLine` because the drawings layer
 * runs inside `ctx.clip(0, 0, chartWidth, chartHeight)` to keep
 * line-strokes from bleeding past the chart bounds — but the price
 * tag's natural position is *over* the price scale (x ≥ chartWidth),
 * which would get clipped. The caller renders this AFTER the
 * `ctx.restore()` that closes the clip pass, identical to how the
 * live-current-price tag is drawn.
 */
export const renderHorizontalLineTag = (
  ctx: CanvasRenderingContext2D,
  drawing: HorizontalLineDrawing,
  mapper: CoordinateMapper,
  chartWidth: number,
  chartHeight: number,
): void => {
  const y = mapper.priceToY(drawing.price);
  if (y < 0 || y > chartHeight) return;

  const tagFill = drawing.color ?? DRAWING_COLORS.horizontalLine;
  drawPriceTag(ctx, formatPriceForTag(drawing.price), y, chartWidth, tagFill, PRICE_TAG_WIDTH);
};
