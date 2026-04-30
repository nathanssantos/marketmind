import type { PositionSide } from '@marketmind/types';
import { semanticTokenColors } from './semanticTokens';

const resolveTokenValue = (token: unknown, colorMode: 'light' | 'dark'): string => {
  if (!token || typeof token !== 'object' || !('value' in token)) return '';
  const tokenValue = (token as { value: string | { base: string; _dark?: string } }).value;
  if (typeof tokenValue === 'string') return tokenValue;
  return colorMode === 'dark' ? (tokenValue._dark ?? tokenValue.base) : tokenValue.base;
};

const resolve = (key: string, colorMode: 'light' | 'dark'): string =>
  resolveTokenValue((semanticTokenColors as Record<string, unknown>)[key], colorMode);

export const getChartColors = (colorMode: 'light' | 'dark', paletteOverride?: { bullish: string; bearish: string; background: string; grid: string }) => ({
  background: paletteOverride?.background ?? resolve('chart.background', colorMode),
  bullish: paletteOverride?.bullish ?? resolve('chart.bullish', colorMode),
  bearish: paletteOverride?.bearish ?? resolve('chart.bearish', colorMode),
  volume: resolve('chart.volume', colorMode),
  grid: paletteOverride?.grid ?? resolve('chart.grid', colorMode),
  text: resolve('chart.axis.label', colorMode),
  axisLabel: resolve('chart.axis.label', colorMode),
  axisLine: resolve('chart.axis.line', colorMode),
  crosshair: resolve('chart.crosshair', colorMode),
  currentPriceLine: resolve('chart.currentPrice.line', colorMode),
  currentPriceLabel: {
    bg: resolve('chart.currentPrice.label.bg', colorMode),
    text: resolve('chart.currentPrice.label.text', colorMode),
  },
  lineDefault: resolve('chart.line.default', colorMode),
  watermark: colorMode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
  highlighted: colorMode === 'dark' ? '#ffeb3b' : '#ffc107',
  line: resolve('chart.line.default', colorMode),
  ma: [
    resolve('chart.ma.1', colorMode),
    resolve('chart.ma.2', colorMode),
    resolve('chart.ma.3', colorMode),
    resolve('chart.ma.4', colorMode),
    resolve('chart.ma.5', colorMode),
    resolve('chart.ma.6', colorMode),
    resolve('chart.ma.7', colorMode),
    resolve('chart.ma.8', colorMode),
  ],
  stochastic: {
    k: resolve('chart.stochastic.k', colorMode),
    d: resolve('chart.stochastic.d', colorMode),
    zone: resolve('chart.stochastic.zone', colorMode),
  },
  rsi: {
    line: resolve('chart.rsi.line', colorMode),
    zone: resolve('chart.rsi.zone', colorMode),
  },
  bollingerBands: {
    upper: resolve('chart.bollingerBands.upper', colorMode),
    middle: resolve('chart.bollingerBands.middle', colorMode),
    lower: resolve('chart.bollingerBands.lower', colorMode),
    fill: resolve('chart.bollingerBands.fill', colorMode),
  },
  atr: {
    line: resolve('chart.atr.line', colorMode),
  },
  macd: {
    macdLine: resolve('chart.macd.macdLine', colorMode),
    signalLine: resolve('chart.macd.signalLine', colorMode),
    histogramPositive: resolve('chart.macd.histogramPositive', colorMode),
    histogramNegative: resolve('chart.macd.histogramNegative', colorMode),
    zeroLine: resolve('chart.macd.zeroLine', colorMode),
  },
  adx: {
    adxLine: resolve('chart.adx.adxLine', colorMode),
    plusDI: resolve('chart.adx.plusDI', colorMode),
    minusDI: resolve('chart.adx.minusDI', colorMode),
    threshold: resolve('chart.adx.threshold', colorMode),
  },
  williamsR: {
    line: resolve('chart.williamsR.line', colorMode),
    zone: resolve('chart.williamsR.zone', colorMode),
  },
  cci: {
    line: resolve('chart.cci.line', colorMode),
    zone: resolve('chart.cci.zone', colorMode),
  },
  ichimoku: {
    tenkan: resolve('chart.ichimoku.tenkan', colorMode),
    kijun: resolve('chart.ichimoku.kijun', colorMode),
    senkouAFill: resolve('chart.ichimoku.senkouAFill', colorMode),
    senkouBFill: resolve('chart.ichimoku.senkouBFill', colorMode),
    chikou: resolve('chart.ichimoku.chikou', colorMode),
  },
  supertrend: {
    up: resolve('chart.supertrend.up', colorMode),
    down: resolve('chart.supertrend.down', colorMode),
  },
  parabolicSar: {
    bullish: resolve('chart.parabolicSar.bullish', colorMode),
    bearish: resolve('chart.parabolicSar.bearish', colorMode),
  },
  keltner: {
    upper: resolve('chart.keltner.upper', colorMode),
    middle: resolve('chart.keltner.middle', colorMode),
    lower: resolve('chart.keltner.lower', colorMode),
    fill: resolve('chart.keltner.fill', colorMode),
  },
  donchian: {
    upper: resolve('chart.donchian.upper', colorMode),
    middle: resolve('chart.donchian.middle', colorMode),
    lower: resolve('chart.donchian.lower', colorMode),
    fill: resolve('chart.donchian.fill', colorMode),
  },
  obv: {
    line: resolve('chart.obv.line', colorMode),
    sma: resolve('chart.obv.sma', colorMode),
  },
  cmf: {
    positive: resolve('chart.cmf.positive', colorMode),
    negative: resolve('chart.cmf.negative', colorMode),
  },
  stochRsi: {
    k: resolve('chart.stochRsi.k', colorMode),
    d: resolve('chart.stochRsi.d', colorMode),
  },
  klinger: {
    kvoLine: resolve('chart.klinger.kvoLine', colorMode),
    signalLine: resolve('chart.klinger.signalLine', colorMode),
    zeroLine: resolve('chart.klinger.zeroLine', colorMode),
  },
  elderRay: {
    bullPower: resolve('chart.elderRay.bullPower', colorMode),
    bearPower: resolve('chart.elderRay.bearPower', colorMode),
  },
  aroon: {
    upLine: resolve('chart.aroon.upLine', colorMode),
    downLine: resolve('chart.aroon.downLine', colorMode),
    zone: resolve('chart.aroon.zone', colorMode),
  },
  vortex: {
    viPlusLine: resolve('chart.vortex.viPlusLine', colorMode),
    viMinusLine: resolve('chart.vortex.viMinusLine', colorMode),
  },
  mfi: {
    line: resolve('chart.mfi.line', colorMode),
    zone: resolve('chart.mfi.zone', colorMode),
  },
  roc: {
    line: resolve('chart.roc.line', colorMode),
  },
  ao: {
    positive: resolve('chart.ao.positive', colorMode),
    negative: resolve('chart.ao.negative', colorMode),
  },
  tsi: {
    tsiLine: resolve('chart.tsi.tsiLine', colorMode),
    signalLine: resolve('chart.tsi.signalLine', colorMode),
  },
  ppo: {
    ppoLine: resolve('chart.ppo.ppoLine', colorMode),
    signalLine: resolve('chart.ppo.signalLine', colorMode),
    histogramPositive: resolve('chart.ppo.histogramPositive', colorMode),
    histogramNegative: resolve('chart.ppo.histogramNegative', colorMode),
    zeroLine: resolve('chart.ppo.zeroLine', colorMode),
  },
  cmo: {
    line: resolve('chart.cmo.line', colorMode),
    zone: resolve('chart.cmo.zone', colorMode),
  },
  ultimateOsc: {
    line: resolve('chart.ultimateOsc.line', colorMode),
    zone: resolve('chart.ultimateOsc.zone', colorMode),
  },
  dema: {
    line: resolve('chart.dema.line', colorMode),
  },
  tema: {
    line: resolve('chart.tema.line', colorMode),
  },
  wma: {
    line: resolve('chart.wma.line', colorMode),
  },
  hma: {
    line: resolve('chart.hma.line', colorMode),
  },
  pivotPoints: {
    pivot: resolve('chart.pivotPoints.pivot', colorMode),
    support: resolve('chart.pivotPoints.support', colorMode),
    resistance: resolve('chart.pivotPoints.resistance', colorMode),
  },
  fibonacci: {
    level0: resolve('chart.fibonacci.level0', colorMode),
    level236: resolve('chart.fibonacci.level236', colorMode),
    level382: resolve('chart.fibonacci.level382', colorMode),
    level50: resolve('chart.fibonacci.level50', colorMode),
    level618: resolve('chart.fibonacci.level618', colorMode),
    level786: resolve('chart.fibonacci.level786', colorMode),
    level886: resolve('chart.fibonacci.level886', colorMode),
    level100: resolve('chart.fibonacci.level100', colorMode),
    level127: resolve('chart.fibonacci.level127', colorMode),
    level138: resolve('chart.fibonacci.level138', colorMode),
    level161: resolve('chart.fibonacci.level161', colorMode),
    level200: resolve('chart.fibonacci.level200', colorMode),
    level261: resolve('chart.fibonacci.level261', colorMode),
    level300: resolve('chart.fibonacci.level300', colorMode),
    level361: resolve('chart.fibonacci.level361', colorMode),
    level423: resolve('chart.fibonacci.level423', colorMode),
  },
  fvg: {
    bullish: resolve('chart.fvg.bullish', colorMode),
    bearish: resolve('chart.fvg.bearish', colorMode),
    bullishBorder: resolve('chart.fvg.bullishBorder', colorMode),
    bearishBorder: resolve('chart.fvg.bearishBorder', colorMode),
  },
  liquidityLevels: {
    support: resolve('chart.liquidityLevels.support', colorMode),
    resistance: resolve('chart.liquidityLevels.resistance', colorMode),
    supportBg: resolve('chart.liquidityLevels.supportBg', colorMode),
    resistanceBg: resolve('chart.liquidityLevels.resistanceBg', colorMode),
  },
  scalping: {
    cvdLine: resolve('chart.scalping.cvdLine', colorMode),
    imbalanceLine: resolve('chart.scalping.imbalanceLine', colorMode),
    pocLine: resolve('chart.scalping.pocLine', colorMode),
    valueAreaFill: resolve('chart.scalping.valueAreaFill', colorMode),
  },
  vwap: {
    daily: resolve('chart.vwap.daily', colorMode),
    weekly: resolve('chart.vwap.weekly', colorMode),
    monthly: resolve('chart.vwap.monthly', colorMode),
  },
  atrTrailing: {
    long: resolve('chart.atr.long', colorMode),
    short: resolve('chart.atr.short', colorMode),
  },
  drawing: {
    fibonacci: resolve('chart.drawing.fibonacci', colorMode),
    fibGolden: resolve('chart.drawing.fibGolden', colorMode),
    fibKeyLevel: resolve('chart.drawing.fibKeyLevel', colorMode),
    buyZone: resolve('chart.drawing.buyZone', colorMode),
    dangerZone: resolve('chart.drawing.dangerZone', colorMode),
    selected: resolve('chart.drawing.selected', colorMode),
    labelBg: resolve('chart.drawing.labelBg', colorMode),
    areaFill: resolve('chart.drawing.areaFill', colorMode),
    snapIndicator: resolve('chart.drawing.snapIndicator', colorMode),
    snapLabel: resolve('chart.drawing.snapLabel', colorMode),
  },
  indicatorZone: resolve('chart.indicator.zone', colorMode),
  panel: {
    background: resolve('chart.panel.background', colorMode),
    scaleLabel: resolve('chart.panel.scaleLabel', colorMode),
    label: resolve('chart.panel.label', colorMode),
  },
});

