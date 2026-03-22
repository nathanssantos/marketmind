import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import type { Kline, MarketEvent, Order } from '@marketmind/types';
import type { TooltipData } from './useChartState';
import { pointToLineDistance } from '@marketmind/chart-studies';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';

const HOVER_THRESHOLD = 8;

export interface TooltipHitTestParams {
  manager: CanvasManager;
  mouseX: number;
  mouseY: number;
  rect: DOMRect;
  klines: Kline[];
  movingAverages: MovingAverageConfig[];
  maValuesCache: Map<string, (number | null)[]>;
  advancedConfig?: AdvancedControlsConfig;
  showVolume: boolean;
  showEventRow: boolean;
  lastTooltipOrderRef: React.MutableRefObject<string | null>;
  getHoveredMATag: (x: number, y: number) => number | undefined;
  getHoveredOrder: (x: number, y: number) => Order | null;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
  hoveredMAIndexRef: React.MutableRefObject<number | undefined>;
  setTooltipData: (data: TooltipData) => void;
}

export const processTooltipHitTest = ({
  manager,
  mouseX,
  mouseY,
  rect,
  klines,
  movingAverages,
  maValuesCache,
  advancedConfig,
  showVolume,
  showEventRow,
  lastTooltipOrderRef,
  getHoveredMATag,
  getHoveredOrder,
  getEventAtPosition,
  hoveredMAIndexRef,
  setTooltipData,
}: TooltipHitTestParams): void => {
  const viewport = manager.getViewport();
  const dimensions = manager.getDimensions();
  const bounds = manager.getBounds();

  if (!dimensions || !bounds) return;

  const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
  const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

  const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
  const isOnTimeScale = mouseY >= timeScaleTop;
  const isInChartArea = mouseX < dimensions.chartWidth && mouseY < timeScaleTop;

  const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

  if (isOnPriceScale && hoveredTagIndex === undefined) {
    hoveredMAIndexRef.current = undefined;
    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    return;
  }

  if (isOnTimeScale) {
    hoveredMAIndexRef.current = undefined;
    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    return;
  }

  if (showEventRow && manager) {
    const eventRowY = manager.getEventRowY();
    const eventRowHeight = manager.getEventRowHeight();
    if (mouseY >= eventRowY && mouseY <= eventRowY + eventRowHeight) {
      const event = getEventAtPosition(mouseX, mouseY);
      if (event) {
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect.width, containerHeight: rect.height,
          marketEvent: event,
        });
        return;
      }
    }
  }

  const hoveredOrderForTooltip = getHoveredOrder(mouseX, mouseY);
  const hoveredOrderIdForTooltip = hoveredOrderForTooltip?.id || null;

  if (hoveredOrderForTooltip && klines.length > 0) {
    if (hoveredOrderIdForTooltip !== lastTooltipOrderRef.current) {
      lastTooltipOrderRef.current = hoveredOrderIdForTooltip;
      const lastKline = klines[klines.length - 1];
      const currentPriceVal = lastKline ? getKlineClose(lastKline) : undefined;
      setTooltipData({
        kline: null, x: mouseX, y: mouseY, visible: true,
        containerWidth: rect?.width, containerHeight: rect?.height,
        order: hoveredOrderForTooltip,
        ...(currentPriceVal && { currentPrice: currentPriceVal }),
      });
    }
    return;
  }

  if (!hoveredOrderForTooltip && lastTooltipOrderRef.current) {
    lastTooltipOrderRef.current = null;
    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    return;
  }

  let closestMAIndex: number | undefined = undefined;
  let closestMADistance = Infinity;
  let closestMAValue: number | undefined = undefined;

  if (hoveredTagIndex !== undefined) {
    closestMAIndex = hoveredTagIndex;
  } else if (movingAverages.length > 0) {
    const effectiveWidth = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

    for (let maIdx = 0; maIdx < movingAverages.length; maIdx++) {
      const ma = movingAverages[maIdx];
      if (!ma || ma.visible === false) continue;
      const cacheKey = `${ma.type}-${ma.period}`;
      const maValues = maValuesCache.get(cacheKey);
      if (!maValues) continue;

      const startIdx = Math.max(0, Math.floor(viewport.start));
      const endIdx = Math.min(klines.length, Math.ceil(viewport.end));

      for (let i = startIdx; i < endIdx - 1; i++) {
        const value1 = maValues[i];
        const value2 = maValues[i + 1];
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) continue;

        const x1 = manager.indexToX(i) + klineCenterOffset;
        const y1 = manager.priceToY(value1);
        const x2 = manager.indexToX(i + 1) + klineCenterOffset;
        const y2 = manager.priceToY(value2);
        const distance = pointToLineDistance(mouseX, mouseY, x1, y1, x2, y2);

        if (distance < HOVER_THRESHOLD && distance < closestMADistance) {
          closestMADistance = distance;
          closestMAIndex = maIdx;
          closestMAValue = (value1 + value2) / 2;
        }
      }
      if (closestMADistance < HOVER_THRESHOLD * 0.5) break;
    }
  }

  hoveredMAIndexRef.current = closestMAIndex;

  if (closestMAIndex !== undefined) {
    const ma = movingAverages[closestMAIndex];
    if (ma) {
      setTooltipData({
        kline: null, x: mouseX, y: mouseY, visible: true,
        containerWidth: rect.width, containerHeight: rect.height,
        movingAverage: { period: ma.period, type: ma.type, color: ma.color, ...(closestMAValue !== undefined && { value: closestMAValue }) },
      });
      return;
    }
  }

  if (!isInChartArea) {
    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    return;
  }

  const visibleRange = viewport.end - viewport.start;
  const widthPerKline = dimensions.chartWidth / visibleRange;
  const hoveredIndex = Math.floor(viewport.start + (mouseX / dimensions.chartWidth) * visibleRange);

  if (hoveredIndex >= 0 && hoveredIndex < klines.length) {
    const kline = klines[hoveredIndex];
    if (kline) {
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

      const isOnKlineBody = mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= bodyTop && mouseY <= bodyBottom;
      const isOnKlineWick = mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= highY && mouseY <= lowY;
      const isOnVolumeBar = showVolume && mouseX >= hitAreaLeft && mouseX <= hitAreaRight && mouseY >= volumeTop && mouseY <= volumeBaseY;

      if (isOnKlineBody || isOnKlineWick || isOnVolumeBar) {
        setTooltipData({
          kline, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect.width, containerHeight: rect.height, klineIndex: hoveredIndex,
        });
        return;
      }
    }
  }

  setTooltipData({ kline: null, x: 0, y: 0, visible: false });
};
