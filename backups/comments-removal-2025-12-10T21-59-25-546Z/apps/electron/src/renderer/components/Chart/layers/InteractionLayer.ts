import type { Kline, Viewport } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen } from '@shared/utils';

export interface CrosshairConfig {
  lineColor?: string;
  lineWidth?: number;
  lineDash?: number[];
  showPriceLabel?: boolean;
  showTimeLabel?: boolean;
  fontSize?: number;
}

export const createCrosshairRenderer = (
  klines: Kline[],
  mousePosition: { x: number; y: number } | null,
  config: CrosshairConfig = {},
  theme: { crosshair: string; background: string; text: string }
) => {
  const {
    lineColor = theme.crosshair,
    lineWidth = 1,
    lineDash = [4, 4],
    showPriceLabel = true,
    showTimeLabel = true,
    fontSize = 12,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (!mousePosition || klines.length === 0) return;

    const { width, height, priceMin, priceMax, start, end } = viewport;
    const { x, y } = mousePosition;

    if (x < 0 || x > width || y < 0 || y > height) return;

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineDash);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    if (showPriceLabel) {
      const price = priceMax - (y / height) * (priceMax - priceMin);
      const priceText = price.toFixed(2);

      ctx.font = `${fontSize}px monospace`;
      const textMetrics = ctx.measureText(priceText);
      const padding = 4;

      ctx.fillStyle = theme.background;
      ctx.fillRect(
        width - textMetrics.width - padding * 2,
        y - fontSize / 2 - padding,
        textMetrics.width + padding * 2,
        fontSize + padding * 2
      );

      ctx.fillStyle = theme.text;
      ctx.fillText(priceText, width - textMetrics.width - padding, y + fontSize / 3);
    }

    if (showTimeLabel) {
      const klineIndex = Math.floor(start + (x / width) * (end - start));
      if (klineIndex >= 0 && klineIndex < klines.length) {
        const kline = klines[klineIndex];
        if (!kline) return;
        const date = new Date(kline.openTime);
        const timeText = date.toLocaleTimeString();

        ctx.font = `${fontSize}px monospace`;
        const textMetrics = ctx.measureText(timeText);
        const padding = 4;

        ctx.fillStyle = theme.background;
        ctx.fillRect(
          x - textMetrics.width / 2 - padding,
          height - fontSize - padding * 2,
          textMetrics.width + padding * 2,
          fontSize + padding * 2
        );

        ctx.fillStyle = theme.text;
        ctx.fillText(timeText, x - textMetrics.width / 2, height - padding);
      }
    }

    ctx.restore();
  };
};

export interface TooltipConfig {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
}

export const createTooltipRenderer = (
  klines: Kline[],
  mousePosition: { x: number; y: number } | null,
  config: TooltipConfig = {},
  theme: { background: string; text: string }
) => {
  const {
    backgroundColor = theme.background,
    textColor = theme.text,
    fontSize = 12,
    padding = 8,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (!mousePosition || klines.length === 0) return;

    const { width, height, start, end } = viewport;
    const { x, y } = mousePosition;

    if (x < 0 || x > width || y < 0 || y > height) return;

    const klineIndex = Math.floor(start + (x / width) * (end - start));
    if (klineIndex < 0 || klineIndex >= klines.length) return;

    const kline = klines[klineIndex];
    if (!kline) return;
    const open = getKlineOpen(kline);
    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);
    const close = getKlineClose(kline);

    const lines = [
      `O: ${open.toFixed(2)}`,
      `H: ${high.toFixed(2)}`,
      `L: ${low.toFixed(2)}`,
      `C: ${close.toFixed(2)}`,
    ];

    ctx.save();
    ctx.font = `${fontSize}px monospace`;

    const maxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = lines.length * (fontSize + 4) + padding * 2;

    let tooltipX = x + 10;
    let tooltipY = y + 10;

    if (tooltipX + tooltipWidth > width) {
      tooltipX = x - tooltipWidth - 10;
    }

    if (tooltipY + tooltipHeight > height) {
      tooltipY = y - tooltipHeight - 10;
    }

    ctx.fillStyle = backgroundColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    ctx.fillStyle = textColor;
    ctx.globalAlpha = 1;

    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        tooltipX + padding,
        tooltipY + padding + (i + 1) * (fontSize + 4)
      );
    });

    ctx.restore();
  };
};
