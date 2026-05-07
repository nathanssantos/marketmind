import type { DepthLevel, DepthUpdate } from '@marketmind/types';
import { useLiveStream } from './useLiveStream';
import { useSymbolStreamSubscription } from './socket';

// Throttling and pan-aware backpressure inherited from
// `LIVE_STREAM_POLICIES['depth:update']` (250ms, 4× during pan).
// Order-book ladder updates are visually indistinguishable at 4Hz vs
// realtime, but the per-tick re-render of N price rows was visible
// in profiler traces during multi-chart sessions.
export const useDepth = (symbol: string | null, enabled = true): { bids: DepthLevel[]; asks: DepthLevel[] } => {
  useSymbolStreamSubscription('depth', enabled && symbol ? symbol : undefined);

  const data = useLiveStream('depth:update', {
    enabled: enabled && !!symbol,
  }) as DepthUpdate | null;

  const matches = data && (!symbol || data.symbol === symbol) ? data : null;

  return {
    bids: matches?.bids ?? [],
    asks: matches?.asks ?? [],
  };
};
