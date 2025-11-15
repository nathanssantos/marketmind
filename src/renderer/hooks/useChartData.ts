import type { Candle } from '@shared/types';
import { useEffect } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';
import { useChartContext } from '../context/ChartContext';

interface UseChartDataParams {
  candles: Candle[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
}

export const useChartData = (params: UseChartDataParams) => {
  const { setChartData } = useChartContext();

  useEffect(() => {
    setChartData(params);
  }, [params.candles, params.symbol, params.timeframe, params.chartType, params.showVolume, params.movingAverages, setChartData]);
};
