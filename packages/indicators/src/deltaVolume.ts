import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineOpen, getKlineTakerBuyBaseVolume, getKlineVolume } from '@marketmind/types';

export interface DeltaVolumeResult {
  delta: number[];
  cumulativeDelta: number[];
  buyVolume: number[];
  sellVolume: number[];
}

export const calculateDeltaVolume = (klines: Kline[]): DeltaVolumeResult => {
  if (klines.length === 0) {
    return { delta: [], cumulativeDelta: [], buyVolume: [], sellVolume: [] };
  }

  const delta: number[] = [];
  const cumulativeDelta: number[] = [];
  const buyVolume: number[] = [];
  const sellVolume: number[] = [];

  let cumulativeSum = 0;

  for (let i = 0; i < klines.length; i++) {
    const volume = getKlineVolume(klines[i]!);
    const takerBuyVol = getKlineTakerBuyBaseVolume(klines[i]!);
    const takerSellVol = volume - takerBuyVol;

    buyVolume.push(takerBuyVol);
    sellVolume.push(takerSellVol);

    const deltaValue = takerBuyVol - takerSellVol;
    delta.push(deltaValue);

    cumulativeSum += deltaValue;
    cumulativeDelta.push(cumulativeSum);
  }

  return { delta, cumulativeDelta, buyVolume, sellVolume };
};

export const calculateDeltaVolumeEstimate = (klines: Kline[]): DeltaVolumeResult => {
  if (klines.length === 0) {
    return { delta: [], cumulativeDelta: [], buyVolume: [], sellVolume: [] };
  }

  const delta: number[] = [];
  const cumulativeDelta: number[] = [];
  const buyVolume: number[] = [];
  const sellVolume: number[] = [];

  let cumulativeSum = 0;

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i]!;
    const open = getKlineOpen(kline);
    const close = getKlineClose(kline);
    const volume = getKlineVolume(kline);

    const isBullish = close >= open;
    const buyVol = isBullish ? volume : volume * 0.3;
    const sellVol = isBullish ? volume * 0.3 : volume;

    buyVolume.push(buyVol);
    sellVolume.push(sellVol);

    const deltaValue = buyVol - sellVol;
    delta.push(deltaValue);

    cumulativeSum += deltaValue;
    cumulativeDelta.push(cumulativeSum);
  }

  return { delta, cumulativeDelta, buyVolume, sellVolume };
};
