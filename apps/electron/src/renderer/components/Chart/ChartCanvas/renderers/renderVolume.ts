import { drawRect } from '@renderer/utils/canvas/drawingUtils';
import { calculateVolumeMA, getVolumeMAPeriod } from '@renderer/utils/indicators/volume';
import { CHART_CONFIG, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
import type { GenericRenderer } from './types';

const VOLUME_OPACITY = 0.3;
const HOVER_OPACITY_MULTIPLIER = 2.5;

export const renderVolume: GenericRenderer = (ctx, _input) => {
  const { manager, colors, external } = ctx;
  const canvasCtx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();
  const bounds = manager.getBounds();
  const klines = manager.getKlines();

  if (!canvasCtx || !dimensions || !bounds || !klines) return;

  const visibleKlines = manager.getVisibleKlines();
  const { chartHeight, chartWidth } = dimensions;
  const { klineWidth } = viewport;
  const visibleRange = viewport.end - viewport.start;
  const widthPerKline = chartWidth / visibleRange;

  const volumeHeightRatio = external?.volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO;
  const hoveredKlineIndex = external?.hoveredKlineIndex;
  const timeframe = external?.timeframe ?? '1h';

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const volumeOverlayHeight = chartHeight * volumeHeightRatio;
  const volumeBaseY = chartHeight;
  const lastKlineIndex = klines.length - 1;

  visibleKlines.forEach((kline, index) => {
    const actualIndex = Math.floor(viewport.start) + index;
    const x = manager.indexToX(actualIndex);
    if (x + klineWidth < 0 || x > chartWidth) return;

    const barX = x + (widthPerKline - klineWidth) / 2;
    const volumeRatio = getKlineVolume(kline) / bounds.maxVolume;
    const barHeight = volumeRatio * volumeOverlayHeight;

    const isBullish = getKlineClose(kline) >= getKlineOpen(kline);
    const baseColor = isBullish ? colors.bullish : colors.bearish;
    const isHovered = hoveredKlineIndex === actualIndex;
    const isLastKline = actualIndex === lastKlineIndex;

    const volumeOpacity = isHovered ? VOLUME_OPACITY * HOVER_OPACITY_MULTIPLIER : VOLUME_OPACITY;
    const rgbMatch = baseColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    const finalColor = rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]
      ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${volumeOpacity})`
      : `rgba(120, 120, 120, ${volumeOpacity})`;

    if (isHovered) {
      canvasCtx.save();
      canvasCtx.shadowColor = baseColor;
      canvasCtx.shadowBlur = 6;
    }

    drawRect(canvasCtx, barX, volumeBaseY - barHeight, klineWidth, barHeight, finalColor);

    if (isHovered) canvasCtx.restore();

    if (isLastKline) {
      const now = Date.now();
      const totalDuration = kline.closeTime - kline.openTime;
      const elapsedTime = now - kline.openTime;

      if (totalDuration > 0 && elapsedTime > 0 && elapsedTime < totalDuration) {
        const timeProgress = elapsedTime / totalDuration;
        const currentVolume = getKlineVolume(kline);
        const projectedVolume = currentVolume / timeProgress;
        const projectedRatio = projectedVolume / bounds.maxVolume;
        const projectedHeight = Math.min(projectedRatio * volumeOverlayHeight, volumeOverlayHeight);

        if (projectedHeight > barHeight) {
          const projectionColor = rgbMatch?.[1] && rgbMatch[2] && rgbMatch[3]
            ? `rgba(${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}, ${VOLUME_OPACITY * 0.8})`
            : `rgba(120, 120, 120, ${VOLUME_OPACITY * 0.8})`;

          canvasCtx.save();
          canvasCtx.setLineDash([4, 2]);
          canvasCtx.strokeStyle = projectionColor;
          canvasCtx.lineWidth = 2;

          const lineOffset = 1;
          const topY = volumeBaseY - projectedHeight;
          const leftX = barX + lineOffset;
          const rightX = barX + klineWidth - lineOffset;

          canvasCtx.beginPath();
          canvasCtx.moveTo(leftX, topY);
          canvasCtx.lineTo(rightX, topY);
          canvasCtx.moveTo(rightX, topY);
          canvasCtx.lineTo(rightX, volumeBaseY - barHeight);
          canvasCtx.moveTo(leftX, topY);
          canvasCtx.lineTo(leftX, volumeBaseY - barHeight);
          canvasCtx.stroke();

          canvasCtx.restore();
        }
      }
    }
  });

  if (klines.length > 0) {
    const period = getVolumeMAPeriod(timeframe);
    const volumeMA = calculateVolumeMA(klines, period);

    canvasCtx.strokeStyle = colors.volume;
    canvasCtx.globalAlpha = 0.5;
    canvasCtx.lineWidth = INDICATOR_LINE_WIDTHS.VOLUME_MA;
    canvasCtx.beginPath();

    let hasMovedTo = false;

    visibleKlines.forEach((_, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const maValue = volumeMA.values[actualIndex];
      if (maValue === null || maValue === undefined) return;

      const xPos = manager.indexToX(actualIndex);
      if (xPos + klineWidth < 0 || xPos > chartWidth) return;

      const barX = xPos + (widthPerKline - klineWidth) / 2 + klineWidth / 2;
      const ratio = maValue / bounds.maxVolume;
      const y = volumeBaseY - (ratio * volumeOverlayHeight);

      if (!hasMovedTo) {
        canvasCtx.moveTo(barX, y);
        hasMovedTo = true;
      } else {
        canvasCtx.lineTo(barX, y);
      }
    });

    canvasCtx.stroke();
    canvasCtx.globalAlpha = 1;
  }

  canvasCtx.restore();
};
