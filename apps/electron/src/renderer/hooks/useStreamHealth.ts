import type { MarketType } from '@marketmind/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';

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
  const { isConnected, on, off } = useWebSocket({ autoConnect: enabled });
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

  const handleStreamHealth = useCallback(
    (payload: {
      symbol: string;
      interval: string;
      marketType: 'SPOT' | 'FUTURES';
      status: StreamHealthStatus;
      reason?: string;
      lastMessageAt: number | null;
    }) => {
      if (payload.symbol !== symbol || payload.interval !== interval || payload.marketType !== marketType) return;
      setStatus(payload.status);
      setReason(payload.reason ?? null);
      if (payload.lastMessageAt) {
        setLastMessageAt(payload.lastMessageAt);
        lastMessageAtRef.current = payload.lastMessageAt;
      }
    },
    [symbol, interval, marketType],
  );

  const handleKlineUpdate = useCallback(
    (kline: { symbol: string; interval: string }) => {
      if (kline.symbol !== symbol || kline.interval !== interval) return;
      const now = Date.now();
      lastMessageAtRef.current = now;
      setLastMessageAt(now);
      setStatus((prev) => (prev === 'degraded' ? 'healthy' : prev));
      setReason((prev) => (prev ? null : prev));
    },
    [symbol, interval],
  );

  useEffect(() => {
    if (!enabled || !isConnected || !symbol || !interval) return;
    on('stream:health', handleStreamHealth);
    on('kline:update', handleKlineUpdate);
    return () => {
      off('stream:health', handleStreamHealth);
      off('kline:update', handleKlineUpdate);
    };
  }, [enabled, isConnected, symbol, interval, marketType, on, off, handleStreamHealth, handleKlineUpdate]);

  useEffect(() => {
    if (!enabled || !symbol || !interval) return;

    const checkLocalSilence = () => {
      const last = lastMessageAtRef.current;
      if (last === null) return;
      const now = Date.now();
      if (now - last > LOCAL_SILENCE_THRESHOLD_MS) {
        setStatus((prev) => (prev === 'degraded' ? prev : 'degraded'));
        setReason((prev) => prev ?? 'local-silence-timeout');
      }
    };

    const id = setInterval(checkLocalSilence, LOCAL_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, symbol, interval]);

  return { status, reason, lastMessageAt };
};
