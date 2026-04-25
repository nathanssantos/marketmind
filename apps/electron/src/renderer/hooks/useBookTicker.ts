import { useEffect, useState } from 'react';
import type { BookTickerUpdate } from '@marketmind/types';
import { useSocketEvent, useSymbolStreamSubscription } from './socket';

export const useBookTicker = (symbol: string | null, enabled = true) => {
  const [data, setData] = useState<BookTickerUpdate | null>(null);

  useEffect(() => {
    setData(null);
  }, [symbol]);

  useSymbolStreamSubscription('bookTicker', enabled && symbol ? symbol : undefined);

  useSocketEvent('bookTicker:update', (update) => setData(update), enabled && !!symbol);

  return {
    bidPrice: data?.bidPrice ?? 0,
    bidQty: data?.bidQty ?? 0,
    askPrice: data?.askPrice ?? 0,
    askQty: data?.askQty ?? 0,
    microprice: data?.microprice ?? 0,
    spread: data?.spread ?? 0,
    spreadPercent: data?.spreadPercent ?? 0,
    imbalanceRatio: 0,
  };
};
