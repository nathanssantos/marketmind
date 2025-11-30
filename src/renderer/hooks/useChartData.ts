import type { CalendarEvent, Kline, NewsArticle } from '@shared/types';
import { useEffect, useRef } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';
import { useChartContext } from '../context/ChartContext';

interface UseChartDataParams {
  candles: Kline[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
  news?: NewsArticle[] | undefined;
  events?: CalendarEvent[] | undefined;
}

export const useChartData = (params: UseChartDataParams) => {
  const { setChartData } = useChartContext();
  const prevParamsRef = useRef<string>('');

  useEffect(() => {
    const currentParams = JSON.stringify({
      candlesLength: params.candles.length,
      firstCandle: params.candles[0]?.openTime,
      lastCandle: params.candles[params.candles.length - 1]?.openTime,
      symbol: params.symbol,
      timeframe: params.timeframe,
      chartType: params.chartType,
      showVolume: params.showVolume,
      movingAverages: params.movingAverages,
      newsCount: params.news?.length,
      eventsCount: params.events?.length,
    });

    if (currentParams !== prevParamsRef.current) {
      prevParamsRef.current = currentParams;
      setChartData(params);
    }
  });
};
