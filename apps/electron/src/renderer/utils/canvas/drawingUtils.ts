export const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  ctx.clearRect(0, 0, width, height);
};

export const drawRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string,
): void => {
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, width, height);
};

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeStyle: string,
  lineWidth: number = 1,
): void => {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
};

export const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillStyle: string,
  font: string = '12px sans-serif',
  textAlign: CanvasTextAlign = 'left',
  textBaseline: CanvasTextBaseline = 'top',
): void => {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.fillText(text, x, y);
  ctx.restore();
};

export const drawKline = (
  ctx: CanvasRenderingContext2D,
  x: number,
  openY: number,
  closeY: number,
  highY: number,
  lowY: number,
  width: number,
  wickWidth: number,
  bullishColor: string,
  bearishColor: string,
  isHighlighted: boolean = false,
  isBullish?: boolean,
): void => {
  const bullish = isBullish ?? closeY < openY;
  const color = bullish ? bullishColor : bearishColor;

  const bodyTop = Math.min(openY, closeY);
  const bodyBottom = Math.max(openY, closeY);
  const bodyHeight = bodyBottom - bodyTop;

  const wickTop = Math.min(highY, lowY);
  const wickBottom = Math.max(highY, lowY);

  ctx.save();

  if (isHighlighted) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }

  if (wickTop < bodyTop) {
    drawLine(ctx, x + width / 2, wickTop, x + width / 2, bodyTop, color, wickWidth);
  }

  if (wickBottom > bodyBottom) {
    drawLine(ctx, x + width / 2, bodyBottom, x + width / 2, wickBottom, color, wickWidth);
  }
  
  ctx.restore();

  ctx.save();
  
  if (isHighlighted) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }

  // Near-doji bodies (open ≈ close, sub-pixel delta) become an
  // invisible sliver if drawn at their true height. Render any body
  // thinner than the wick as a wick-thick line so the candle's body
  // remains perceptible — matches TradingView/Binance doji rendering.
  if (bodyHeight >= wickWidth) {
    drawRect(ctx, x, bodyTop, width, bodyHeight, color);
  } else {
    drawLine(ctx, x, openY, x + width, openY, color, wickWidth);
  }

  ctx.restore();
};

export const setupCanvas = (
  canvas: HTMLCanvasElement,
  devicePixelRatio: number = window.devicePixelRatio || 1,
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;

  const parent = canvas.parentElement;
  if (!parent) return ctx;

  const parentRect = parent.getBoundingClientRect();
  
  canvas.width = parentRect.width * devicePixelRatio;
  canvas.height = parentRect.height * devicePixelRatio;
  
  canvas.style.width = `${parentRect.width}px`;
  canvas.style.height = `${parentRect.height}px`;
  
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  return ctx;
};

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizontalLines: number,
  verticalLines: number,
  strokeStyle: string,
  lineWidth: number = 1,
): void => {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  const horizontalSpacing = height / (horizontalLines + 1);
  for (let i = 1; i <= horizontalLines; i++) {
    const y = i * horizontalSpacing;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  const verticalSpacing = width / (verticalLines + 1);
  for (let i = 1; i <= verticalLines; i++) {
    const x = i * verticalSpacing;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  ctx.stroke();
  ctx.restore();
};

export const drawCandleLabel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  bgColor: string,
  textColor: string = '#ffffff',
  fontSize: number = 11,
): void => {
  ctx.save();

  const font = `bold ${fontSize}px sans-serif`;
  ctx.font = font;
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;
  const padding = 4;
  const pillWidth = textWidth + padding * 2;
  const pillHeight = fontSize + padding * 2;
  const borderRadius = pillHeight / 2;

  const pillX = x - pillWidth / 2;
  const pillY = y - pillHeight - 4;

  ctx.beginPath();
  ctx.moveTo(pillX + borderRadius, pillY);
  ctx.lineTo(pillX + pillWidth - borderRadius, pillY);
  ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + borderRadius);
  ctx.lineTo(pillX + pillWidth, pillY + pillHeight - borderRadius);
  ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - borderRadius, pillY + pillHeight);
  ctx.lineTo(pillX + borderRadius, pillY + pillHeight);
  ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - borderRadius);
  ctx.lineTo(pillX, pillY + borderRadius);
  ctx.quadraticCurveTo(pillX, pillY, pillX + borderRadius, pillY);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, pillY + pillHeight / 2);

  ctx.restore();
};
