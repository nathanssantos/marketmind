import { CHART_CONFIG } from '@shared/constants';
import {
  getCachedVisibleRange,
  createDynamicValueToY,
  drawHistogramBars,
  drawPanelBackground,
  drawPanelValueTag,
} from '../../utils/oscillatorRendering';
import { getOscillatorSetup } from '../../hooks/useOscillatorSetup';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_POSITIVE_COLOR = '#26a69a';
const DEFAULT_NEGATIVE_COLOR = '#ef5350';

export const renderPaneHistogram: GenericRenderer = (ctx, input) => {
  const paneId = input.definition.render.paneId ?? input.definition.type;
  const setup = getOscillatorSetup(ctx.manager, true, paneId);
  if (!setup) return;

  const { ctx: canvasCtx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX, klineWidth } = setup;
  const primaryOutput = input.definition.outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  const range = getCachedVisibleRange(ctx.manager, series, visibleStart, visibleEnd);
  if (!range.hasData) return;

  const minValue = Math.min(0, range.min);
  const maxValue = Math.max(0, range.max);
  const safeMax = minValue === maxValue ? maxValue + 1 : maxValue;

  const flipped = ctx.manager.isFlipped();
  const valueToY = createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, minValue, safeMax, flipped);
  const zeroY = valueToY(0);

  const positiveColor = getInstanceParam<string>(input.instance, input.definition, 'color') ?? DEFAULT_POSITIVE_COLOR;

  drawPanelBackground({ ctx: canvasCtx, panelY: panelTop, panelHeight, chartWidth });

  drawHistogramBars(
    canvasCtx,
    series,
    visibleStart,
    visibleEnd,
    indexToX,
    valueToY,
    zeroY,
    positiveColor,
    DEFAULT_NEGATIVE_COLOR,
    Math.max(1, klineWidth * 0.8),
  );

  drawPanelValueTag(canvasCtx, series, visibleStart, visibleEnd, valueToY, chartWidth, positiveColor);
};
