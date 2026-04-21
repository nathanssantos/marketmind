import { ORDER_LINE_LAYOUT } from '@shared/constants';

export const drawPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  y: number,
  x: number,
  fillColor: string,
  fixedWidth: number = 64,
  textColor: string = '#ffffff'
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;

  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fillColor;

  const endX = x + fixedWidth;
  ctx.beginPath();
  ctx.moveTo(x - arrowWidth, y);
  ctx.lineTo(x, y - labelHeight / 2);
  ctx.lineTo(endX, y - labelHeight / 2);
  ctx.lineTo(endX, y + labelHeight / 2);
  ctx.lineTo(x, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.fillText(priceText, x + labelPadding, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
  ctx.restore();

  return { width: fixedWidth + arrowWidth, height: labelHeight };
};

// Unified current-price tag: one arrow shape covering the price row and optionally
// a timer row below. The arrow tip always aligns with the price line (y).
export const drawCurrentPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  timerText: string | null,
  y: number,
  x: number,
  fillColor: string,
  borderColor: string,
  fixedWidth: number = 64,
  textColor: string = '#ffffff'
): void => {
  const labelPadding = 8;
  const arrowWidth = 6;
  const priceHeight = 18;
  const timerHeight = 13;
  const timerGap = 1;

  const topY = y - priceHeight / 2;
  const bottomY = timerText ? y + priceHeight / 2 + timerGap + timerHeight : y + priceHeight / 2;
  const endX = x + fixedWidth;

  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(x - arrowWidth, y);
  ctx.lineTo(x, topY);
  ctx.lineTo(endX, topY);
  ctx.lineTo(endX, bottomY);
  ctx.lineTo(x, bottomY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.fillText(priceText, x + labelPadding, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);

  if (timerText) {
    ctx.font = '9px monospace';
    ctx.fillText(timerText, x + labelPadding, y + priceHeight / 2 + timerGap + timerHeight / 2 + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
  }

  ctx.restore();
};

// TradingView-style timer format:
//   < 1 hour  → "MM:SS"            e.g. "04:23"
//   < 1 day   → "Hh MM:SS"         e.g. "3h 23:45"
//   ≥ 1 day   → "Dd HH:MM"         e.g. "1d 02:33"
export const formatTimerText = (seconds: number): string => {
  if (seconds <= 0) return '00:00';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0)
    {return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;}
  if (hours > 0)
    {return `${hours}h ${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;}
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const computeSecondsRemaining = (_timeframe: string, closeTime: number): number =>
  Math.max(0, Math.floor((closeTime - Date.now()) / 1000));
