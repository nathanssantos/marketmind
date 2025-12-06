import type { Kline, Viewport } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen } from '@shared/utils';

export interface KlineLayerConfig {
  bullishColor?: string;
  bearishColor?: string;
  wickColor?: string;
  lineWidth?: number;
  minKlineWidth?: number;
  maxKlineWidth?: number;
}

export const createKlineRenderer = (
  klines: Kline[],
  config: KlineLayerConfig = {},
  theme: { bullish: string; bearish: string }
) => {
  const {
    bullishColor = theme.bullish,
    bearishColor = theme.bearish,
    wickColor,
    lineWidth = 1,
    minKlineWidth = 1,
    maxKlineWidth = 20,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (klines.length === 0) return;

    const { width, height, priceMin, priceMax, start, end } = viewport;

    const visibleStart = Math.max(0, Math.floor(start));
    const visibleEnd = Math.min(klines.length, Math.ceil(end));
    const visibleCount = visibleEnd - visibleStart;

    if (visibleCount <= 0) return;

    const klineWidth = Math.min(
      maxKlineWidth,
      Math.max(minKlineWidth, (width / visibleCount) * 0.8)
    );

    ctx.save();
    ctx.lineWidth = lineWidth;

    for (let i = visibleStart; i < visibleEnd; i++) {
      const kline = klines[i];
      if (!kline) continue;

      const open = getKlineOpen(kline);
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      const close = getKlineClose(kline);

      const isBullish = close >= open;
      const color = isBullish ? bullishColor : bearishColor;

      const x = ((i - start) / (end - start)) * width;
      const yOpen = height - ((open - priceMin) / (priceMax - priceMin)) * height;
      const yClose = height - ((close - priceMin) / (priceMax - priceMin)) * height;
      const yHigh = height - ((high - priceMin) / (priceMax - priceMin)) * height;
      const yLow = height - ((low - priceMin) / (priceMax - priceMin)) * height;

      ctx.strokeStyle = wickColor || color;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      ctx.fillStyle = color;
      const bodyHeight = Math.abs(yClose - yOpen);
      const bodyY = Math.min(yOpen, yClose);

      if (bodyHeight < 1) {
        ctx.fillRect(x - klineWidth / 2, bodyY - 0.5, klineWidth, 1);
      } else {
        ctx.fillRect(x - klineWidth / 2, bodyY, klineWidth, bodyHeight);
      }
    }

    ctx.restore();
  };
};
