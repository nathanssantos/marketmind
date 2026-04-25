import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { Kline, MarketEvent, Order } from '@marketmind/types';
import type { TooltipData } from './useChartState';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';

export interface TooltipHitTestParams {
  manager: CanvasManager;
  mouseX: number;
  mouseY: number;
  rect: DOMRect;
  klines: Kline[];
  advancedConfig?: AdvancedControlsConfig;
  showVolume: boolean;
  showEventRow: boolean;
  lastTooltipOrderRef: React.MutableRefObject<string | null>;
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
  advancedConfig,
  showVolume,
  showEventRow,
  lastTooltipOrderRef,
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

  if (isOnPriceScale) {
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
  const hoveredOrderIdForTooltip = hoveredOrderForTooltip?.id ?? null;

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

  hoveredMAIndexRef.current = undefined;

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
