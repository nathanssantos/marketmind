import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { VolumeProfile } from '@marketmind/types';
import { useCallback } from 'react';

interface UseVolumeProfileRendererProps {
  manager: CanvasManager | null;
  volumeProfile: VolumeProfile | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const MAX_BAR_WIDTH = 120;
const OPACITY = 0.3;
const POC_OPACITY = 0.6;
const VALUE_AREA_OPACITY = 0.15;

export const useVolumeProfileRenderer = ({
  manager,
  volumeProfile,
  colors,
  enabled = true,
}: UseVolumeProfileRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !volumeProfile || volumeProfile.levels.length === 0) return;

    const ctx = manager.getContext();
    if (!ctx) return;

    const viewport = manager.getViewport();
    const dims = manager.getDimensions();
    if (!dims) return;

    const chartWidth = dims.width;
    const chartHeight = viewport.height;

    const maxVolume = Math.max(...volumeProfile.levels.map((l) => l.volume));
    if (maxVolume <= 0) return;

    ctx.save();

    if (volumeProfile.valueAreaLow > 0 && volumeProfile.valueAreaHigh > 0) {
      const vaTopY = priceToY(volumeProfile.valueAreaHigh, viewport.priceMin, viewport.priceMax, chartHeight);
      const vaBottomY = priceToY(volumeProfile.valueAreaLow, viewport.priceMin, viewport.priceMax, chartHeight);

      ctx.fillStyle = `rgba(128, 128, 128, ${VALUE_AREA_OPACITY})`;
      ctx.fillRect(chartWidth - MAX_BAR_WIDTH, vaTopY, MAX_BAR_WIDTH, vaBottomY - vaTopY);
    }

    for (const level of volumeProfile.levels) {
      const y = priceToY(level.price, viewport.priceMin, viewport.priceMax, chartHeight);
      if (y < 0 || y > chartHeight) continue;

      const barWidth = (level.volume / maxVolume) * MAX_BAR_WIDTH;
      const x = chartWidth - barWidth;
      const barHeight = Math.max(1, chartHeight / volumeProfile.levels.length * 0.8);

      const isPOC = level.price === volumeProfile.poc;
      const buyRatio = level.volume > 0 ? level.buyVolume / level.volume : 0.5;

      const buyWidth = barWidth * buyRatio;
      const sellWidth = barWidth - buyWidth;

      ctx.globalAlpha = isPOC ? POC_OPACITY : OPACITY;

      ctx.fillStyle = colors.bullish;
      ctx.fillRect(x, y - barHeight / 2, buyWidth, barHeight);

      ctx.fillStyle = colors.bearish;
      ctx.fillRect(x + buyWidth, y - barHeight / 2, sellWidth, barHeight);

      if (isPOC) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [manager, volumeProfile, enabled, colors]);

  return { render };
};

const priceToY = (price: number, priceMin: number, priceMax: number, height: number): number => {
  if (priceMax === priceMin) return height / 2;
  return height - ((price - priceMin) / (priceMax - priceMin)) * height;
};
