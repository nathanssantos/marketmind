import type { HighlighterDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import { resolveDrawingIndex } from '@renderer/utils/canvas/canvasHelpers';

export const renderHighlighter = (
  ctx: CanvasRenderingContext2D,
  drawing: HighlighterDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  if (drawing.points.length < 2) return;

  const baseWidth = (drawing.lineWidth ?? DEFAULT_LINE_WIDTH) * 6;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.highlighter);
  ctx.lineWidth = isSelected ? baseWidth + 2 : baseWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const xAt = (p: { index: number; time?: number }) =>
    mapper.indexToCenterX(resolveDrawingIndex(p.index, p.time, mapper));

  const first = drawing.points[0]!;
  const x0 = xAt(first);
  const y0 = mapper.priceToY(first.price);
  ctx.moveTo(x0, y0);

  for (let i = 1; i < drawing.points.length - 1; i++) {
    const cur = drawing.points[i]!;
    const next = drawing.points[i + 1]!;
    const cx = xAt(cur);
    const cy = mapper.priceToY(cur.price);
    const nx = xAt(next);
    const ny = mapper.priceToY(next.price);
    ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }

  const last = drawing.points[drawing.points.length - 1]!;
  ctx.lineTo(xAt(last), mapper.priceToY(last.price));

  ctx.stroke();
  ctx.restore();
};
