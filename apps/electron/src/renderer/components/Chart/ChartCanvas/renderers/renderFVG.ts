import { calculateFVG } from '@renderer/lib/indicators/fvg';
import { CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import type { GenericRenderer } from './types';

export const renderFVG: GenericRenderer = (ctx, _input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const klines = manager.getKlines();
  if (!klines.length) return;

  const fvgData = calculateFVG(klines);
  if (!fvgData.gaps.length) return;

  const viewport = manager.getViewport();
  const { chartWidth, chartHeight } = dimensions;
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const visibleEndIndex = Math.ceil(viewport.end);

  for (const gap of fvgData.gaps) {
    if (gap.filled) continue;
    if (gap.index > visibleEndIndex + 50) continue;

    const rawStartX = manager.indexToX(gap.index);
    const startX = Math.max(0, rawStartX);
    const drawWidth = effectiveWidth - startX;
    if (drawWidth <= 0) continue;

    const topY = manager.priceToY(gap.high);
    const bottomY = manager.priceToY(gap.low);
    const height = Math.abs(bottomY - topY);

    if (topY > chartHeight || bottomY < 0) continue;

    const isBullish = gap.type === 'bullish';
    canvasCtx.fillStyle = isBullish
      ? (colors.fvg?.bullish ?? INDICATOR_COLORS.FVG_BULLISH)
      : (colors.fvg?.bearish ?? INDICATOR_COLORS.FVG_BEARISH);

    canvasCtx.fillRect(startX, Math.min(topY, bottomY), drawWidth, height);

    canvasCtx.strokeStyle = isBullish
      ? (colors.fvg?.bullishBorder ?? INDICATOR_COLORS.FVG_BULLISH_BORDER)
      : (colors.fvg?.bearishBorder ?? INDICATOR_COLORS.FVG_BEARISH_BORDER);
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash([4, 2]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, topY);
    canvasCtx.lineTo(effectiveWidth, topY);
    canvasCtx.moveTo(startX, bottomY);
    canvasCtx.lineTo(effectiveWidth, bottomY);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);
  }

  canvasCtx.restore();
};
