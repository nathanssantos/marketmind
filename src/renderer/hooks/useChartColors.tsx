import { useColorMode } from '@/renderer/components/ui/color-mode';
import { getChartColors } from '@/renderer/theme';
import type { ChartColors } from '@shared/types';
import { useMemo } from 'react';

export interface ChartThemeColors extends ChartColors {
  axisLabel: string;
  axisLine: string;
  currentPriceLabel: {
    bg: string;
    text: string;
  };
  lineDefault: string;
  ma: [string, string, string];
  aiStudy: {
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
}

export const useChartColors = (): ChartThemeColors => {
  const { colorMode } = useColorMode();
  
  const colors = useMemo(() => {
    const themeColors = getChartColors(colorMode);
    
    if (import.meta.env.DEV) {
      console.log('[useChartColors] Theme colors:', {
        colorMode,
        background: themeColors.background,
        bullish: themeColors.bullish,
        bearish: themeColors.bearish,
      });
    }
    
    return themeColors as ChartThemeColors;
  }, [colorMode]);

  return colors;
};
