import { CHART_CONFIG, OSCILLATOR_CONFIG } from '@shared/constants';
import {
  createDynamicValueToY,
  createNormalizedValueToY,
  drawLineOnPanel,
  drawPanelBackground,
  drawPanelValueTag,
  drawZoneFill,
  drawZoneLines,
  getCachedVisibleRange,
} from '../../utils/oscillatorRendering';
import { getOscillatorSetup } from '../../hooks/useOscillatorSetup';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';
import { PANE_LINE_COLORS } from './paneColors';

const DEFAULT_LINE_COLOR = '#2196f3';
const DEFAULT_LINE_WIDTH = OSCILLATOR_CONFIG.LINE_WIDTH;

export const renderPaneLine: GenericRenderer = (ctx, input) => {
  const paneId = input.definition.render.paneId ?? input.definition.type;
  const setup = getOscillatorSetup(ctx.manager, true, paneId);
  if (!setup) return;

  const { ctx: canvasCtx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX } = setup;
  const primaryOutput = input.definition.outputs[0]?.key;
  if (!primaryOutput) return;
  const series = input.values[primaryOutput];
  if (!series) return;

  const flipped = ctx.manager.isFlipped();
  const valueRange = input.definition.valueRange;
  const valueToY = valueRange
    ? (() => {
        if (valueRange.min === 0 && valueRange.max === 100) {
          return createNormalizedValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, flipped);
        }
        return createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, valueRange.min, valueRange.max, flipped);
      })()
    : (() => {
        const range = getCachedVisibleRange(ctx.manager, series, visibleStart, visibleEnd);
        if (!range.hasData) return createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, 0, 1, flipped);
        return createDynamicValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING, range.min, range.max, flipped);
      })();

  const color = PANE_LINE_COLORS[paneId]
    ?? getInstanceParam<string>(input.instance, input.definition, 'color')
    ?? DEFAULT_LINE_COLOR;
  const lineWidth = (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? DEFAULT_LINE_WIDTH) as number;

  drawPanelBackground({ ctx: canvasCtx, panelY: panelTop, panelHeight, chartWidth });

  const oversold = input.definition.defaultThresholds?.oversold;
  const overbought = input.definition.defaultThresholds?.overbought;
  if (typeof oversold === 'number' && typeof overbought === 'number' && valueRange) {
    const overboughtY = valueToY(overbought);
    const oversoldY = valueToY(oversold);
    drawZoneFill({ ctx: canvasCtx, chartWidth, panelY: panelTop, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx: canvasCtx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }] });
  }

  drawLineOnPanel(canvasCtx, series, visibleStart, visibleEnd, indexToX, valueToY, color, lineWidth);

  drawPanelValueTag(canvasCtx, series, visibleStart, visibleEnd, valueToY, chartWidth, color);
};
