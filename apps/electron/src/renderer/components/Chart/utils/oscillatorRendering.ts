import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, PANEL_COLORS, OSCILLATOR_CONFIG, LINE_WIDTHS } from '@shared/constants';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';

interface OscillatorPanelConfig {
  ctx: CanvasRenderingContext2D;
  panelY: number;
  panelHeight: number;
  chartWidth: number;
}

interface ZoneLevelConfig {
  y: number;
}

export const applyPanelClip = ({
  ctx,
  panelY,
  panelHeight,
  chartWidth,
}: OscillatorPanelConfig): void => {
  ctx.beginPath();
  ctx.rect(0, panelY, chartWidth, panelHeight);
  ctx.clip();
};

export const drawPanelBackground = ({
  ctx,
  panelY,
  panelHeight,
  chartWidth,
}: OscillatorPanelConfig): void => {
  ctx.fillStyle = PANEL_COLORS.BACKGROUND;
  ctx.fillRect(0, panelY, chartWidth, panelHeight);
};

export const drawZoneFill = ({
  ctx,
  chartWidth,
  topY,
  bottomY,
}: OscillatorPanelConfig & { topY: number; bottomY: number }): void => {
  ctx.fillStyle = PANEL_COLORS.ZONE_FILL;
  const y = Math.min(topY, bottomY);
  const height = Math.abs(bottomY - topY);
  ctx.fillRect(0, y, chartWidth, height);
};

export const drawZoneLines = ({
  ctx,
  chartWidth,
  levels,
}: Pick<OscillatorPanelConfig, 'ctx' | 'chartWidth'> & { levels: ZoneLevelConfig[] }): void => {
  ctx.strokeStyle = PANEL_COLORS.ZONE_LINE;
  ctx.lineWidth = LINE_WIDTHS.THIN;
  ctx.setLineDash(OSCILLATOR_CONFIG.ZONE_LINE_DASH as number[]);

  for (const level of levels) {
    ctx.beginPath();
    ctx.moveTo(0, level.y);
    ctx.lineTo(chartWidth, level.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
};

export const drawLineOnPanel = (
  ctx: CanvasRenderingContext2D,
  values: (number | null | undefined)[],
  visibleStart: number,
  visibleEnd: number,
  indexToX: (i: number) => number,
  valueToY: (v: number) => number,
  color: string,
  lineWidth: number = OSCILLATOR_CONFIG.LINE_WIDTH,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  let isFirstPoint = true;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;

    const x = indexToX(i);
    const y = valueToY(value);

    if (isFirstPoint) {
      ctx.moveTo(x, y);
      isFirstPoint = false;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
};

export const drawHistogramBars = (
  ctx: CanvasRenderingContext2D,
  values: (number | null | undefined)[],
  visibleStart: number,
  visibleEnd: number,
  indexToX: (i: number) => number,
  valueToY: (v: number) => number,
  zeroY: number,
  positiveColor: string,
  negativeColor: string,
  barWidth: number,
): void => {
  ctx.fillStyle = positiveColor;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = values[i];
    if (value === null || value === undefined || value < 0) continue;
    const x = indexToX(i) - barWidth / 2;
    const y = valueToY(value);
    ctx.fillRect(x, Math.min(y, zeroY), barWidth, Math.abs(zeroY - y));
  }

  ctx.fillStyle = negativeColor;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = values[i];
    if (value === null || value === undefined || value >= 0) continue;
    const x = indexToX(i) - barWidth / 2;
    const y = valueToY(value);
    ctx.fillRect(x, Math.min(y, zeroY), barWidth, Math.abs(zeroY - y));
  }
};

export interface VisibleRange {
  min: number;
  max: number;
  hasData: boolean;
}

export const calculateVisibleRange = (
  data: (number | null | undefined)[],
  startIndex: number,
  endIndex: number,
): VisibleRange => {
  let min = Infinity;
  let max = -Infinity;
  let hasData = false;

  for (let i = startIndex; i < endIndex; i++) {
    const value = data[i];
    if (value === null || value === undefined) continue;
    hasData = true;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return { min, max, hasData };
};

const seriesIdMap = new WeakMap<(number | null | undefined)[], number>();
let nextSeriesId = 1;

const getSeriesId = (series: (number | null | undefined)[]): number => {
  let id = seriesIdMap.get(series);
  if (id === undefined) {
    id = nextSeriesId++;
    seriesIdMap.set(series, id);
  }
  return id;
};

export const getCachedVisibleRange = (
  manager: CanvasManager,
  series: (number | null | undefined)[],
  startIndex: number,
  endIndex: number,
): VisibleRange => {
  const id = getSeriesId(series);
  const key = `vr:${id}:${startIndex}:${endIndex}`;
  return manager.getFrameCached<VisibleRange>(key, () => calculateVisibleRange(series, startIndex, endIndex));
};

export const createNormalizedValueToY = (
  panelTop: number,
  panelHeight: number,
  padding: number,
  flipped: boolean = false,
): ((value: number) => number) => {
  const innerHeight = panelHeight - padding * 2;
  return (value: number) => {
    const ratio = value / 100;
    return flipped
      ? panelTop + padding + ratio * innerHeight
      : panelTop + padding + innerHeight - ratio * innerHeight;
  };
};

export const createDynamicValueToY = (
  panelTop: number,
  panelHeight: number,
  padding: number,
  minValue: number,
  maxValue: number,
  flipped: boolean = false,
): ((value: number) => number) => {
  const innerHeight = panelHeight - padding * 2;
  const range = maxValue - minValue || 1;
  return (value: number) => {
    const normalized = (value - minValue) / range;
    return flipped
      ? panelTop + padding + innerHeight * normalized
      : panelTop + padding + innerHeight * (1 - normalized);
  };
};

const PANEL_TAG_WIDTH = CHART_CONFIG.CANVAS_PADDING_RIGHT;

const getLastValidValue = (
  values: (number | null | undefined)[],
  visibleStart: number,
  visibleEnd: number,
): number | null => {
  for (let i = visibleEnd - 1; i >= visibleStart; i--) {
    const v = values[i];
    if (v !== null && v !== undefined && !isNaN(v)) return v;
  }
  return null;
};

const formatPanelValue = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(4);
};

export const drawPanelValueTag = (
  ctx: CanvasRenderingContext2D,
  values: (number | null | undefined)[],
  visibleStart: number,
  visibleEnd: number,
  valueToY: (v: number) => number,
  chartWidth: number,
  color: string,
  formatFn: (v: number) => string = formatPanelValue,
): void => {
  const lastValue = getLastValidValue(values, visibleStart, visibleEnd);
  if (lastValue === null) return;

  const y = valueToY(lastValue);
  drawPriceTag(ctx, formatFn(lastValue), y, chartWidth, color, PANEL_TAG_WIDTH);
};
