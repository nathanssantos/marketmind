import type { Kline } from '@marketmind/types';
import { getKlineTakerBuyBaseVolume, getKlineVolume } from '@marketmind/types';

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
