import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_OVERLAY_COLOR = '#2196f3';
const DEFAULT_LINE_WIDTH = 1;

export const renderOverlayLine: GenericRenderer = (ctx, input) => {
  const { manager } = ctx;
  const canvasCtx = manager.getContext();
  if (!canvasCtx) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  const color = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_OVERLAY_COLOR;
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? DEFAULT_LINE_WIDTH);

  const outputs = input.definition.outputs;
  const primaryOutput = outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = lineWidth;
  canvasCtx.beginPath();

  let started = false;
  let lastValue: number | null = null;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = series[i];
    if (value === null || value === undefined || Number.isNaN(value)) {
      started = false;
      continue;
    }
    const x = manager.indexToCenterX(i);
    const y = manager.priceToY(value);
    if (!started) {
      canvasCtx.moveTo(x, y);
      started = true;
    } else {
      canvasCtx.lineTo(x, y);
    }
    lastValue = value;
  }
  canvasCtx.stroke();

  // Right-axis price tag for the indicator's last visible value. Mirrors
  // the legacy MA renderer's tag pass (dropped in 398bc71b alongside the
  // generic pipeline cutover) so EMAs/SMAs/etc. show their current value
  // on the price scale.
  if (lastValue === null) return;
  const dimensions = manager.getDimensions();
  if (!dimensions) return;
  const tagY = manager.priceToY(lastValue);
  if (tagY < 0 || tagY > dimensions.chartHeight) return;
  drawPriceTag(
    canvasCtx,
    formatChartPrice(lastValue),
    tagY,
    dimensions.chartWidth,
    color,
    CHART_CONFIG.CANVAS_PADDING_RIGHT,
  );
};
