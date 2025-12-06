import { useColorMode } from '@/renderer/components/ui/color-mode';
import { getChartColors } from '@/renderer/theme';
import type { ChartColors } from '@shared/types';
import { useMemo } from 'react';

export interface ChartThemeColors extends ChartColors {
  text: string;
  axisLabel: string;
  axisLine: string;
  crosshair: string;
  currentPriceLabel: {
    bg: string;
    text: string;
  };
  lineDefault: string;
  ma: [string, string, string];
  aiPattern: {
    support: string;
    resistance: string;
    trendlineBullish: string;
    trendlineBearish: string;
    liquidityZone: string;
    sellZone: string;
    buyZone: string;
    accumulationZone: string;
    tooltip: {
      bg: string;
      text: string;
      border: string;
    };
  };
  stochastic: {
    k: string;
    d: string;
    zone: string;
  };
  rsi: {
    line: string;
    zone: string;
  };
}

export const useChartColors = (): ChartThemeColors => {
  const { colorMode } = useColorMode();

  const colors = useMemo(() => {
    const themeColors = getChartColors(colorMode);

    return themeColors as ChartThemeColors;
  }, [colorMode]);

  return colors;
};
