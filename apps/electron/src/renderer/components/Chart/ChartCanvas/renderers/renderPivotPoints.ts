import { CHART_CONFIG } from '@shared/constants';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_HIGH_COLOR = '#ef4444';
const DEFAULT_LOW_COLOR = '#22c55e';
const DEFAULT_DOT_RADIUS = 4;
const DEFAULT_DOT_OFFSET_X = 3;

const drawPivotMarker = (
  canvasCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  effectiveWidth: number,
  color: string,
): void => {
  canvasCtx.beginPath();
  canvasCtx.arc(x + DEFAULT_DOT_OFFSET_X, y, DEFAULT_DOT_RADIUS, 0, Math.PI * 2);
  canvasCtx.fillStyle = color;
  canvasCtx.fill();

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 1;
  canvasCtx.setLineDash([4, 4]);
  canvasCtx.beginPath();
  canvasCtx.moveTo(x + DEFAULT_DOT_OFFSET_X, y);
  canvasCtx.lineTo(effectiveWidth, y);
  canvasCtx.stroke();
  canvasCtx.setLineDash([]);
};

export const renderPivotPoints: GenericRenderer = (ctx, input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const pivotHigh = input.values['pivotHigh'];
  const pivotLow = input.values['pivotLow'];
  if (!pivotHigh && !pivotLow) return;

  const highColor =
    getInstanceParam<string>(input.instance, input.definition, 'highColor') ??
    colors.pivotPoints?.resistance ??
    DEFAULT_HIGH_COLOR;
  const lowColor =
    getInstanceParam<string>(input.instance, input.definition, 'lowColor') ??
    colors.pivotPoints?.support ??
    DEFAULT_LOW_COLOR;

  const { chartWidth, chartHeight } = dimensions;
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  if (pivotHigh) {
    for (let i = visibleStart; i < visibleEnd; i++) {
      const value = pivotHigh[i];
      if (value === null || value === undefined || Number.isNaN(value)) continue;
      const x = manager.indexToX(i);
      const y = manager.priceToY(value);
      if (y < 0 || y > chartHeight) continue;
      drawPivotMarker(canvasCtx, x, y, effectiveWidth, highColor);
    }
  }

  if (pivotLow) {
    for (let i = visibleStart; i < visibleEnd; i++) {
      const value = pivotLow[i];
      if (value === null || value === undefined || Number.isNaN(value)) continue;
      const x = manager.indexToX(i);
      const y = manager.priceToY(value);
      if (y < 0 || y > chartHeight) continue;
      drawPivotMarker(canvasCtx, x, y, effectiveWidth, lowColor);
    }
  }

  canvasCtx.restore();
};
