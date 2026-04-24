import type { Kline } from '@marketmind/types';
import { useMemo, useRef } from 'react';

export interface IndicatorCacheConfig {
  maxCacheSize?: number;
  ttlMs?: number;
}

const DEFAULT_CONFIG: Required<IndicatorCacheConfig> = {
  maxCacheSize: 10,
  ttlMs: 60000,
};

const computeKlineChecksum = (klines: Kline[], params: unknown[]): string => {
  if (klines.length === 0) return 'empty';

  const first = klines[0];
  const last = klines[klines.length - 1];
  if (!first || !last) return 'invalid';

  const klinesSignature = `${klines.length}:${first.openTime}:${last.closeTime}:${last.close}`;
  const paramsSignature = JSON.stringify(params);

  return `${klinesSignature}|${paramsSignature}`;
};

interface CacheEntry<T> {
  checksum: string;
  result: T;
  timestamp: number;
}

export const useIndicatorMemoize = <T>(
  calculator: () => T,
  klines: Kline[],
  params: unknown[],
  config?: IndicatorCacheConfig
): T => {
  const { ttlMs } = { ...DEFAULT_CONFIG, ...config };
  const cacheRef = useRef<CacheEntry<T> | null>(null);

  return useMemo(() => {
    const checksum = computeKlineChecksum(klines, params);
    const now = Date.now();

    if (cacheRef.current) {
      const { checksum: cachedChecksum, result, timestamp } = cacheRef.current;
      if (cachedChecksum === checksum && now - timestamp < ttlMs) {
        return result;
      }
    }

    const result = calculator();
    cacheRef.current = { checksum, result, timestamp: now };
    return result;
  }, [calculator, klines, params, ttlMs]);
};

export const useStableKlines = (klines: Kline[]): Kline[] => {
  const prevRef = useRef<Kline[]>([]);
  const checksumRef = useRef<string>('');

  return useMemo(() => {
    const newChecksum = computeKlineChecksum(klines, []);

    if (newChecksum === checksumRef.current) return prevRef.current;

    checksumRef.current = newChecksum;
    prevRef.current = klines;
    return klines;
  }, [klines]);
};

export interface IncrementalState<T> {
  lastIndex: number;
  partialResult: T;
}

export const useIncrementalIndicator = <T>(
  fullCalculator: (klines: Kline[]) => T,
  incrementalCalculator: (klines: Kline[], state: IncrementalState<T>) => T,
  klines: Kline[],
  params: unknown[]
): T => {
  const stateRef = useRef<{ checksum: string; state: IncrementalState<T> } | null>(null);

  return useMemo(() => {
    const paramsChecksum = JSON.stringify(params);

    if (stateRef.current?.checksum !== paramsChecksum) {
      const result = fullCalculator(klines);
      stateRef.current = {
        checksum: paramsChecksum,
        state: { lastIndex: klines.length - 1, partialResult: result },
      };
      return result;
    }

    const { state } = stateRef.current;

    if (klines.length <= state.lastIndex) {
      const result = fullCalculator(klines);
      stateRef.current = {
        checksum: paramsChecksum,
        state: { lastIndex: klines.length - 1, partialResult: result },
      };
      return result;
    }

    if (klines.length === state.lastIndex + 1) {
      const result = incrementalCalculator(klines, state);
      stateRef.current = {
        checksum: paramsChecksum,
        state: { lastIndex: klines.length - 1, partialResult: result },
      };
      return result;
    }

    const result = fullCalculator(klines);
    stateRef.current = {
      checksum: paramsChecksum,
      state: { lastIndex: klines.length - 1, partialResult: result },
    };
    return result;
  }, [fullCalculator, incrementalCalculator, klines, params]);
};
