import { CHART_CONFIG, OSCILLATOR_CONFIG } from '@shared/constants';
import {
  applyPanelClip,
  calculateVisibleRange,
  createDynamicValueToY,
  createNormalizedValueToY,
  drawHistogramBars,
  drawLineOnPanel,
  drawPanelBackground,
  drawPanelValueTag,
} from '../../utils/oscillatorRendering';
import { getOscillatorSetup } from '../../hooks/useOscillatorSetup';
import type { GenericRenderer, IndicatorValueSeries } from './types';
import { getInstanceParam } from './types';

const DEFAULT_LINE_COLOR = '#00e676';
const DEFAULT_SECONDARY_COLOR = '#ff5252';
const DEFAULT_HIST_POSITIVE = '#26a69a';
const DEFAULT_HIST_NEGATIVE = '#ef5350';

const HISTOGRAM_OUTPUT_KEYS = new Set(['histogram', 'hist']);

const palette = ['#00e676', '#ff5252', '#ffd54f', '#42a5f5', '#ab47bc'];

export const renderPaneMulti: GenericRenderer = (ctx, input) => {
  const paneId = input.definition.render.paneId ?? input.definition.type;
  const setup = getOscillatorSetup(ctx.manager, true, paneId);
  if (!setup) return;

  const { ctx: canvasCtx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX, klineWidth } = setup;
  const outputs = input.definition.outputs;
  if (outputs.length === 0) return;

  const seriesEntries: Array<{ key: string; values: IndicatorValueSeries; isHistogram: boolean }> = [];
  for (const out of outputs) {
    const series = input.values[out.key];
    if (!series) continue;
    seriesEntries.push({ key: out.key, values: series, isHistogram: HISTOGRAM_OUTPUT_KEYS.has(out.key) });
  }
  if (seriesEntries.length === 0) return;

  const valueRange = input.definition.valueRange;
  let minValue = Infinity;
  let maxValue = -Infinity;

  if (valueRange) {
    minValue = valueRange.min;
    maxValue = valueRange.max;
  } else {
    for (const { values } of seriesEntries) {
      const range = calculateVisibleRange(values, visibleStart, visibleEnd);
      if (!range.hasData) continue;
      if (range.min < minValue) minValue = range.min;
      if (range.max > maxValue) maxValue = range.max;
    }
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return;
    if (minValue === maxValue) {
      minValue -= 1;
      maxValue += 1;
    }
  }

  const valueToY = valueRange && valueRange.min === 0 && valueRange.max === 100
    ? createNormalizedValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING)
    : createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, minValue, maxValue);

  const baseColor = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_LINE_COLOR;
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? OSCILLATOR_CONFIG.LINE_WIDTH) as number;

  canvasCtx.save();
  applyPanelClip({ ctx: canvasCtx, panelY: panelTop, panelHeight, chartWidth });
  drawPanelBackground({ ctx: canvasCtx, panelY: panelTop, panelHeight, chartWidth });

  const zeroY = minValue <= 0 && maxValue >= 0 ? valueToY(0) : panelTop + panelHeight;

  let lineIdx = 0;
  for (const { values, isHistogram } of seriesEntries) {
    const seriesColor = lineIdx === 0 ? baseColor : palette[lineIdx % palette.length] ?? DEFAULT_SECONDARY_COLOR;
    if (isHistogram) {
      drawHistogramBars(
        canvasCtx,
        values,
        visibleStart,
        visibleEnd,
        indexToX,
        valueToY,
        zeroY,
        DEFAULT_HIST_POSITIVE,
        DEFAULT_HIST_NEGATIVE,
        Math.max(1, klineWidth * 0.7),
      );
    } else {
      drawLineOnPanel(canvasCtx, values, visibleStart, visibleEnd, indexToX, valueToY, seriesColor, lineWidth);
    }
    lineIdx++;
  }

  canvasCtx.restore();

  const tagSeries = seriesEntries.find((e) => !e.isHistogram) ?? seriesEntries[0];
  if (tagSeries) {
    drawPanelValueTag(canvasCtx, tagSeries.values, visibleStart, visibleEnd, valueToY, chartWidth, baseColor);
  }
};
