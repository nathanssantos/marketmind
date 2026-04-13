import type { Kline, MarketType } from '@marketmind/types';
import { useEffect, useRef } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import { useChartContext } from '../context/ChartContext';

interface UseChartDataParams {
  klines: Kline[];
  symbol: string;
  timeframe: Timeframe;
  chartType: string;
  showVolume: boolean;
  marketType?: MarketType;
}

export const useChartData = (params: UseChartDataParams) => {
  const { setChartData } = useChartContext();
  const prevParamsRef = useRef<string>('');

  useEffect(() => {
    const currentParams = JSON.stringify({
      klinesLength: params.klines.length,
      firstKline: params.klines[0]?.openTime,
      lastKline: params.klines[params.klines.length - 1]?.openTime,
      symbol: params.symbol,
      timeframe: params.timeframe,
      chartType: params.chartType,
      showVolume: params.showVolume,
      marketType: params.marketType,
    });

    if (currentParams !== prevParamsRef.current) {
      prevParamsRef.current = currentParams;
      setChartData(params);
    }
  }, [params, setChartData]);
};
