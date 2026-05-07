import { useLiveStream } from './useLiveStream';
import { useSymbolStreamSubscription } from './socket';

// Throttling, coalescing, and pan-aware backpressure are inherited
// from `LIVE_STREAM_POLICIES['bookTicker:update']` (currently 100ms,
// pan-multiplier 4× → 400ms while panning, shallow coalesce). Tune
// from there to globally adjust every BuySellButtons / ticket panel
// at once.
export const useBookTicker = (symbol: string | null, enabled = true) => {
  useSymbolStreamSubscription('bookTicker', enabled && symbol ? symbol : undefined);

  const data = useLiveStream('bookTicker:update', {
    enabled: enabled && !!symbol,
  });

  // Only surface payloads for the requested symbol — the bus is shared,
  // so a different ticket in another panel watching ETHUSDT could
  // otherwise leak into a BTCUSDT subscriber.
  const matches = data && (!symbol || data.symbol === symbol) ? data : null;

  return {
    bidPrice: matches?.bidPrice ?? 0,
    bidQty: matches?.bidQty ?? 0,
    askPrice: matches?.askPrice ?? 0,
    askQty: matches?.askQty ?? 0,
    microprice: matches?.microprice ?? 0,
    spread: matches?.spread ?? 0,
    spreadPercent: matches?.spreadPercent ?? 0,
    imbalanceRatio: 0,
  };
};