export const getTradingColors = (colorMode: 'light' | 'dark') => ({
  profit: resolve('trading.profit', colorMode),
  loss: resolve('trading.loss', colorMode),
  neutral: resolve('trading.neutral', colorMode),
  warning: resolve('trading.warning', colorMode),
  info: resolve('trading.info', colorMode),
  long: resolve('trading.long', colorMode),
  short: resolve('trading.short', colorMode),
});

export const getCanvasColors = (colorMode: 'light' | 'dark') => ({
  text: resolve('canvas.text', colorMode),
  priceTag: {
    bullish: resolve('canvas.priceTag.bullish', colorMode),
    bearish: resolve('canvas.priceTag.bearish', colorMode),
    info: resolve('canvas.priceTag.info', colorMode),
    neutral: resolve('canvas.priceTag.neutral', colorMode),
  },
  overlay: {
    dark: resolve('overlay.dark', colorMode),
    light: resolve('overlay.light', colorMode),
  },
});

export const getPnLColor = (value: number, colorMode: 'light' | 'dark' = 'dark'): string => {
  const colors = getTradingColors(colorMode);
  if (value > 0) return colors.profit;
  if (value < 0) return colors.loss;
  return colors.neutral;
};

export const getSideColor = (side: PositionSide | 'BUY' | 'SELL', colorMode: 'light' | 'dark' = 'dark'): string => {
  const colors = getTradingColors(colorMode);
  return side === 'LONG' || side === 'BUY' ? colors.long : colors.short;
};
