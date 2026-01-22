import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, PANEL_COLORS } from '@shared/constants';

export interface PanelRenderContext {
  ctx: CanvasRenderingContext2D;
  panelTop: number;
  panelHeight: number;
  chartWidth: number;
  effectiveWidth: number;
  klineWidth: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  padding: number;
  innerHeight: number;
}

export interface ScaleConfig {
  min: number;
  max: number;
  inverted?: boolean;
}

export const createPanelContext = (
  manager: CanvasManager,
  panelId: string,
  panelHeight: number
): PanelRenderContext | null => {
  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();

  if (!ctx || !dimensions) return null;

  const { chartWidth } = dimensions;
  const panelTop = manager.getPanelTop(panelId);
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
  const klineWidth = effectiveWidth / (viewport.end - viewport.start);
  const padding = 4;
  const innerHeight = panelHeight - padding * 2;

  return {
    ctx,
    panelTop,
    panelHeight,
    chartWidth,
    effectiveWidth,
    klineWidth,
    visibleStartIndex: Math.floor(viewport.start),
    visibleEndIndex: Math.ceil(viewport.end),
    padding,
    innerHeight,
  };
};

export const createValueToY = (
  context: PanelRenderContext,
  scale: ScaleConfig
): (value: number) => number => {
  const { panelTop, padding, innerHeight } = context;
  const { min, max, inverted } = scale;
  const range = max - min;

  return (value: number): number => {
    const normalized = (value - min) / range;
    const y = inverted
      ? panelTop + padding + normalized * innerHeight
      : panelTop + padding + innerHeight - normalized * innerHeight;
    return y;
  };
};

export const drawPanelBackground = (
  context: PanelRenderContext,
  backgroundColor = PANEL_COLORS.BACKGROUND
): void => {
  const { ctx, panelTop, chartWidth, panelHeight } = context;
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, panelTop, chartWidth, panelHeight);
};

export const drawHorizontalLine = (
  context: PanelRenderContext,
  y: number,
  color: string,
  lineWidth = 1,
  dashed = true
): void => {
  const { ctx, chartWidth } = context;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) {
    ctx.setLineDash([2, 2]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);
};

export const drawZoneLine = (
  context: PanelRenderContext,
  valueToY: (value: number) => number,
  value: number,
  color: string
): void => {
  const y = valueToY(value);
  drawHorizontalLine(context, y, color, 1, true);
};

export const drawZeroLine = (
  context: PanelRenderContext,
  valueToY: (value: number) => number,
  color: string
): void => {
  drawZoneLine(context, valueToY, 0, color);
};

export const drawIndicatorLine = (
  context: PanelRenderContext,
  values: (number | null)[],
  valueToY: (value: number) => number,
  color: string,
  lineWidth = 2.5,
  viewport: { start: number; end: number }
): void => {
  const { ctx, visibleStartIndex, visibleEndIndex, klineWidth } = context;
  const visibleValues = values.slice(visibleStartIndex, visibleEndIndex);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  let isFirstPoint = true;

  for (let i = 0; i < visibleValues.length; i++) {
    const value = visibleValues[i];
    if (value === null || value === undefined) continue;

    const globalIndex = visibleStartIndex + i;
    const x = (globalIndex - viewport.start) * klineWidth + klineWidth / 2;
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

export const drawHistogram = (
  context: PanelRenderContext,
  values: (number | null)[],
  valueToY: (value: number) => number,
  zeroY: number,
  positiveColor: string,
  negativeColor: string,
  viewport: { start: number; end: number },
  barWidthRatio = 0.6
): void => {
  const { ctx, visibleStartIndex, visibleEndIndex, klineWidth } = context;
  const visibleValues = values.slice(visibleStartIndex, visibleEndIndex);
  const barWidth = klineWidth * barWidthRatio;

  for (let i = 0; i < visibleValues.length; i++) {
    const value = visibleValues[i];
    if (value === null || value === undefined) continue;

    const globalIndex = visibleStartIndex + i;
    const x = (globalIndex - viewport.start) * klineWidth + (klineWidth - barWidth) / 2;
    const y = valueToY(value);

    ctx.fillStyle = value >= 0 ? positiveColor : negativeColor;

    const barHeight = Math.abs(y - zeroY);
    const barY = value >= 0 ? y : zeroY;

    ctx.fillRect(x, barY, barWidth, barHeight);
  }
};

export const drawScaleLabels = (
  context: PanelRenderContext,
  labels: { value: number; y: number }[],
  color = PANEL_COLORS.SCALE_LABEL_TEXT,
  fontSize = 10
): void => {
  const { ctx, panelTop, panelHeight, padding } = context;

  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';

  for (const label of labels) {
    const displayY = Math.max(panelTop + padding + fontSize, Math.min(label.y + 3, panelTop + panelHeight - 4));
    ctx.fillText(String(label.value), 4, displayY);
  }
};

export const drawPanelLabel = (
  context: PanelRenderContext,
  label: string,
  color = PANEL_COLORS.LABEL_TEXT,
  fontSize = 10
): void => {
  const { ctx, panelTop, chartWidth, padding } = context;

  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.fillText(label, chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN - 4, panelTop + padding + fontSize);
};
