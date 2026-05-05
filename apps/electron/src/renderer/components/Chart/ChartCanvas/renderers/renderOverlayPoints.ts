import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { queuePriceTag } from '../../utils/priceTagBuffer';
import { formatChartPrice } from '@renderer/utils/formatters';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_POINT_COLOR = '#ff5722';
const DEFAULT_RADIUS = 2;

export const renderOverlayPoints: GenericRenderer = (ctx, input) => {
  const { manager } = ctx;
  const canvasCtx = manager.getContext();
  if (!canvasCtx) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const primaryOutput = input.definition.outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  const color = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_POINT_COLOR;

  canvasCtx.fillStyle = color;
  let lastValue: number | null = null;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = series[i];
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    const x = manager.indexToCenterX(i);
    const y = manager.priceToY(value);
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, DEFAULT_RADIUS, 0, Math.PI * 2);
    canvasCtx.fill();
    lastValue = value;
  }

  if (lastValue === null) return;
  const dimensions = manager.getDimensions();
  if (!dimensions) return;
  const tagY = manager.priceToY(lastValue);
  if (tagY < 0 || tagY > dimensions.chartHeight) return;
  queuePriceTag(manager, {
    priceText: formatChartPrice(lastValue),
    y: tagY,
    fillColor: color,
    width: CHART_CONFIG.CANVAS_PADDING_RIGHT,
  });
};
