import type { TextDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS } from '@marketmind/chart-studies';

const UNDERLINE_OFFSET = 2;
const TEXT_LINE_HEIGHT = 1.2;

export const renderText = (
  ctx: CanvasRenderingContext2D,
  drawing: TextDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
): void => {
  if (!drawing.text) return;

  const x = mapper.indexToCenterX(drawing.index);
  const y = mapper.priceToY(drawing.price);

  ctx.save();
  ctx.font = `${drawing.fontWeight} ${drawing.fontSize}px sans-serif`;
  ctx.fillStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.text);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(drawing.text, x, y);

  const needsWidth = drawing.textDecoration === 'underline' || isSelected;
  const textWidth = needsWidth ? ctx.measureText(drawing.text).width : 0;

  if (drawing.textDecoration === 'underline') {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + UNDERLINE_OFFSET);
    ctx.lineTo(x + textWidth, y + UNDERLINE_OFFSET);
    ctx.stroke();
  }

  if (isSelected) {
    const h = drawing.fontSize * TEXT_LINE_HEIGHT;
    ctx.strokeStyle = DRAWING_COLORS.selected;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x - 2, y - h - 2, textWidth + 4, h + 4);
    ctx.setLineDash([]);
  }

  ctx.restore();
};
