import { CHART_CONFIG, OSCILLATOR_CONFIG } from '@shared/constants';
import {
  getCachedVisibleRange,
  createDynamicValueToY,
  createNormalizedValueToY,
  drawHistogramBars,
  drawLineOnPanel,
  drawPanelValueTag,
  drawZoneFill,
  drawZoneLines,
} from '../../utils/oscillatorRendering';
import { getOscillatorSetup } from '../../hooks/useOscillatorSetup';
import type { GenericRenderer, IndicatorValueSeries } from './types';
import { getInstanceParam } from './types';
import { PANE_SERIES_COLORS } from './paneColors';

const DEFAULT_LINE_COLOR = '#2196f3';
const DEFAULT_HIST_POSITIVE = 'rgba(38, 166, 154, 0.7)';
const DEFAULT_HIST_NEGATIVE = 'rgba(239, 83, 80, 0.7)';
const FALLBACK_PALETTE = ['#2196f3', '#ff9800', '#ffd54f', '#9c27b0', '#26a69a'];

const HISTOGRAM_OUTPUT_KEYS = new Set(['histogram', 'hist']);

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
      const range = getCachedVisibleRange(ctx.manager, values, visibleStart, visibleEnd);
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

  const flipped = ctx.manager.isFlipped();
  const valueToY = valueRange?.min === 0 && valueRange.max === 100
    ? createNormalizedValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, flipped)
    : createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, minValue, maxValue, flipped);

  const userColor = getInstanceParam<string>(input.instance, input.definition, 'color');
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? OSCILLATOR_CONFIG.LINE_WIDTH);
  const paneColors = PANE_SERIES_COLORS[paneId];

  const resolveColor = (outputKey: string, idx: number): string => {
    const mapped = paneColors?.outputs[outputKey];
    if (mapped) return mapped;
    if (idx === 0 && userColor) return userColor;
    return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length] ?? DEFAULT_LINE_COLOR;
  };

  const oversold = input.definition.defaultThresholds?.oversold;
  const overbought = input.definition.defaultThresholds?.overbought;
  if (typeof oversold === 'number' && typeof overbought === 'number' && valueRange) {
    const overboughtY = valueToY(overbought);
    const oversoldY = valueToY(oversold);
    drawZoneFill({ ctx: canvasCtx, chartWidth, panelY: panelTop, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx: canvasCtx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }] });
  }

  const zeroY = minValue <= 0 && maxValue >= 0 ? valueToY(0) : panelTop + panelHeight;
  if (paneColors?.zeroLine && minValue < 0 && maxValue > 0) {
    drawZoneLines({ ctx: canvasCtx, chartWidth, levels: [{ y: zeroY }] });
  }

  const histPositive = paneColors?.histogramPositive ?? DEFAULT_HIST_POSITIVE;
  const histNegative = paneColors?.histogramNegative ?? DEFAULT_HIST_NEGATIVE;

  let lineIdx = 0;
  for (const { key, values, isHistogram } of seriesEntries) {
    const seriesColor = resolveColor(key, lineIdx);
    if (isHistogram) {
      drawHistogramBars(
        canvasCtx,
        values,
        visibleStart,
        visibleEnd,
        indexToX,
        valueToY,
        zeroY,
        histPositive,
        histNegative,
        Math.max(1, klineWidth * 0.7),
      );
    } else {
      drawLineOnPanel(canvasCtx, values, visibleStart, visibleEnd, indexToX, valueToY, seriesColor, lineWidth);
    }
    lineIdx++;
  }

  const tagSeries = seriesEntries.find((e) => !e.isHistogram) ?? seriesEntries[0];
  if (tagSeries) {
    const tagColor = resolveColor(tagSeries.key, seriesEntries.indexOf(tagSeries));
    drawPanelValueTag(canvasCtx, tagSeries.values, visibleStart, visibleEnd, valueToY, chartWidth, tagColor);
  }
};
