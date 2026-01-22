import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import type { MeasurementArea, OrderPreview } from '../useChartState';

export interface OverlayRenderFunctions {
  renderCurrentPriceLine_Line?: () => void;
  renderCurrentPriceLine_Label?: () => void;
  renderCrosshairPriceLine?: () => void;
  renderOrderLines?: () => void;
  renderEventScale?: () => void;
}

export interface OverlayLayerProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  mousePosition: { x: number; y: number } | null;
  measurementArea: MeasurementArea | null;
  isMeasuring: boolean;
  orderPreview: OrderPreview | null;
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  showCrosshair: boolean;
  showCurrentPriceLine: boolean;
  showEventRow: boolean;
  renderFunctions: OverlayRenderFunctions;
  isAutoTradingActive: boolean;
  dragPreview?: {
    y: number;
    color: string;
    label: string;
  } | null;
}

export interface OverlayLayerResult {
  render: () => void;
  shouldRerender: () => boolean;
}

export const createOverlayLayer = ({
  manager,
  colors,
  measurementArea,
  isMeasuring,
  orderPreview,
  showMeasurementRuler,
  showMeasurementArea,
  renderFunctions,
  isAutoTradingActive,
  dragPreview,
}: OverlayLayerProps): OverlayLayerResult => {
  const renderMeasurement = (): void => {
    if (!manager || !measurementArea || !isMeasuring) return;

    const ctx = manager.getContext();
    if (!ctx) return;

    const { startX, startY, endX, endY } = measurementArea;
    const startPrice = manager.yToPrice(startY);
    const endPrice = manager.yToPrice(endY);
    const priceChange = endPrice - startPrice;
    const isPositive = priceChange >= 0;

    ctx.save();

    if (showMeasurementArea) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
      ctx.fillRect(
        Math.min(startX, endX),
        Math.min(startY, endY),
        Math.abs(endX - startX),
        Math.abs(endY - startY)
      );

      ctx.strokeStyle = colors.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        Math.min(startX, endX),
        Math.min(startY, endY),
        Math.abs(endX - startX),
        Math.abs(endY - startY)
      );
    }

    if (showMeasurementRuler) {
      ctx.strokeStyle = isPositive ? colors.bullish : colors.bearish;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderOrderPreviewLine = (): void => {
    if (!manager || !orderPreview || isAutoTradingActive) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const y = manager.priceToY(orderPreview.price);
    const isLong = orderPreview.type === 'long';
    const color = isLong ? colors.bullish : colors.bearish;
    const opacity = 0.5;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dimensions.chartWidth, y);
    ctx.stroke();

    ctx.restore();
  };

  const renderDragPreviewLine = (): void => {
    if (!manager || !dragPreview) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const { y, color, label } = dragPreview;

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dimensions.chartWidth, y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const labelPadding = 8;
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const labelHeight = 18;
    const arrowWidth = 6;
    const labelWidth = textWidth + labelPadding * 2;

    ctx.beginPath();
    ctx.moveTo(labelWidth + arrowWidth, y);
    ctx.lineTo(labelWidth, y - labelHeight / 2);
    ctx.lineTo(0, y - labelHeight / 2);
    ctx.lineTo(0, y + labelHeight / 2);
    ctx.lineTo(labelWidth, y + labelHeight / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, labelPadding, y);

    ctx.restore();
  };

  const render = (): void => {
    renderFunctions.renderCurrentPriceLine_Line?.();
    renderFunctions.renderOrderLines?.();
    renderDragPreviewLine();
    renderFunctions.renderCurrentPriceLine_Label?.();
    renderFunctions.renderCrosshairPriceLine?.();
    renderOrderPreviewLine();
    renderMeasurement();
    renderFunctions.renderEventScale?.();
  };

  const shouldRerender = (): boolean => {
    return true;
  };

  return {
    render,
    shouldRerender,
  };
};
