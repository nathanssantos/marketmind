import { useEffect, useState } from 'react';
import type { DepthLevel } from '@marketmind/types';
import { useSocketEvent, useSymbolStreamSubscription } from './socket';

export const useDepth = (symbol: string | null, enabled = true) => {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);

  useEffect(() => {
    setBids([]);
    setAsks([]);
  }, [symbol]);

  useSymbolStreamSubscription('depth', enabled && symbol ? symbol : undefined);

  useSocketEvent(
    'depth:update',
    (update) => {
      setBids(update.bids);
      setAsks(update.asks);
    },
    enabled && !!symbol,
  );

  return { bids, asks };
};
