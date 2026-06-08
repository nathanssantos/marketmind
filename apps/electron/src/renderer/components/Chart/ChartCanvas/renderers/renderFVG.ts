import { calculateFVG } from '@renderer/lib/indicators/fvg';
import { INDICATOR_COLORS } from '@shared/constants';
import { drawZoneArea } from './drawZoneArea';
import type { GenericRenderer } from './types';

const FVG_BORDER_DASH: number[] = [4, 2];
const FVG_VISIBLE_LOOKAHEAD = 50;

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

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const visibleEndIndex = Math.ceil(viewport.end);

  for (const gap of fvgData.gaps) {
    if (gap.filled) continue;
    if (gap.index > visibleEndIndex + FVG_VISIBLE_LOOKAHEAD) continue;

    const startX = Math.max(0, manager.indexToX(gap.index));
    if (chartWidth - startX <= 0) continue;

    const topY = manager.priceToY(gap.high);
    const bottomY = manager.priceToY(gap.low);
    if (topY > chartHeight || bottomY < 0) continue;

    const isBullish = gap.type === 'bullish';

    drawZoneArea(canvasCtx, {
      left: startX,
      right: chartWidth,
      topY,
      bottomY,
      fillColor: isBullish
        ? (colors.fvg?.bullish ?? INDICATOR_COLORS.FVG_BULLISH)
        : (colors.fvg?.bearish ?? INDICATOR_COLORS.FVG_BEARISH),
      borderColor: isBullish
        ? (colors.fvg?.bullishBorder ?? INDICATOR_COLORS.FVG_BULLISH_BORDER)
        : (colors.fvg?.bearishBorder ?? INDICATOR_COLORS.FVG_BEARISH_BORDER),
      borderDash: FVG_BORDER_DASH,
    });
  }

  canvasCtx.restore();
};
