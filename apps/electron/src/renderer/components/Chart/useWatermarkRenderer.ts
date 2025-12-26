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

    const marketLabel = marketType === 'FUTURES' ? 'FUTURES' : '';
    const text = timeframe
      ? `${symbol} ${timeframe}${marketLabel ? ` ${marketLabel}` : ''}`
      : `${symbol}${marketLabel ? ` ${marketLabel}` : ''}`;

    ctx.globalAlpha = 0.05;
    ctx.font = 'bold 96px sans-serif';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;

    ctx.fillText(text, centerX, centerY);

    ctx.restore();
  }, [manager, colors, symbol, timeframe, marketType, enabled]);

  return { render };
};
