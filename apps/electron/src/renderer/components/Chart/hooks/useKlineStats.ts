import type { Kline } from '@marketmind/types';
import {
  getKlineAverageTradeValue,
  getKlineBuyPressure,
  getKlineClose,
  getKlineOpen,
  getKlinePressureType,
  getKlineQuoteVolume,
  getKlineTrades,
} from '@shared/utils';

export interface KlineStats {
  isBullish: boolean;
  change: number;
  changePercent: string;
  buyPressure: number;
  pressureType: 'buy' | 'sell' | 'neutral';
  trades: number;
  quoteVolume: number;
  avgTradeValue: number;
}

export const calculateKlineStats = (kline: Kline | null): KlineStats => {
  if (!kline) {
    return {
      isBullish: false,
      change: 0,
      changePercent: '0.00',
      buyPressure: 0.5,
      pressureType: 'neutral',
      trades: 0,
      quoteVolume: 0,
      avgTradeValue: 0,
    };
  }

  const open = getKlineOpen(kline);
  const close = getKlineClose(kline);
  const isBullish = close >= open;
  const change = close - open;
  const changePercent = ((change / open) * 100).toFixed(2);

  return {
    isBullish,
    change,
    changePercent,
    buyPressure: getKlineBuyPressure(kline),
    pressureType: getKlinePressureType(kline),
    trades: getKlineTrades(kline),
    quoteVolume: getKlineQuoteVolume(kline),
    avgTradeValue: getKlineAverageTradeValue(kline),
  };
};
