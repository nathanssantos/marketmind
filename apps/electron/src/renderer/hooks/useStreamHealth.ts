import type { MarketType } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';
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

interface StreamHealthPayload {
  symbol: string;
  interval: string;
  marketType: 'SPOT' | 'FUTURES';
  status: StreamHealthStatus;
  reason?: string;
  lastMessageAt: number | null;
}

interface KlineUpdatePayload {
  symbol: string;
  interval: string;
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

  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  const marketTypeRef = useRef(marketType);
  useEffect(() => {
    symbolRef.current = symbol;
    intervalRef.current = interval;
    marketTypeRef.current = marketType;
  }, [symbol, interval, marketType]);

  useEffect(() => {
    setStatus('healthy');
    setReason(null);
    setLastMessageAt(null);
    lastMessageAtRef.current = null;
  }, [symbol, interval, marketType]);

  useEffect(() => {
    if (!enabled || !isConnected || !symbol || !interval) return;

    const onStreamHealth = (payload: StreamHealthPayload): void => {
      if (payload.symbol !== symbolRef.current) return;
      if (payload.interval !== intervalRef.current) return;
      if (payload.marketType !== marketTypeRef.current) return;
      setStatus(payload.status);
      setReason(payload.reason ?? null);
      if (payload.lastMessageAt) {
        setLastMessageAt(payload.lastMessageAt);
        lastMessageAtRef.current = payload.lastMessageAt;
      }
    };

    const onKlineUpdate = (kline: KlineUpdatePayload): void => {
      if (kline.symbol !== symbolRef.current) return;
      if (kline.interval !== intervalRef.current) return;
      lastMessageAtRef.current = Date.now();
    };

    on('stream:health', onStreamHealth);
    on('kline:update', onKlineUpdate);
    return () => {
      off('stream:health', onStreamHealth);
      off('kline:update', onKlineUpdate);
    };
  }, [enabled, isConnected, symbol, interval, marketType, on, off]);

  useEffect(() => {
    if (!enabled || !symbol || !interval) return;

    const checkLocalSilence = (): void => {
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
