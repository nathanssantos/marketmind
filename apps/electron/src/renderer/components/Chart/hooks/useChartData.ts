import type { Kline, Viewport } from '@shared/types';
import { useMemo } from 'react';

export interface UseChartDataProps {
  klines: Kline[];
  viewport: Viewport;
}

export interface UseChartDataResult {
  visibleKlines: Kline[];
  visibleStart: number;
  visibleEnd: number;
  priceRange: number;
  timeRange: number;
  isEmpty: boolean;
}

export const useChartData = ({
  klines,
  viewport,
}: UseChartDataProps): UseChartDataResult => {
  const result = useMemo(() => {
    if (klines.length === 0) {
      return {
        visibleKlines: [],
        visibleStart: 0,
        visibleEnd: 0,
        priceRange: 0,
        timeRange: 0,
        isEmpty: true,
      };
    }

    const visibleStart = Math.max(0, Math.floor(viewport.start));
    const visibleEnd = Math.min(klines.length, Math.ceil(viewport.end));
    const visibleKlines = klines.slice(visibleStart, visibleEnd);

    const priceRange = viewport.priceMax - viewport.priceMin;
    const timeRange = visibleEnd - visibleStart;

    return {
      visibleKlines,
      visibleStart,
      visibleEnd,
      priceRange,
      timeRange,
      isEmpty: visibleKlines.length === 0,
    };
  }, [klines, viewport]);

  return result;
};
