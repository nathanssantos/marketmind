import type { GannFanDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH, GANN_ANGLES } from '@marketmind/chart-studies';

const GANN_LABEL_FONT = '10px sans-serif';
const GANN_LABEL_OFFSET = 4;

export const renderGannFan = (
  ctx: CanvasRenderingContext2D,
  drawing: GannFanDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  chartHeight: number,
): void => {
  const ox = mapper.indexToCenterX(drawing.startIndex);
  const oy = mapper.priceToY(drawing.startPrice);
  const rx = mapper.indexToCenterX(drawing.endIndex);
  const ry = mapper.priceToY(drawing.endPrice);

  const refDx = rx - ox;
  const refDy = ry - oy;
  if (refDx === 0 && refDy === 0) return;

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  const color = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.gannFan);

  ctx.save();

  for (const angle of GANN_ANGLES) {
    const targetX = ox + refDx;
    const targetY = oy + refDy * angle.slope;

    const dx = targetX - ox;
    const dy = targetY - oy;

    let endX: number;
    let endY: number;
    if (dx === 0) {
      endX = ox;
      endY = dy > 0 ? chartHeight + 10 : -10;
    } else {
      const slope = dy / dx;
      if (dx > 0) {
        endX = chartWidth + 10;
        endY = oy + slope * (endX - ox);
      } else {
        endX = -10;
        endY = oy + slope * (endX - ox);
      }
    }

    const is1x1 = angle.slope === 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = is1x1 ? (isSelected ? baseWidth + 1 : baseWidth) : (isSelected ? baseWidth : baseWidth * 0.6);
    ctx.globalAlpha = is1x1 ? 1 : 0.6;

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.globalAlpha = 0.7;
    ctx.font = GANN_LABEL_FONT;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const labelDist = 30;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const lx = ox + (dx / len) * labelDist;
      const ly = oy + (dy / len) * labelDist;
      ctx.fillText(angle.ratio, lx + GANN_LABEL_OFFSET, ly - GANN_LABEL_OFFSET);
    }
  }

  ctx.restore();
};
