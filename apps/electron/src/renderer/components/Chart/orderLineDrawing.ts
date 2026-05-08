import { drawBotIcon, drawShieldIcon } from '@renderer/utils/canvas/canvasIcons';
import { drawFlatLeftStrokePath, drawPillPath } from '@renderer/utils/canvas/priceTagUtils';
import { ORDER_LINE_COLORS, ORDER_LINE_LAYOUT, ORDER_LINE_ANIMATION } from '@shared/constants';
import { SLTP_BUTTON } from './orderLineTypes';

export const isSLInProfitZone = (isLong: boolean, entryPrice: number, slPrice: number): boolean =>
  isLong ? slPrice > entryPrice : slPrice < entryPrice;

export const findKlineIndexByTime = (
  klines: Array<{ openTime: number }>,
  targetTime: number
): number => {
  if (klines.length === 0) return 0;
  let low = 0;
  let high = klines.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (klines[mid]!.openTime < targetTime) low = mid + 1;
    else if (klines[mid]!.openTime > targetTime) high = mid - 1;
    else return mid;
  }
  return Math.max(0, high);
};

export const drawInfoTagFlash = (
  ctx: CanvasRenderingContext2D,
  tagSize: { width: number; height: number },
  y: number,
  flashAlpha: number
): void => {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
  drawPillPath(
    ctx,
    0,
    y - tagSize.height / 2,
    tagSize.width,
    tagSize.height,
    ORDER_LINE_LAYOUT.LABEL_BORDER_RADIUS,
    'flat-left',
  );
  ctx.fill();
  ctx.restore();
};

export const drawProfitLossArea = (
  ctx: CanvasRenderingContext2D,
  y1: number,
  y2: number,
  chartWidth: number,
  isProfit: boolean,
  startX: number = 0
): void => {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const height = maxY - minY;
  if (height <= 0) return;

  const effectiveStartX = Math.max(0, startX);
  const width = chartWidth - effectiveStartX;
  if (width <= 0) return;

  ctx.save();
  ctx.fillStyle = isProfit ? ORDER_LINE_COLORS.PROFIT_AREA : ORDER_LINE_COLORS.LOSS_AREA;
  ctx.fillRect(effectiveStartX, minY, width, height);
  ctx.restore();
};

const drawSpinner = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  timestamp: number
): void => {
  const startAngle = timestamp * ORDER_LINE_ANIMATION.SPINNER_SPEED;
  ctx.strokeStyle = ORDER_LINE_COLORS.SPINNER_COLOR;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, startAngle + ORDER_LINE_ANIMATION.SPINNER_ARC_LENGTH);
  ctx.stroke();
};

export interface InlineSlTpButtons {
  showSl: boolean;
  showTp: boolean;
  slButtonRef?: { x: number; y: number; width: number; height: number } | null;
  tpButtonRef?: { x: number; y: number; width: number; height: number } | null;
}

const DIRECTION_TRIANGLE_SIZE = 7;
const DIRECTION_TRIANGLE_GAP = 4;

const drawDirectionTriangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'up' | 'down',
  color: string,
): void => {
  const half = DIRECTION_TRIANGLE_SIZE / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === 'up') {
    ctx.moveTo(x + half, y - half);
    ctx.lineTo(x + DIRECTION_TRIANGLE_SIZE, y + half);
    ctx.lineTo(x, y + half);
  } else {
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + DIRECTION_TRIANGLE_SIZE, y - half);
    ctx.lineTo(x + half, y + half);
  }
  ctx.closePath();
  ctx.fill();
};

