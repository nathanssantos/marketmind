import { useEffect } from 'react';
import { CLIENT_TO_SERVER_EVENTS, ROOMS } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

export const useKlineSubscription = (symbol: string | undefined, interval: string | undefined): void => {
  useEffect(() => {
    if (!symbol || !interval) return;
    return socketBus.subscribeRoom({
      dedupKey: ROOMS.klines(symbol, interval),
      subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribeKlines, { symbol, interval }),
      unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribeKlines, { symbol, interval }),
    });
  }, [symbol, interval]);
};
