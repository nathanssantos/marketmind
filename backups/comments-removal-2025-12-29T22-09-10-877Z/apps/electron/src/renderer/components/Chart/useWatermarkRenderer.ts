import type { MarketType } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

export interface UseWatermarkRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  symbol?: string;
  timeframe?: string;
  marketType?: MarketType;
  enabled?: boolean;
}

export interface UseWatermarkRendererReturn {
  render: () => void;
}

export const useWatermarkRenderer = ({
  manager,
  colors,
  symbol,
  timeframe,
  marketType,
  enabled = true,
}: UseWatermarkRendererProps): UseWatermarkRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !symbol) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;

    ctx.save();

    const mainText = timeframe ? `${symbol} ${timeframe}` : symbol;
    const marketLabel = marketType === 'FUTURES' ? 'FUTURES' : '';

    const minDimension = Math.min(chartWidth, chartHeight);
    const baseFontSize = Math.max(24, Math.min(96, minDimension * 0.12));
    const secondaryFontSize = baseFontSize * 0.5;

    ctx.globalAlpha = 0.05;
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;

    if (marketLabel) {
      const lineSpacing = baseFontSize * 0.4;
      ctx.font = `bold ${baseFontSize}px sans-serif`;
      ctx.fillText(mainText, centerX, centerY - lineSpacing);

      ctx.font = `bold ${secondaryFontSize}px sans-serif`;
      ctx.fillText(marketLabel, centerX, centerY + lineSpacing);
    } else {
      ctx.font = `bold ${baseFontSize}px sans-serif`;
      ctx.fillText(mainText, centerX, centerY);
    }

    ctx.restore();
  }, [manager, colors, symbol, timeframe, marketType, enabled]);

  return { render };
};
