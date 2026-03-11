import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import type { OrderPreview } from '../useChartState';

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
  orderPreview: OrderPreview | null;
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
  orderPreview,
  renderFunctions,
  isAutoTradingActive,
  dragPreview,
}: OverlayLayerProps): OverlayLayerResult => {
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
