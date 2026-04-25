import { useEffect, useMemo } from 'react';
import { CLIENT_TO_SERVER_EVENTS, ROOMS } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

/**
 * Subscribe a set of symbols to the live price stream. Refcounted across
 * consumers — if two hooks both watch BTCUSDT, the backend only receives one
 * subscribe and one unsubscribe.
 *
 * Pass a *stable* array (memoize upstream) or a comma-joined symbolsKey via the
 * deps to avoid resubscribe churn.
 */
export const usePriceSubscription = (symbols: readonly string[]): void => {
  const symbolsKey = useMemo(() => [...symbols].sort().join(','), [symbols]);

  useEffect(() => {
    if (!symbolsKey) return;
    const list = symbolsKey.split(',').filter(Boolean);
    const unsubs = list.map((symbol) =>
      socketBus.subscribeRoom({
        dedupKey: ROOMS.prices(symbol),
        subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribePricesBatch, [symbol]),
        unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribePrices, symbol),
      }),
    );
    return () => unsubs.forEach((fn) => fn());
  }, [symbolsKey]);
};
