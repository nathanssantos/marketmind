import { ORDER_LINE_COLORS } from '@shared/constants/chartColors';

const SVG_BOT_ICON = {
  VIEWBOX_SIZE: 24,
  STROKE_WIDTH_DIVISOR: 12,
  ANTENNA_CENTER_X: 12,
  ANTENNA_TOP_Y: 4,
  ANTENNA_BOTTOM_Y: 8,
  ANTENNA_LEFT_X: 8,
  BODY_X: 4,
  BODY_Y: 8,
  BODY_WIDTH: 16,
  BODY_HEIGHT: 12,
  LEFT_EAR_X: 2,
  RIGHT_EAR_START_X: 20,
  RIGHT_EAR_END_X: 22,
  EAR_Y: 14,
  LEFT_EYE_X: 9,
  RIGHT_EYE_X: 15,
  EYE_TOP_Y: 13,
  EYE_BOTTOM_Y: 15,
} as const;

const SVG_SHIELD_ICON = {
  VIEWBOX_SIZE: 24,
  STROKE_WIDTH_DIVISOR: 12,
  TOP_X: 12,
  TOP_Y: 2.28,
  LEFT_TOP_X: 5,
  LEFT_TOP_Y: 5,
  LEFT_BOTTOM_X: 4,
  LEFT_BOTTOM_Y: 6,
  LEFT_MID_X: 4,
  LEFT_MID_Y: 13,
  BOTTOM_X: 11.67,
  BOTTOM_Y: 21.95,
  RIGHT_MID_X: 20,
  RIGHT_MID_Y: 13,
  RIGHT_BOTTOM_X: 20,
  RIGHT_BOTTOM_Y: 6,
  RIGHT_TOP_X: 19,
  RIGHT_TOP_Y: 5,
} as const;

const BODY_RADIUS_SCALE = 2;

const drawScaledIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  viewboxSize: number,
  strokeWidthDivisor: number,
  strokeColor: string,
  drawPaths: (ctx: CanvasRenderingContext2D, scale: number, x: number, y: number) => void
): void => {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size / strokeWidthDivisor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const scale = size / viewboxSize;
  drawPaths(ctx, scale, x, y);

  ctx.restore();
};

export const drawBotIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  strokeColor: string = ORDER_LINE_COLORS.BOT_ICON_STROKE
): void => {
  drawScaledIcon(ctx, x, y, size, SVG_BOT_ICON.VIEWBOX_SIZE, SVG_BOT_ICON.STROKE_WIDTH_DIVISOR, strokeColor, (ctx, scale, x, y) => {
    ctx.beginPath();
    ctx.moveTo(x + SVG_BOT_ICON.ANTENNA_CENTER_X * scale, y + SVG_BOT_ICON.ANTENNA_BOTTOM_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.ANTENNA_CENTER_X * scale, y + SVG_BOT_ICON.ANTENNA_TOP_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.ANTENNA_LEFT_X * scale, y + SVG_BOT_ICON.ANTENNA_TOP_Y * scale);
    ctx.stroke();

    const bodyX = x + SVG_BOT_ICON.BODY_X * scale;
    const bodyY = y + SVG_BOT_ICON.BODY_Y * scale;
    const bodyW = SVG_BOT_ICON.BODY_WIDTH * scale;
    const bodyH = SVG_BOT_ICON.BODY_HEIGHT * scale;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, BODY_RADIUS_SCALE * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + SVG_BOT_ICON.LEFT_EAR_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.BODY_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + SVG_BOT_ICON.RIGHT_EAR_START_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.RIGHT_EAR_END_X * scale, y + SVG_BOT_ICON.EAR_Y * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + SVG_BOT_ICON.RIGHT_EYE_X * scale, y + SVG_BOT_ICON.EYE_TOP_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.RIGHT_EYE_X * scale, y + SVG_BOT_ICON.EYE_BOTTOM_Y * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + SVG_BOT_ICON.LEFT_EYE_X * scale, y + SVG_BOT_ICON.EYE_TOP_Y * scale);
    ctx.lineTo(x + SVG_BOT_ICON.LEFT_EYE_X * scale, y + SVG_BOT_ICON.EYE_BOTTOM_Y * scale);
    ctx.stroke();
  });
};

