export const drawPriceTag = (
  ctx: CanvasRenderingContext2D,
  priceText: string,
  y: number,
  x: number,
  fillColor: string,
  fixedWidth: number = 72
): { width: number; height: number } => {
  const labelPadding = 8;
  const labelHeight = 18;
  const arrowWidth = 6;
  const tagWidth = fixedWidth;
  
  ctx.save();
  ctx.fillStyle = fillColor;
  
  const endX = x + tagWidth;
  ctx.beginPath();
  ctx.moveTo(x - arrowWidth, y);
  ctx.lineTo(x, y - labelHeight / 2);
  ctx.lineTo(endX, y - labelHeight / 2);
  ctx.lineTo(endX, y + labelHeight / 2);
  ctx.lineTo(x, y + labelHeight / 2);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText(priceText, x + labelPadding, y);
  
  ctx.restore();
  return { width: tagWidth + arrowWidth, height: labelHeight };
};
