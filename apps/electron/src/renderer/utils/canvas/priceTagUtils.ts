import { ORDER_LINE_LAYOUT } from '@shared/constants';

/**
 * Parses a CSS color string into RGB components in 0..255. Supports
 * `#rrggbb` / `#rgb` / `rgb()` / `rgba()`. Falls back to mid-gray when
 * the input is anything else (including named colors and hsl) — the
 * caller's text color decision will pick white in that case, which is
 * the conservative default. Returning null lets callers know parsing
 * failed if they need a different fallback.
 */
const parseColorRgb = (color: string): { r: number; g: number; b: number } | null => {
  const trimmed = color.trim().toLowerCase();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16),
        g: parseInt(hex[1]! + hex[1]!, 16),
        b: parseInt(hex[2]! + hex[2]!, 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]!, 10), g: parseInt(rgbMatch[2]!, 10), b: parseInt(rgbMatch[3]!, 10) };
  }
  return null;
};

/**
 * Picks black or white text for a given background using the WCAG
 * relative-luminance formula. Threshold tuned at 0.55 (slightly biased
 * toward black) so light-but-saturated colors (yellow, cyan, gold)
 * still get black text where pure 0.5 would flip to white. Without
 * this, white text on the user's white-default horizontal-line color
 * is unreadable; same for any user-picked light color across all
 * price-tag callers (live price, order entry/SL/TP, indicator
 * overlays, horizontal-line tag).
 */
export const getReadableTextColor = (bgColor: string): string => {
  const rgb = parseColorRgb(bgColor);
  if (!rgb) return '#ffffff';
  const toLinear = (c: number): number => {
    const norm = c / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  return luminance > 0.55 ? '#000000' : '#ffffff';
};

export const drawPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  y: number,
  x: number,
  fillColor: string,
  fixedWidth: number = 64,
  textColor?: string
): { width: number; height: number } => {
  const resolvedTextColor = textColor ?? getReadableTextColor(fillColor);
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

  ctx.fillStyle = resolvedTextColor;
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
  textColor?: string
): void => {
  const resolvedTextColor = textColor ?? getReadableTextColor(fillColor);
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

  ctx.fillStyle = resolvedTextColor;
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
