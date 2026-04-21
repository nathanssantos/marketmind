import type { GenericRenderer } from './types';

const MARKER_SIZE = 3.5;
const ESTIMATED_LINE_DASH = [6, 4];
const SELL_MARKER_FILL = 'rgba(255, 60, 60, 0.9)';
const BUY_MARKER_FILL = 'rgba(60, 255, 120, 0.9)';
const LONG_LIQ_LINE = 'rgba(255, 80, 80, 0.4)';
const SHORT_LIQ_LINE = 'rgba(80, 255, 140, 0.4)';

export const renderLiquidationMarkers: GenericRenderer = (ctx) => {
  const { manager, external } = ctx;
  const data = external?.liquidityHeatmapRef?.current;
  if (!data) return;

  const hasReal = (data.liquidations?.length ?? 0) > 0;
  const hasEstimated = (data.estimatedLevels?.length ?? 0) > 0;
  if (!hasReal && !hasEstimated) return;

  const canvasCtx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!canvasCtx || !dimensions || !klines || klines.length === 0) return;

  const { chartWidth, chartHeight } = dimensions;
  const startIdx = Math.max(0, Math.floor(viewport.start));
  const endIdx = Math.min(klines.length, Math.ceil(viewport.end));
  if (startIdx >= endIdx) return;

  const visibleRange = viewport.end - viewport.start;
  if (visibleRange <= 0) return;
  const colWidth = Math.max(1, chartWidth / visibleRange);

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  if (hasReal && data.liquidations) {
    for (const liq of data.liquidations) {
      const y = manager.priceToY(liq.price);
      if (y < 0 || y > chartHeight) continue;

      let liqX = -1;
      for (let i = startIdx; i < endIdx; i++) {
        if (klines[i]!.openTime <= liq.time && liq.time < klines[i]!.closeTime) {
          liqX = manager.indexToX(i) + colWidth / 2;
          break;
        }
      }
      if (liqX < 0) {
        if (liq.time >= klines[endIdx - 1]!.openTime) liqX = manager.indexToX(endIdx - 1) + colWidth / 2;
        else continue;
      }

      canvasCtx.fillStyle = liq.side === 'SELL' ? SELL_MARKER_FILL : BUY_MARKER_FILL;
      canvasCtx.beginPath();
      canvasCtx.arc(liqX, y, MARKER_SIZE, 0, Math.PI * 2);
      canvasCtx.fill();
    }
  }

  if (hasEstimated && data.estimatedLevels) {
    canvasCtx.setLineDash(ESTIMATED_LINE_DASH);
    canvasCtx.lineWidth = 1;
    for (const level of data.estimatedLevels) {
      const y = manager.priceToY(level.price);
      if (y < 0 || y > chartHeight) continue;
      canvasCtx.strokeStyle = level.side === 'LONG' ? LONG_LIQ_LINE : SHORT_LIQ_LINE;
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, y);
      canvasCtx.lineTo(chartWidth, y);
      canvasCtx.stroke();
    }
    canvasCtx.setLineDash([]);
  }

  canvasCtx.restore();
};
