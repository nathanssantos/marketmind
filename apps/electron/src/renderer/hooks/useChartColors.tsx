import { useColorMode } from '@/renderer/components/ui/color-mode';
import { getChartColors } from '@/renderer/theme';
import type { ChartColors } from '@marketmind/types';
import { useMemo } from 'react';

export interface ChartThemeColors extends ChartColors {
  text: string;
  axisLabel: string;
  axisLine: string;
  crosshair: string;
  currentPriceLine: string;
  currentPriceLabel: {
    bg: string;
    text: string;
  };
  lineDefault: string;
  ma: [string, string, string];
  stochastic: {
    k: string;
    d: string;
    zone: string;
  };
  rsi: {
    line: string;
    zone: string;
  };
  bollingerBands?: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
  atr?: {
    line: string;
  };
  macd?: {
    macdLine: string;
    signalLine: string;
    histogramPositive: string;
    histogramNegative: string;
    zeroLine: string;
  };
  adx?: {
    adxLine: string;
    plusDI: string;
    minusDI: string;
    threshold: string;
  };
  williamsR?: {
    line: string;
    zone: string;
  };
  cci?: {
    line: string;
    zone: string;
  };
  ichimoku?: {
    tenkan: string;
    kijun: string;
    senkouAFill: string;
    senkouBFill: string;
    chikou: string;
  };
  supertrend?: {
    up: string;
    down: string;
  };
  parabolicSar?: {
    bullish: string;
    bearish: string;
  };
  keltner?: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
  donchian?: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
  obv?: {
    line: string;
    sma: string;
  };
  cmf?: {
    positive: string;
    negative: string;
  };
  stochRsi?: {
    k: string;
    d: string;
  };
  klinger?: {
    kvoLine: string;
    signalLine: string;
    zeroLine: string;
  };
  elderRay?: {
    bullPower: string;
    bearPower: string;
  };
  aroon?: {
    upLine: string;
    downLine: string;
    zone: string;
  };
  vortex?: {
    viPlusLine: string;
    viMinusLine: string;
  };
  mfi?: {
    line: string;
    zone: string;
  };
  roc?: {
    line: string;
  };
  ao?: {
    positive: string;
    negative: string;
  };
  tsi?: {
    tsiLine: string;
    signalLine: string;
  };
  ppo?: {
    ppoLine: string;
    signalLine: string;
    histogramPositive: string;
    histogramNegative: string;
    zeroLine: string;
  };
  cmo?: {
    line: string;
    zone: string;
  };
  ultimateOsc?: {
    line: string;
    zone: string;
  };
  dema?: {
    line: string;
  };
  tema?: {
    line: string;
  };
  wma?: {
    line: string;
  };
  hma?: {
    line: string;
  };
  pivotPoints?: {
    support: string;
    resistance: string;
  };
  fibonacci?: {
    level0: string;
    level236: string;
    level382: string;
    level50: string;
    level618: string;
    level786: string;
    level100: string;
    level127: string;
    level161: string;
  };
  fvg?: {
    bullish: string;
    bearish: string;
    bullishBorder: string;
    bearishBorder: string;
  };
  liquidityLevels?: {
    support: string;
    resistance: string;
    supportBg: string;
    resistanceBg: string;
  };
  indicatorZone?: string;
}

export const useChartColors = (): ChartThemeColors => {
  const { colorMode } = useColorMode();

  const colors = useMemo(() => {
    const themeColors = getChartColors(colorMode);

    return themeColors as ChartThemeColors;
  }, [colorMode]);

  return colors;
};
