export interface ZoneAreaOptions {
  left: number;
  right: number;
  topY: number;
  bottomY: number;
  fillColor: string;
  fillAlpha?: number;
  borderColor?: string;
  borderAlpha?: number;
  borderWidth?: number;
  borderDash?: number[];
}

export const drawZoneArea = (ctx: CanvasRenderingContext2D, options: ZoneAreaOptions): void => {
  const { left, right, topY, bottomY, fillColor, fillAlpha, borderColor, borderAlpha, borderWidth, borderDash } = options;
  const width = right - left;
  if (width <= 0) return;

  const top = Math.min(topY, bottomY);
  const height = Math.abs(bottomY - topY);
  const previousAlpha = ctx.globalAlpha;

  ctx.fillStyle = fillColor;
  if (fillAlpha !== undefined) ctx.globalAlpha = fillAlpha;
  ctx.fillRect(left, top, width, height);
  ctx.globalAlpha = previousAlpha;

  if (!borderColor) return;

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth ?? 1;
  if (borderAlpha !== undefined) ctx.globalAlpha = borderAlpha;
  if (borderDash) ctx.setLineDash(borderDash);

  ctx.beginPath();
  ctx.moveTo(left, topY);
  ctx.lineTo(right, topY);
  ctx.moveTo(left, bottomY);
  ctx.lineTo(right, bottomY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.globalAlpha = previousAlpha;
};
