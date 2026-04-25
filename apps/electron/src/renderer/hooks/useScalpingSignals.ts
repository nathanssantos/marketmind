import { useCallback, useState } from 'react';
import type { ScalpingSignal } from '@marketmind/types';
import { useSocketEvent, useWalletStreamSubscription } from './socket';

const MAX_SIGNALS = 50;

export const useScalpingSignals = (walletId: string | null, enabled = true) => {
  const [signals, setSignals] = useState<ScalpingSignal[]>([]);
  const clearSignals = useCallback(() => setSignals([]), []);

  useWalletStreamSubscription('scalpingSignals', enabled && walletId ? walletId : undefined);

  useSocketEvent(
    'scalpingSignal:new',
    (signal) => {
      setSignals((prev) => {
        const next = [signal, ...prev];
        return next.length > MAX_SIGNALS ? next.slice(0, MAX_SIGNALS) : next;
      });
    },
    enabled && !!walletId,
  );

  return { signals, clearSignals };
};
