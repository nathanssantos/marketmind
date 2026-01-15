import { PANEL_COLORS, OSCILLATOR_CONFIG, LINE_WIDTHS } from '@shared/constants';

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
  ctx.fillRect(0, topY, chartWidth, bottomY - topY);
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
  for (let i = visibleStart; i < visibleEnd; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;

    const x = indexToX(i) - barWidth / 2;
    const y = valueToY(value);
    const height = zeroY - y;

    ctx.fillStyle = value >= 0 ? positiveColor : negativeColor;
    ctx.fillRect(x, Math.min(y, zeroY), barWidth, Math.abs(height));
  }
};

export const calculateVisibleRange = (
  data: (number | null | undefined)[],
  startIndex: number,
  endIndex: number,
): { min: number; max: number; hasData: boolean } => {
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

export const createNormalizedValueToY = (
  panelTop: number,
  panelHeight: number,
  padding: number,
): ((value: number) => number) => {
  const innerHeight = panelHeight - padding * 2;
  return (value: number) => panelTop + padding + innerHeight - (value / 100) * innerHeight;
};

export const createDynamicValueToY = (
  panelTop: number,
  panelHeight: number,
  padding: number,
  minValue: number,
  maxValue: number,
): ((value: number) => number) => {
  const innerHeight = panelHeight - padding * 2;
  const range = maxValue - minValue || 1;
  return (value: number) => {
    const normalized = (value - minValue) / range;
    return panelTop + padding + innerHeight * (1 - normalized);
  };
};
