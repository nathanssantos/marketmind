import { FIBONACCI_DEFAULT_COLOR, getLevelColor as getFibonacciLevelColor } from '@marketmind/fibonacci';
import { calculateAutoFibonacci } from '@renderer/lib/indicators/fibonacci';
import { CHART_CONFIG, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import type { GenericRenderer } from './types';

const FIBONACCI_LOOKBACK = 50;
const LEVEL_DASH = [4, 4] as const;
const HIDDEN_LEVELS = new Set([0.886, 1.382]);

export const renderFibonacci: GenericRenderer = (ctx, _input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const klines = manager.getKlines();
  const fibonacciData = calculateAutoFibonacci(klines, FIBONACCI_LOOKBACK);
  if (!fibonacciData) return;

  const { chartWidth, chartHeight } = dimensions;
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  for (const level of fibonacciData.levels) {
    if (!level || HIDDEN_LEVELS.has(level.level)) continue;

    const y = manager.priceToY(level.price);
    if (y < 0 || y > chartHeight) continue;

    const color = getFibonacciLevelColor(level.level, colors.fibonacci, FIBONACCI_DEFAULT_COLOR);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = INDICATOR_LINE_WIDTHS.OVERLAY;
    canvasCtx.setLineDash([...LEVEL_DASH]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, y);
    canvasCtx.lineTo(effectiveWidth, y);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);

    canvasCtx.fillStyle = color;
    canvasCtx.font = '10px monospace';
    canvasCtx.textAlign = 'right';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(level.label, effectiveWidth - 4, y);
  }

  canvasCtx.setLineDash([]);
  canvasCtx.restore();
};