export const drawShieldIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  strokeColor: string = ORDER_LINE_COLORS.TRAILING_STOP_ICON_STROKE
): void => {
  drawScaledIcon(ctx, x, y, size, SVG_SHIELD_ICON.VIEWBOX_SIZE, SVG_SHIELD_ICON.STROKE_WIDTH_DIVISOR, strokeColor, (ctx, scale, x, y) => {
    ctx.beginPath();
    ctx.moveTo(x + SVG_SHIELD_ICON.RIGHT_MID_X * scale, y + SVG_SHIELD_ICON.RIGHT_MID_Y * scale);
    ctx.bezierCurveTo(
      x + SVG_SHIELD_ICON.RIGHT_MID_X * scale, y + 18 * scale,
      x + 16.5 * scale, y + SVG_SHIELD_ICON.BOTTOM_Y * scale,
      x + SVG_SHIELD_ICON.BOTTOM_X * scale, y + SVG_SHIELD_ICON.BOTTOM_Y * scale
    );
    ctx.bezierCurveTo(
      x + 7.5 * scale, y + SVG_SHIELD_ICON.BOTTOM_Y * scale,
      x + SVG_SHIELD_ICON.LEFT_MID_X * scale, y + 18 * scale,
      x + SVG_SHIELD_ICON.LEFT_MID_X * scale, y + SVG_SHIELD_ICON.LEFT_MID_Y * scale
    );
    ctx.lineTo(x + SVG_SHIELD_ICON.LEFT_BOTTOM_X * scale, y + SVG_SHIELD_ICON.LEFT_BOTTOM_Y * scale);
    ctx.bezierCurveTo(
      x + SVG_SHIELD_ICON.LEFT_BOTTOM_X * scale, y + 5.45 * scale,
      x + 4.02 * scale, y + 5 * scale,
      x + SVG_SHIELD_ICON.LEFT_TOP_X * scale, y + SVG_SHIELD_ICON.LEFT_TOP_Y * scale
    );
    ctx.bezierCurveTo(
      x + 7 * scale, y + 3.8 * scale,
      x + 9.5 * scale, y + SVG_SHIELD_ICON.TOP_Y * scale,
      x + 11.24 * scale, y + SVG_SHIELD_ICON.TOP_Y * scale
    );
    ctx.bezierCurveTo(
      x + 11.68 * scale, y + 1.95 * scale,
      x + 12.32 * scale, y + 1.95 * scale,
      x + 12.76 * scale, y + SVG_SHIELD_ICON.TOP_Y * scale
    );
    ctx.bezierCurveTo(
      x + 14.51 * scale, y + 3.81 * scale,
      x + 17 * scale, y + SVG_SHIELD_ICON.RIGHT_TOP_Y * scale,
      x + SVG_SHIELD_ICON.RIGHT_TOP_X * scale, y + SVG_SHIELD_ICON.RIGHT_TOP_Y * scale
    );
    ctx.bezierCurveTo(
      x + 19.98 * scale, y + 5 * scale,
      x + SVG_SHIELD_ICON.RIGHT_BOTTOM_X * scale, y + 5.45 * scale,
      x + SVG_SHIELD_ICON.RIGHT_BOTTOM_X * scale, y + SVG_SHIELD_ICON.RIGHT_BOTTOM_Y * scale
    );
    ctx.lineTo(x + SVG_SHIELD_ICON.RIGHT_MID_X * scale, y + SVG_SHIELD_ICON.RIGHT_MID_Y * scale);
    ctx.closePath();
    ctx.stroke();
  });
};
