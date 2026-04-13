import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { FootprintBar } from '@marketmind/types';
import { ORDER_LINE_COLORS } from '@shared/constants/chartColors';
import { useCallback } from 'react';

interface UseFootprintRendererProps {
  manager: CanvasManager | null;
  footprintBars: FootprintBar[];
  colors: ChartThemeColors;
  enabled?: boolean;
}

const LEVEL_HEIGHT = 12;
const FONT_SIZE = 9;
const BAR_OPACITY = 0.7;

export const useFootprintRenderer = ({
  manager,
  footprintBars,
  colors,
  enabled = true,
}: UseFootprintRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || footprintBars.length === 0) return;

    const ctx = manager.getContext();
    if (!ctx) return;

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    const chartHeight = viewport.height;
    const clipHeight = dimensions.chartHeight ?? chartHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dimensions.chartWidth, clipHeight);
    ctx.clip();
    ctx.font = `${FONT_SIZE}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = BAR_OPACITY;

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

        ctx.fillStyle = colors.bullish;
        ctx.fillRect(barCenterX - halfWidth, y - LEVEL_HEIGHT / 2, bidWidth, LEVEL_HEIGHT);

        ctx.fillStyle = colors.bearish;
        ctx.fillRect(barCenterX - halfWidth + bidWidth, y - LEVEL_HEIGHT / 2, askWidth, LEVEL_HEIGHT);

        if (barWidth > 30) {
          ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
          const bidText = formatVolume(level.bidVol);
          const askText = formatVolume(level.askVol);
          ctx.textAlign = 'right';
          ctx.fillText(bidText, barCenterX - 2, y);
          ctx.textAlign = 'left';
          ctx.fillText(askText, barCenterX + 2, y);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [manager, footprintBars, enabled, colors]);

  return { render };
};

const priceToY = (price: number, priceMin: number, priceMax: number, height: number): number => {
  if (priceMax === priceMin) return height / 2;
  return height - ((price - priceMin) / (priceMax - priceMin)) * height;
};

const formatVolume = (vol: number): string => {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  if (vol >= 1) return vol.toFixed(1);
  return vol.toFixed(3);
};
