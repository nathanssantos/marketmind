import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_TENKAN_COLOR = '#2962ff';
const DEFAULT_KIJUN_COLOR = '#b71c1c';
const DEFAULT_CHIKOU_COLOR = '#7c4dff';
const DEFAULT_SENKOU_A_FILL = 'rgba(38, 166, 154, 0.2)';
const DEFAULT_SENKOU_B_FILL = 'rgba(239, 83, 80, 0.2)';
const DEFAULT_LINE_WIDTH = 1;

export const renderIchimoku: GenericRenderer = (ctx, input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!klines.length) return;

  const tenkan = input.values['tenkan'];
  const kijun = input.values['kijun'];
  const senkouA = input.values['senkouA'];
  const senkouB = input.values['senkouB'];
  const chikou = input.values['chikou'];
  if (!tenkan || !kijun || !senkouA || !senkouB || !chikou) return;

  const tenkanColor =
    getInstanceParam<string>(input.instance, input.definition, 'tenkanColor') ??
    colors.ichimoku?.tenkan ??
    DEFAULT_TENKAN_COLOR;
  const kijunColor =
    getInstanceParam<string>(input.instance, input.definition, 'kijunColor') ??
    colors.ichimoku?.kijun ??
    DEFAULT_KIJUN_COLOR;
  const chikouColor =
    getInstanceParam<string>(input.instance, input.definition, 'chikouColor') ??
    colors.ichimoku?.chikou ??
    DEFAULT_CHIKOU_COLOR;
  const senkouAFill =
    getInstanceParam<string>(input.instance, input.definition, 'senkouAFill') ??
    colors.ichimoku?.senkouAFill ??
    DEFAULT_SENKOU_A_FILL;
  const senkouBFill =
    getInstanceParam<string>(input.instance, input.definition, 'senkouBFill') ??
    colors.ichimoku?.senkouBFill ??
    DEFAULT_SENKOU_B_FILL;
  const lineWidth =
    (getInstanceParam<number>(input.instance, input.definition, 'lineWidth') ?? DEFAULT_LINE_WIDTH);

  const { chartWidth, chartHeight } = dimensions;
  const visibleStart = Math.max(0, Math.floor(viewport.start));
  const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
  if (visibleEnd <= visibleStart) return;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  for (let i = visibleStart; i < visibleEnd - 1; i++) {
    const a1 = senkouA[i];
    const b1 = senkouB[i];
    const a2 = senkouA[i + 1];
    const b2 = senkouB[i + 1];
    if (
      a1 === null || a1 === undefined ||
      b1 === null || b1 === undefined ||
      a2 === null || a2 === undefined ||
      b2 === null || b2 === undefined
    ) continue;

    const x1 = manager.indexToCenterX(i);
    const x2 = manager.indexToCenterX(i + 1);
    const ya1 = manager.priceToY(a1);
    const yb1 = manager.priceToY(b1);
    const ya2 = manager.priceToY(a2);
    const yb2 = manager.priceToY(b2);

    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, ya1);
    canvasCtx.lineTo(x2, ya2);
    canvasCtx.lineTo(x2, yb2);
    canvasCtx.lineTo(x1, yb1);
    canvasCtx.closePath();
    canvasCtx.fillStyle = a1 >= b1 ? senkouAFill : senkouBFill;
    canvasCtx.fill();
  }

  const drawLine = (series: (number | null | undefined)[], color: string): void => {
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.beginPath();
    let started = false;
    for (let i = visibleStart; i < visibleEnd; i++) {
      const value = series[i];
      if (value === null || value === undefined || Number.isNaN(value)) {
        started = false;
        continue;
      }
      const x = manager.indexToCenterX(i);
      const y = manager.priceToY(value);
      if (!started) {
        canvasCtx.moveTo(x, y);
        started = true;
      } else {
        canvasCtx.lineTo(x, y);
      }
    }
    canvasCtx.stroke();
  };

  drawLine(tenkan, tenkanColor);
  drawLine(kijun, kijunColor);
  drawLine(chikou, chikouColor);

  canvasCtx.restore();
};
