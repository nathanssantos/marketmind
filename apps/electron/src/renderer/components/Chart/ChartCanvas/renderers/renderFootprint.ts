import { ORDER_LINE_COLORS } from '@shared/constants/chartColors';
import type { GenericRenderer } from './types';

const LEVEL_HEIGHT = 12;
const FONT_SIZE = 9;
const BAR_OPACITY = 0.7;

const formatVolume = (vol: number): string => {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  if (vol >= 1) return vol.toFixed(1);
  return vol.toFixed(3);
};

const priceToY = (price: number, priceMin: number, priceMax: number, height: number): number => {
  if (priceMax === priceMin) return height / 2;
  return height - ((price - priceMin) / (priceMax - priceMin)) * height;
};

export const renderFootprint: GenericRenderer = (ctx) => {
  const { manager, colors, external } = ctx;
  const footprintBars = external?.footprintBars;
  if (!footprintBars || footprintBars.length === 0) return;

  const canvasCtx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();
  if (!canvasCtx || !dimensions) return;

  const chartHeight = viewport.height;
  const clipHeight = dimensions.chartHeight ?? chartHeight;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, dimensions.chartWidth, clipHeight);
  canvasCtx.clip();
  canvasCtx.font = `${FONT_SIZE}px monospace`;
  canvasCtx.textAlign = 'center';
  canvasCtx.textBaseline = 'middle';
  canvasCtx.globalAlpha = BAR_OPACITY;

  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(footprintBars.length, Math.ceil(viewport.end));

  for (let i = visibleStart; i < visibleEnd; i++) {
    const bar = footprintBars[i];
    if (!bar) continue;

    const barCenterX = manager.indexToX(i);
    const barWidth = viewport.klineWidth;
    const halfWidth = barWidth / 2;

    for (const [price, level] of bar.levels) {
      const y = priceToY(price, viewport.priceMin, viewport.priceMax, chartHeight);
      if (y < 0 || y > chartHeight) continue;

      const total = level.bidVol + level.askVol;
      if (total === 0) continue;

      const bidRatio = level.bidVol / total;
      const bidWidth = halfWidth * bidRatio;
      const askWidth = halfWidth * (1 - bidRatio);

      canvasCtx.fillStyle = colors.bullish;
      canvasCtx.fillRect(barCenterX - halfWidth, y - LEVEL_HEIGHT / 2, bidWidth, LEVEL_HEIGHT);

      canvasCtx.fillStyle = colors.bearish;
      canvasCtx.fillRect(barCenterX - halfWidth + bidWidth, y - LEVEL_HEIGHT / 2, askWidth, LEVEL_HEIGHT);

      if (barWidth > 30) {
        canvasCtx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
        const bidText = formatVolume(level.bidVol);
        const askText = formatVolume(level.askVol);
        canvasCtx.textAlign = 'right';
        canvasCtx.fillText(bidText, barCenterX - 2, y);
        canvasCtx.textAlign = 'left';
        canvasCtx.fillText(askText, barCenterX + 2, y);
      }
    }
  }

  canvasCtx.globalAlpha = 1;
  canvasCtx.restore();
};
