import type { MarketType } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';
import { useSocketEvent } from './socket';

const LOCAL_SILENCE_THRESHOLD_MS = 60_000;
const LOCAL_CHECK_INTERVAL_MS = 15_000;

export type StreamHealthStatus = 'healthy' | 'degraded';

export interface UseStreamHealthResult {
  status: StreamHealthStatus;
  reason: string | null;
  lastMessageAt: number | null;
}

export interface UseStreamHealthOptions {
  symbol: string;
  interval: string;
  marketType: MarketType;
  enabled?: boolean;
}

export const useStreamHealth = ({
  symbol,
  interval,
  marketType,
  enabled = true,
}: UseStreamHealthOptions): UseStreamHealthResult => {
  const [status, setStatus] = useState<StreamHealthStatus>('healthy');
  const [reason, setReason] = useState<string | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const lastMessageAtRef = useRef<number | null>(null);

  useEffect(() => {
    setStatus('healthy');
    setReason(null);
    setLastMessageAt(null);
    lastMessageAtRef.current = null;
  }, [symbol, interval, marketType]);

  useSocketEvent(
    'stream:health',
    (payload) => {
      if (payload.symbol !== symbol || payload.interval !== interval || payload.marketType !== marketType) return;
      setStatus(payload.status);
      setReason(payload.reason ?? null);
      if (payload.lastMessageAt) {
        setLastMessageAt(payload.lastMessageAt);
        lastMessageAtRef.current = payload.lastMessageAt;
      }
    },
    enabled && !!symbol && !!interval,
  );

  useSocketEvent(
    'kline:update',
    (kline) => {
      if (kline.symbol !== symbol || kline.interval !== interval) return;
      lastMessageAtRef.current = Date.now();
    },
    enabled && !!symbol && !!interval,
  );

  useEffect(() => {
    if (!enabled || !symbol || !interval) return;
    const checkLocalSilence = (): void => {
      const last = lastMessageAtRef.current;
      if (last === null) return;
      if (Date.now() - last > LOCAL_SILENCE_THRESHOLD_MS) {
        setStatus((prev) => (prev === 'degraded' ? prev : 'degraded'));
        setReason((prev) => prev ?? 'local-silence-timeout');
      }
    };
    const id = setInterval(checkLocalSilence, LOCAL_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, symbol, interval]);

  return { status, reason, lastMessageAt };
};
