import { calculateLiquidityLevels } from '@renderer/lib/indicators/liquidityLevels';
import { CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import type { GenericRenderer } from './types';

const MAX_RENDERED_LEVELS = 10;

export const renderLiquidityLevels: GenericRenderer = (ctx, _input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const klines = manager.getKlines();
  if (!klines.length) return;

  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  for (const k of klines) {
    highs.push(parseFloat(k.high));
    lows.push(parseFloat(k.low));
    closes.push(parseFloat(k.close));
  }

  const levels = calculateLiquidityLevels(highs, lows, closes);
  if (!levels.length) return;

  const { chartWidth, chartHeight } = dimensions;
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const topLevels = levels.slice(0, MAX_RENDERED_LEVELS);

  for (const level of topLevels) {
    const y = manager.priceToY(level.price);
    if (y < 0 || y > chartHeight) continue;

    const isResistance = level.type === 'resistance';

    canvasCtx.strokeStyle = isResistance
      ? (colors.liquidityLevels?.resistance ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE)
      : (colors.liquidityLevels?.support ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT);
    canvasCtx.lineWidth = Math.max(1, level.touches * 0.5);
    canvasCtx.setLineDash([8, 4]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, y);
    canvasCtx.lineTo(effectiveWidth, y);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);

    const labelBg = isResistance
      ? (colors.liquidityLevels?.resistanceBg ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE_BG)
      : (colors.liquidityLevels?.supportBg ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT_BG);

    const label = `${level.type.charAt(0).toUpperCase()} (${level.touches})`;
    canvasCtx.font = '9px monospace';
    const textWidth = canvasCtx.measureText(label).width;

    canvasCtx.fillStyle = labelBg;
    canvasCtx.fillRect(effectiveWidth - textWidth - 8, y - 8, textWidth + 6, 16);

    canvasCtx.fillStyle = isResistance
      ? (colors.liquidityLevels?.resistance ?? INDICATOR_COLORS.LIQUIDITY_RESISTANCE)
      : (colors.liquidityLevels?.support ?? INDICATOR_COLORS.LIQUIDITY_SUPPORT);
    canvasCtx.textAlign = 'right';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(label, effectiveWidth - 4, y);
  }

  canvasCtx.restore();
};