export const drawInfoTag = (
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  borderColor: string,
  bgColor: string,
  textColor: string,
  hasCloseButton: boolean = false,
  closeButtonRef?: { x: number; y: number; size: number } | null,
  icon: 'bot' | 'shield' | null = null,
  isLoading: boolean = false,
  timestamp: number = 0,
  inlineSlTp: InlineSlTpButtons | null = null,
  direction: 'up' | 'down' | null = null
): { width: number; height: number } => {
  const {
    LABEL_PADDING,
    LABEL_HEIGHT,
    CLOSE_BUTTON_SIZE,
    CLOSE_BUTTON_MARGIN,
    ICON_SIZE,
    ICON_MARGIN,
    CLOSE_CROSS_PADDING,
    LABEL_BORDER_RADIUS,
    LABEL_BORDER_WIDTH,
  } = ORDER_LINE_LAYOUT;

  const textWidth = ctx.measureText(text).width;
  const closeButtonSpace = hasCloseButton ? CLOSE_BUTTON_SIZE + CLOSE_BUTTON_MARGIN : 0;
  const iconSpace = icon ? ICON_SIZE + ICON_MARGIN : 0;
  const directionSpace = direction ? DIRECTION_TRIANGLE_SIZE + DIRECTION_TRIANGLE_GAP : 0;
  // SL + TP render as a joined button group (no gap between them).
  // Only the OUTER edges have border radius; the inner edges where
  // the two buttons meet are flat. So the per-button width contribution
  // is just SLTP_BUTTON.WIDTH; the GAP only applies once — before the
  // first button (separating it from the price text).
  const groupHasButtons = inlineSlTp?.showSl || inlineSlTp?.showTp;
  const inlineSlSpace = inlineSlTp?.showSl ? SLTP_BUTTON.WIDTH : 0;
  const inlineTpSpace = inlineSlTp?.showTp ? SLTP_BUTTON.WIDTH : 0;
  const inlineGroupGap = groupHasButtons ? SLTP_BUTTON.GAP : 0;
  const totalContentWidth = closeButtonSpace + iconSpace + directionSpace + textWidth + inlineGroupGap + inlineSlSpace + inlineTpSpace;
  const rightPadding = inlineSlTp ? 1 : LABEL_PADDING;
  const tagWidth = totalContentWidth + LABEL_PADDING + rightPadding;

  ctx.save();

  ctx.fillStyle = bgColor;
  drawPillPath(ctx, 0, y - LABEL_HEIGHT / 2, tagWidth, LABEL_HEIGHT, LABEL_BORDER_RADIUS, 'flat-left');
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = LABEL_BORDER_WIDTH;
  drawFlatLeftStrokePath(ctx, 0, y - LABEL_HEIGHT / 2, tagWidth, LABEL_HEIGHT, LABEL_BORDER_RADIUS);
  ctx.stroke();

  if (hasCloseButton && closeButtonRef) {
    const closeButtonX = LABEL_PADDING;
    const closeButtonY = y - CLOSE_BUTTON_SIZE / 2;

    ctx.fillStyle = ORDER_LINE_COLORS.CLOSE_BUTTON_BG;
    ctx.beginPath();
    ctx.roundRect(closeButtonX, closeButtonY, CLOSE_BUTTON_SIZE, CLOSE_BUTTON_SIZE, 2);
    ctx.fill();

    if (isLoading) {
      drawSpinner(ctx, closeButtonX + CLOSE_BUTTON_SIZE / 2, y, CLOSE_BUTTON_SIZE / 2 - 2, timestamp);
    } else {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(closeButtonX + CLOSE_CROSS_PADDING, closeButtonY + CLOSE_CROSS_PADDING);
      ctx.lineTo(closeButtonX + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING, closeButtonY + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING);
      ctx.moveTo(closeButtonX + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING, closeButtonY + CLOSE_CROSS_PADDING);
      ctx.lineTo(closeButtonX + CLOSE_CROSS_PADDING, closeButtonY + CLOSE_BUTTON_SIZE - CLOSE_CROSS_PADDING);
      ctx.stroke();
    }

    closeButtonRef.x = closeButtonX;
    closeButtonRef.y = closeButtonY;
    closeButtonRef.size = CLOSE_BUTTON_SIZE;
  }

  let currentX = LABEL_PADDING + closeButtonSpace;

  if (icon === 'bot') {
    drawBotIcon(ctx, currentX, y - ICON_SIZE / 2, ICON_SIZE);
    currentX += ICON_SIZE + ICON_MARGIN;
  } else if (icon === 'shield') {
    drawShieldIcon(ctx, currentX, y - ICON_SIZE / 2 - 1, ICON_SIZE);
    currentX += ICON_SIZE + ICON_MARGIN;
  }

  if (direction) {
    drawDirectionTriangle(ctx, currentX, y, direction, textColor);
    currentX += DIRECTION_TRIANGLE_SIZE + DIRECTION_TRIANGLE_GAP;
  }

  ctx.fillStyle = textColor;
  ctx.fillText(text, currentX, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);

  if (inlineSlTp) {
    let inlineX = currentX + textWidth + SLTP_BUTTON.GAP;
    const btnY = y - SLTP_BUTTON.HEIGHT / 2;
    const r = SLTP_BUTTON.BORDER_RADIUS;
    // Joined button-group: SL on the left rounded only on the LEFT
    // edge, TP on the right rounded only on the RIGHT edge. Inner
    // edges where they meet are flat (radius 0). When only one of
    // the two is rendered, that single button keeps full radii.
    const bothShown = inlineSlTp.showSl && inlineSlTp.showTp;
    const slRadii: [number, number, number, number] = bothShown
      ? [r, 0, 0, r]   // top-left, top-right, bottom-right, bottom-left
      : [r, r, r, r];
    const tpRadii: [number, number, number, number] = bothShown
      ? [0, r, r, 0]
      : [r, r, r, r];

    ctx.save();
    ctx.font = `${SLTP_BUTTON.FONT_SIZE}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    if (inlineSlTp.showSl) {
      ctx.fillStyle = SLTP_BUTTON.SL_BG;
      ctx.beginPath();
      ctx.roundRect(inlineX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, slRadii);
      ctx.fill();
      ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
      ctx.fillText('SL', inlineX + SLTP_BUTTON.WIDTH / 2, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
      if (inlineSlTp.slButtonRef) {
        inlineSlTp.slButtonRef.x = inlineX;
        inlineSlTp.slButtonRef.y = btnY;
        inlineSlTp.slButtonRef.width = SLTP_BUTTON.WIDTH;
        inlineSlTp.slButtonRef.height = SLTP_BUTTON.HEIGHT;
      }
      // No GAP between SL and TP — joined edges.
      inlineX += SLTP_BUTTON.WIDTH;
    }
    if (inlineSlTp.showTp) {
      ctx.fillStyle = SLTP_BUTTON.TP_BG;
      ctx.beginPath();
      ctx.roundRect(inlineX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, tpRadii);
      ctx.fill();
      ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
      ctx.fillText('TP', inlineX + SLTP_BUTTON.WIDTH / 2, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
      if (inlineSlTp.tpButtonRef) {
        inlineSlTp.tpButtonRef.x = inlineX;
        inlineSlTp.tpButtonRef.y = btnY;
        inlineSlTp.tpButtonRef.width = SLTP_BUTTON.WIDTH;
        inlineSlTp.tpButtonRef.height = SLTP_BUTTON.HEIGHT;
      }
    }
    ctx.restore();
  }

  ctx.restore();
  return { width: tagWidth, height: LABEL_HEIGHT };
};

export const drawPercentBadge = (
  ctx: CanvasRenderingContext2D,
  percentText: string,
  x: number,
  y: number,
  isPositive: boolean
): { width: number; height: number } => {
  const percentPadding = 4;
  const percentHeight = 14;
  const borderRadius = ORDER_LINE_LAYOUT.LABEL_BORDER_RADIUS;
  const percentWidth = ctx.measureText(percentText).width;
  const badgeWidth = percentWidth + percentPadding * 2;

  ctx.save();
  const bgColor = isPositive ? ORDER_LINE_COLORS.PERCENT_POSITIVE_BG : ORDER_LINE_COLORS.PERCENT_NEGATIVE_BG;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y - percentHeight / 2, badgeWidth, percentHeight, borderRadius);
  ctx.fill();

  ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
  ctx.fillText(percentText, x + percentPadding, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);

  ctx.restore();
  return { width: badgeWidth, height: percentHeight };
};

export const drawSlTpButtons = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hasStopLoss: boolean,
  hasTakeProfit: boolean,
): { slButton: { x: number; y: number } | null; tpButton: { x: number; y: number } | null; totalWidth: number } => {
  let currentX = x;
  let slButton: { x: number; y: number } | null = null;
  let tpButton: { x: number; y: number } | null = null;

  ctx.save();
  ctx.font = `${SLTP_BUTTON.FONT_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!hasStopLoss) {
    const btnY = y - SLTP_BUTTON.HEIGHT / 2;
    ctx.fillStyle = SLTP_BUTTON.SL_BG;
    ctx.strokeStyle = SLTP_BUTTON.SL_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, SLTP_BUTTON.BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
    ctx.fillText('SL', currentX + SLTP_BUTTON.WIDTH / 2, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
    slButton = { x: currentX, y: btnY };
    currentX += SLTP_BUTTON.WIDTH + SLTP_BUTTON.GAP;
  }

  if (!hasTakeProfit) {
    const btnY = y - SLTP_BUTTON.HEIGHT / 2;
    ctx.fillStyle = SLTP_BUTTON.TP_BG;
    ctx.strokeStyle = SLTP_BUTTON.TP_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX, btnY, SLTP_BUTTON.WIDTH, SLTP_BUTTON.HEIGHT, SLTP_BUTTON.BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SLTP_BUTTON.TEXT_COLOR;
    ctx.fillText('TP', currentX + SLTP_BUTTON.WIDTH / 2, y + ORDER_LINE_LAYOUT.TEXT_BASELINE_OFFSET);
    tpButton = { x: currentX, y: btnY };
    currentX += SLTP_BUTTON.WIDTH;
  }

  ctx.restore();
  return { slButton, tpButton, totalWidth: currentX - x };
};

export const drawFlashLine = (
  ctx: CanvasRenderingContext2D,
  flashAlpha: number,
  y: number,
  chartWidth: number
): void => {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.strokeStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.restore();
};

export const drawHorizontalLine = (
  ctx: CanvasRenderingContext2D,
  y: number,
  chartWidth: number,
  color: string,
  lineWidth: number = 1
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
};

export const setStandardFont = (ctx: CanvasRenderingContext2D): void => {
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
};
