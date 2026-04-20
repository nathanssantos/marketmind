import type { Kline } from '@marketmind/types';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';
import { calculateVolumeMA, getVolumeMAPeriod, type VolumeMovingAverage } from '@renderer/utils/indicators/volume';
import { CHART_CONFIG, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
import type { GenericRenderer } from './types';

const VOLUME_OPACITY = 0.3;
const HOVER_OPACITY_MULTIPLIER = 2.5;

interface VolumeMACache {
  klines: Kline[];
  length: number;
  lastCloseTime: number;
  lastVolume: string | number;
  period: number;
  result: VolumeMovingAverage;
}

let volumeMACache: VolumeMACache | null = null;

const getCachedVolumeMA = (klines: Kline[], period: number): VolumeMovingAverage => {
  const length = klines.length;
  if (length === 0) return { values: [], period };
  const last = klines[length - 1]!;
  if (
    volumeMACache
    && volumeMACache.klines === klines
    && volumeMACache.length === length
    && volumeMACache.lastCloseTime === last.closeTime
    && volumeMACache.lastVolume === last.volume
    && volumeMACache.period === period
  ) {
    return volumeMACache.result;
  }
  const result = calculateVolumeMA(klines, period);
  volumeMACache = { klines, length, lastCloseTime: last.closeTime, lastVolume: last.volume, period, result };
  return result;
};

interface RgbCache {
  r: number;
  g: number;
  b: number;
}
const rgbColorCache = new Map<string, RgbCache | null>();

const parseHexColor = (color: string): RgbCache | null => {
  const cached = rgbColorCache.get(color);
  if (cached !== undefined) return cached;
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const parsed: RgbCache | null = m?.[1] && m[2] && m[3]
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null;
  rgbColorCache.set(color, parsed);
  return parsed;
};

const toRgba = (rgb: RgbCache | null, alpha: number): string =>
  rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : `rgba(120, 120, 120, ${alpha})`;

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
    const rgb = parseHexColor(baseColor);
    const finalColor = toRgba(rgb, volumeOpacity);

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
          const projectionColor = toRgba(rgb, VOLUME_OPACITY * 0.8);

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
    const volumeMA = getCachedVolumeMA(klines, period);

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
