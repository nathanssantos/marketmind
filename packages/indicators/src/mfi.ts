import type { Kline } from '@marketmind/types';

const DEFAULT_MFI_PERIOD = 14;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);

const getTypicalPrice = (kline: Kline): number => {
  return (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / 3;
};

export type MFIResult = (number | null)[];

export const calculateMFI = (
  klines: Kline[],
  period = DEFAULT_MFI_PERIOD,
): MFIResult => {
  const length = klines.length;

  if (length < period + 1) {
    return Array(length).fill(null);
  }

  const typicalPrices: number[] = klines.map(getTypicalPrice);
  const rawMoneyFlow: number[] = klines.map((kline, i) => {
    return typicalPrices[i]! * getKlineVolume(kline);
  });

  const result: MFIResult = [];

  for (let i = 0; i < length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const currentTP = typicalPrices[j];
      const prevTP = typicalPrices[j - 1];
      const currentMF = rawMoneyFlow[j];

      if (currentTP === undefined || prevTP === undefined || currentMF === undefined) continue;

      if (currentTP > prevTP) {
        positiveFlow += currentMF;
      } else if (currentTP < prevTP) {
        negativeFlow += currentMF;
      }
    }

    if (negativeFlow === 0) {
      result.push(100);
    } else if (positiveFlow === 0) {
      result.push(0);
    } else {
      const moneyFlowRatio = positiveFlow / negativeFlow;
      const mfi = 100 - (100 / (1 + moneyFlowRatio));
      result.push(mfi);
    }
  }

  return result;
};
