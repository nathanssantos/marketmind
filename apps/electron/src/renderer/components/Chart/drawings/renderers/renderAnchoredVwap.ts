import type { AnchoredVwapDrawing, CoordinateMapper } from '@marketmind/chart-studies';
import { DRAWING_COLORS, DEFAULT_LINE_WIDTH } from '@marketmind/chart-studies';
import type { Kline } from '@marketmind/types';

export const renderAnchoredVwap = (
  ctx: CanvasRenderingContext2D,
  drawing: AnchoredVwapDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  klines: Kline[],
): void => {
  if (klines.length === 0) return;

  const anchorIdx = Math.max(0, Math.round(drawing.index));
  if (anchorIdx >= klines.length) return;

  const baseWidth = drawing.lineWidth ?? DEFAULT_LINE_WIDTH;
  ctx.save();
  ctx.strokeStyle = isSelected ? DRAWING_COLORS.selected : (drawing.color ?? DRAWING_COLORS.anchoredVwap);
  ctx.lineWidth = isSelected ? baseWidth + 0.5 : baseWidth;

  let cumVol = 0;
  let cumTpVol = 0;
  let started = false;

  ctx.beginPath();

  for (let i = anchorIdx; i < klines.length; i++) {
    const k = klines[i];
    if (!k) continue;

    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    const volume = parseFloat(k.volume);

    const tp = (high + low + close) / 3;
    cumVol += volume;
    cumTpVol += tp * volume;

    if (cumVol === 0) continue;

    const vwap = cumTpVol / cumVol;
    const x = mapper.indexToCenterX(i);
    const y = mapper.priceToY(vwap);

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  const anchorX = mapper.indexToCenterX(anchorIdx);
  const anchorY = mapper.priceToY(drawing.price);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
