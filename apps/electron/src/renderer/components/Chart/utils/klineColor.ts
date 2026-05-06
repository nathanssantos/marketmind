import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineOpen } from '@shared/utils';

export const isKlineBullishInclusive = (kline: Kline | null | undefined): boolean => {
  if (!kline) return true;
  return getKlineClose(kline) >= getKlineOpen(kline);
};
