import { ORDER_LINE_LAYOUT } from '@shared/constants';

type ArrowSide = 'left' | 'right' | 'none' | 'flat-left' | 'flat-right';

/**
 * Shared rounded-pill path used by every price-scale tag and on-canvas
 * info tag. The arrow can point LEFT (price-scale tags pointing into the
 * chart from the right edge) or RIGHT (on-canvas labels pointing to the
 * right-side price line). When `arrowSide === 'none'` the path is a
 * plain rounded rect used by the inline PnL/percent badges.
 *
 * `x`/`y`/`width`/`height` describe the body rectangle (excluding the
 * arrow tip — the arrow extends `ARROW_WIDTH` beyond the body on the
 * arrow side).
 */
const drawPillPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  arrowSide: ArrowSide,
): void => {
  const arrowW = ORDER_LINE_LAYOUT.ARROW_WIDTH;
  const r = Math.min(radius, height / 2);
  const right = x + width;
  const bottom = y + height;
  const midY = y + height / 2;

  ctx.beginPath();
  if (arrowSide === 'left') {
    ctx.moveTo(x - arrowW, midY);
    ctx.lineTo(x, y);
    ctx.lineTo(right - r, y);
    ctx.arcTo(right, y, right, y + r, r);
    ctx.lineTo(right, bottom - r);
    ctx.arcTo(right, bottom, right - r, bottom, r);
    ctx.lineTo(x, bottom);
    ctx.closePath();
    return;
  }
  if (arrowSide === 'right') {
    ctx.moveTo(x + r, y);
    ctx.lineTo(right, y);
    ctx.lineTo(right + arrowW, midY);
    ctx.lineTo(right, bottom);
    ctx.lineTo(x + r, bottom);
    ctx.arcTo(x, bottom, x, bottom - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    return;
  }
  if (arrowSide === 'flat-left') {
    ctx.moveTo(x, y);
    ctx.lineTo(right - r, y);
    ctx.arcTo(right, y, right, y + r, r);
    ctx.lineTo(right, bottom - r);
    ctx.arcTo(right, bottom, right - r, bottom, r);
    ctx.lineTo(x, bottom);
    ctx.closePath();
    return;
  }
  if (arrowSide === 'flat-right') {
    ctx.moveTo(right, y);
    ctx.lineTo(x + r, y);
    ctx.arcTo(x, y, x, y + r, r);
    ctx.lineTo(x, bottom - r);
    ctx.arcTo(x, bottom, x + r, bottom, r);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(right - r, y);
  ctx.arcTo(right, y, right, y + r, r);
  ctx.lineTo(right, bottom - r);
  ctx.arcTo(right, bottom, right - r, bottom, r);
  ctx.lineTo(x + r, bottom);
  ctx.arcTo(x, bottom, x, bottom - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

/**
 * Stroke path for `flat-left` shape — only top edge → top-right curve →
 * right edge → bottom-right curve → bottom edge. Skips the left vertical
 * line so the tag visually exits the canvas without a closing border.
 */
export const drawFlatLeftStrokePath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const r = Math.min(radius, height / 2);
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(right - r, y);
  ctx.arcTo(right, y, right, y + r, r);
  ctx.lineTo(right, bottom - r);
  ctx.arcTo(right, bottom, right - r, bottom, r);
  ctx.lineTo(x, bottom);
};

export { drawPillPath };

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
  const labelHeight = ORDER_LINE_LAYOUT.LABEL_HEIGHT;

  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fillColor;

  drawPillPath(
    ctx,
    x,
    y - labelHeight / 2,
    fixedWidth,
    labelHeight,
    ORDER_LINE_LAYOUT.LABEL_BORDER_RADIUS,
    'flat-right',
  );
  ctx.fill();

  ctx.fillStyle = resolvedTextColor;
  ctx.fillText(priceText, x + ORDER_LINE_LAYOUT.LABEL_PADDING, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
  ctx.restore();

  return { width: fixedWidth, height: labelHeight };
};

// Unified current-price tag: rounded pill (no border) covering the price
// row and optionally a timer row below. Both rows share the same 11px
// font and the timer sits flush against the price (TIMER_GAP = 0).
export const drawCurrentPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  timerText: string | null,
  y: number,
  x: number,
  fillColor: string,
  fixedWidth: number = 64,
  textColor?: string
): void => {
  const resolvedTextColor = textColor ?? getReadableTextColor(fillColor);
  const priceHeight = ORDER_LINE_LAYOUT.LABEL_HEIGHT;
  const timerHeight = ORDER_LINE_LAYOUT.TIMER_HEIGHT;
  const timerGap = ORDER_LINE_LAYOUT.TIMER_GAP;

  const totalHeight = timerText ? priceHeight + timerGap + timerHeight : priceHeight;
  const topY = y - priceHeight / 2;

  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = fillColor;
  drawPillPath(
    ctx,
    x,
    topY,
    fixedWidth,
    totalHeight,
    ORDER_LINE_LAYOUT.LABEL_BORDER_RADIUS,
    'flat-right',
  );
  ctx.fill();

  ctx.fillStyle = resolvedTextColor;
  ctx.fillText(priceText, x + ORDER_LINE_LAYOUT.LABEL_PADDING, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);

  if (timerText) {
    ctx.fillText(
      timerText,
      x + ORDER_LINE_LAYOUT.LABEL_PADDING,
      y + priceHeight / 2 + timerGap + timerHeight / 2 + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET,
    );
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
