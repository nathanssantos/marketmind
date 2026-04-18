import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_POINT_COLOR = '#ff5722';
const DEFAULT_RADIUS = 2;

export const renderOverlayPoints: GenericRenderer = (ctx, input) => {
  const { manager } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const primaryOutput = input.definition.outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  const { chartWidth, chartHeight } = dimensions;
  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  const color = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_POINT_COLOR;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  canvasCtx.fillStyle = color;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = series[i];
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    const x = manager.indexToX(i);
    const y = manager.priceToY(value);
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, DEFAULT_RADIUS, 0, Math.PI * 2);
    canvasCtx.fill();
  }

  canvasCtx.restore();
};
