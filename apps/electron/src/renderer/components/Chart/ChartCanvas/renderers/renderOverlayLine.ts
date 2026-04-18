import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_OVERLAY_COLOR = '#2196f3';
const DEFAULT_LINE_WIDTH = 1;

export const renderOverlayLine: GenericRenderer = (ctx, input) => {
  const { manager } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const { chartWidth, chartHeight } = dimensions;
  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  const color = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_OVERLAY_COLOR;
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? DEFAULT_LINE_WIDTH) as number;

  const outputs = input.definition.outputs;
  const primaryOutput = outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = lineWidth;
  canvasCtx.beginPath();

  let started = false;
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
  }
  canvasCtx.stroke();
  canvasCtx.restore();
};
