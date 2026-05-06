import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { Kline } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';

export interface KlineHoverHitTestParams {
  manager: CanvasManager;
  mouseX: number;
  mouseY: number;
  klines: Kline[];
  advancedConfig?: AdvancedControlsConfig;
  showVolume: boolean;
  setHoveredKline: (kline: Kline | null, klineIndex?: number) => void;
}

export const processKlineHoverHitTest = ({
  manager,
  mouseX,
  mouseY,
  klines,
  advancedConfig,
  showVolume,
  setHoveredKline,
}: KlineHoverHitTestParams): void => {
  const viewport = manager.getViewport();
  const dimensions = manager.getDimensions();
  const bounds = manager.getBounds();

  if (!dimensions || !bounds) return;

  const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
  const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

  const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
  const isOnTimeScale = mouseY >= timeScaleTop;
  const isInChartArea = mouseX < dimensions.chartWidth && mouseY < timeScaleTop;

  if (isOnPriceScale || isOnTimeScale || !isInChartArea) {
    setHoveredKline(null);
    return;
  }

  const visibleRange = viewport.end - viewport.start;
  const widthPerKline = dimensions.chartWidth / visibleRange;
  const hoveredIndex = Math.floor(viewport.start + (mouseX / dimensions.chartWidth) * visibleRange);

  if (hoveredIndex < 0 || hoveredIndex >= klines.length) {
    setHoveredKline(null);
    return;
  }

  const kline = klines[hoveredIndex];
  if (!kline) {
    setHoveredKline(null);
    return;
  }

  const relativeIndex = hoveredIndex - viewport.start;
  const hitAreaLeft = relativeIndex * widthPerKline;
  const hitAreaRight = hitAreaLeft + widthPerKline;

  const openY = manager.priceToY(getKlineOpen(kline));
  const closeY = manager.priceToY(getKlineClose(kline));
  const highY = manager.priceToY(getKlineHigh(kline));
  const lowY = manager.priceToY(getKlineLow(kline));
  const bodyTop = Math.min(openY, closeY);
  const bodyBottom = Math.max(openY, closeY);

  const volumeHeightRatio = advancedConfig?.volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO;
  const volumeOverlayHeight = dimensions.chartHeight * volumeHeightRatio;
  const volumeBaseY = dimensions.chartHeight;
  const volumeRatio = getKlineVolume(kline) / bounds.maxVolume;
  const barHeight = volumeRatio * volumeOverlayHeight;
  const volumeTop = volumeBaseY - barHeight;

  const onX = mouseX >= hitAreaLeft && mouseX <= hitAreaRight;
  const isOnKlineBody = onX && mouseY >= bodyTop && mouseY <= bodyBottom;
  const isOnKlineWick = onX && mouseY >= highY && mouseY <= lowY;
  const isOnVolumeBar = showVolume && onX && mouseY >= volumeTop && mouseY <= volumeBaseY;

  if (isOnKlineBody || isOnKlineWick || isOnVolumeBar) {
    setHoveredKline(kline, hoveredIndex);
    return;
  }

  setHoveredKline(null);
};
