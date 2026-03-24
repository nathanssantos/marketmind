import type { LiquidityLevel } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';

interface UseLiquidityLevelsRendererProps {
  manager: CanvasManager | null;
  liquidityData: LiquidityLevel[] | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useLiquidityLevelsRenderer = ({
  manager,
  liquidityData,
  colors,
  enabled = true,
}: UseLiquidityLevelsRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !liquidityData || liquidityData.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const topLevels = liquidityData.slice(0, 10);

    for (const level of topLevels) {
      const y = manager.priceToY(level.price);

      if (y < 0 || y > chartHeight) continue;

      const isResistance = level.type === 'resistance';

      ctx.strokeStyle = isResistance
        ? (colors.liquidityLevels?.resistance ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE)
        : (colors.liquidityLevels?.support ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT);
      ctx.lineWidth = Math.max(1, level.touches * 0.5);
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const labelBg = isResistance
        ? (colors.liquidityLevels?.resistanceBg ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE_BG)
        : (colors.liquidityLevels?.supportBg ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT_BG);

      const label = `${level.type.charAt(0).toUpperCase()} (${level.touches})`;
      ctx.font = '9px monospace';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = labelBg;
      ctx.fillRect(effectiveWidth - textWidth - 8, y - 8, textWidth + 6, 16);

      ctx.fillStyle = isResistance
        ? (colors.liquidityLevels?.resistance ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE)
        : (colors.liquidityLevels?.support ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, effectiveWidth - 4, y);
    }

    ctx.restore();
  }, [manager, liquidityData, enabled, colors]);

  return { render };
};
