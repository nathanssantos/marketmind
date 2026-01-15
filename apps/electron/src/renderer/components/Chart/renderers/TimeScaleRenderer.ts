import type { Kline, Viewport } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawLine, drawText } from '@renderer/utils/canvas/drawingUtils';
import {
  formatTimeLabel,
  getPriorityWeight,
  getTimeLabelPriority,
  type TimeLabelPriority,
} from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';

interface TimeLabel {
  index: number;
  timestamp: number;
  x: number;
  text: string;
  width: number;
  priority: TimeLabelPriority;
  weight: number;
}

export interface TimeScaleRendererOptions {
  labelColor: string;
  axisLineColor: string;
  font?: string;
  minLabelGap?: number;
}

const getIntervalMs = (klines: Kline[]): number => {
  if (klines.length < 2) return 4 * 60 * 60 * 1000;

  const first = klines[0]!;
  const last = klines[klines.length - 1]!;

  const firstTime = typeof first.openTime === 'number' ? first.openTime : new Date(first.openTime).getTime();
  const lastTime = typeof last.openTime === 'number' ? last.openTime : new Date(last.openTime).getTime();

  return (lastTime - firstTime) / (klines.length - 1);
};

const generateLabels = (
  klines: Kline[],
  viewport: Viewport,
  manager: CanvasManager,
  ctx: CanvasRenderingContext2D,
): TimeLabel[] => {
  const labels: TimeLabel[] = [];
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.ceil(viewport.end);

  if (klines.length === 0) return labels;

  const intervalMs = getIntervalMs(klines);
  const lastKline = klines[klines.length - 1]!;
  const lastKlineTime = typeof lastKline.openTime === 'number'
    ? lastKline.openTime
    : new Date(lastKline.openTime).getTime();

  let prevTimestamp: number | null = null;

  for (let i = visibleStart; i < visibleEnd; i++) {
    let timestamp: number;

    if (i >= 0 && i < klines.length) {
      const kline = klines[i];
      if (!kline) continue;
      timestamp = typeof kline.openTime === 'number'
        ? kline.openTime
        : new Date(kline.openTime).getTime();
    } else if (i >= klines.length) {
      const futureOffset = i - (klines.length - 1);
      timestamp = lastKlineTime + futureOffset * intervalMs;
    } else {
      continue;
    }

    const priority = getTimeLabelPriority(timestamp, prevTimestamp);
    const text = formatTimeLabel(timestamp, priority);
    const x = manager.indexToCenterX(i);
    const width = ctx.measureText(text).width;

    labels.push({
      index: i,
      timestamp,
      x,
      text,
      width,
      priority,
      weight: getPriorityWeight(priority),
    });

    prevTimestamp = timestamp;
  }

  return labels;
};

const filterOverlappingLabels = (
  labels: TimeLabel[],
  minGap: number,
  chartWidth: number,
): TimeLabel[] => {
  if (labels.length === 0) return [];

  const sortedByWeight = [...labels].sort((a, b) => b.weight - a.weight || a.index - b.index);
  const result: TimeLabel[] = [];
  const occupiedRanges: Array<{ left: number; right: number }> = [];

  const isOverlapping = (left: number, right: number): boolean => {
    return occupiedRanges.some(
      (range) => !(right + minGap < range.left || left - minGap > range.right),
    );
  };

  for (const label of sortedByWeight) {
    const halfWidth = label.width / 2;
    const left = label.x - halfWidth;
    const right = label.x + halfWidth;

    if (left < 0 || right > chartWidth) continue;
    if (isOverlapping(left, right)) continue;

    result.push(label);
    occupiedRanges.push({ left, right });
  }

  return result.sort((a, b) => a.index - b.index);
};

export const createTimeScaleRenderer = (options: TimeScaleRendererOptions) => {
  const {
    labelColor,
    axisLineColor,
    font = CHART_CONFIG.AXIS_LABEL_FONT,
    minLabelGap = CHART_CONFIG.TIME_LABEL_MIN_GAP,
  } = options;

  return (
    ctx: CanvasRenderingContext2D,
    manager: CanvasManager,
    height: number,
    chartWidth: number,
  ): void => {
    const klines = manager.getKlines();
    const viewport = manager.getViewport();

    if (klines.length === 0) return;

    ctx.font = font;

    const allLabels = generateLabels(klines, viewport, manager, ctx);
    const visibleLabels = filterOverlappingLabels(allLabels, minLabelGap, chartWidth);

    const timeAxisY = height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

    visibleLabels.forEach((label) => {
      drawText(
        ctx,
        label.text,
        label.x,
        timeAxisY + 10,
        labelColor,
        font,
        'center',
        'top',
      );

      drawLine(ctx, label.x, timeAxisY, label.x, timeAxisY + 5, axisLineColor, 1);
    });
  };
};
