import type { Kline } from '@marketmind/types';

export const calculateHighest = (klines: Kline[], period: number, source: string): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];

  const getSourceValue = (k: Kline): number => {
    switch (source) {
      case 'open': return parseFloat(k.open);
      case 'high': return parseFloat(k.high);
      case 'low': return parseFloat(k.low);
      case 'close': return parseFloat(k.close);
      case 'volume': return parseFloat(k.volume);
      default: return parseFloat(k.high);
    }
  };

  const result: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let highest = -Infinity;
    for (let j = 0; j < period; j++) {
      const kline = klines[i - j];
      if (kline) {
        const value = getSourceValue(kline);
        if (value > highest) highest = value;
      }
    }

    result.push(highest === -Infinity ? null : highest);
  }

  return result;
};

export const calculateLowest = (klines: Kline[], period: number, source: string): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];

  const getSourceValue = (k: Kline): number => {
    switch (source) {
      case 'open': return parseFloat(k.open);
      case 'high': return parseFloat(k.high);
      case 'low': return parseFloat(k.low);
      case 'close': return parseFloat(k.close);
      case 'volume': return parseFloat(k.volume);
      default: return parseFloat(k.low);
    }
  };

  const result: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let lowest = Infinity;
    for (let j = 0; j < period; j++) {
      const kline = klines[i - j];
      if (kline) {
        const value = getSourceValue(kline);
        if (value < lowest) lowest = value;
      }
    }

    result.push(lowest === Infinity ? null : lowest);
  }

  return result;
};

export const calculateVolumeSMA = (klines: Kline[], period: number): (number | null)[] => {
  if (period <= 0 || klines.length === 0) return [];

  const result: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      const kline = klines[i - j];
      if (!kline) continue;
      sum += parseFloat(kline.volume);
    }

    result.push(sum / period);
  }

  return result;
};
