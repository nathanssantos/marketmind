import { useMemo, useRef } from 'react';
import type { Kline, Viewport } from '@marketmind/types';

export interface VirtualizedKlinesResult {
  visibleKlines: Kline[];
  startIndex: number;
  endIndex: number;
  totalCount: number;
  isBuffered: boolean;
}

export interface UseVirtualizedKlinesProps {
  klines: Kline[];
  viewport: Viewport;
  buffer?: number;
  enabled?: boolean;
}

const DEFAULT_BUFFER = 50;

export const useVirtualizedKlines = ({
  klines,
  viewport,
  buffer = DEFAULT_BUFFER,
  enabled = true,
}: UseVirtualizedKlinesProps): VirtualizedKlinesResult => {
  const cacheRef = useRef<{
    klines: Kline[];
    viewportStart: number;
    viewportEnd: number;
    buffer: number;
    result: VirtualizedKlinesResult;
  } | null>(null);

  return useMemo(() => {
    if (!enabled || klines.length === 0) {
      return {
        visibleKlines: klines,
        startIndex: 0,
        endIndex: klines.length,
        totalCount: klines.length,
        isBuffered: false,
      };
    }

    const viewportStart = Math.floor(viewport.start);
    const viewportEnd = Math.ceil(viewport.end);

    if (
      cacheRef.current &&
      cacheRef.current.klines === klines &&
      cacheRef.current.buffer === buffer &&
      viewportStart >= cacheRef.current.viewportStart + buffer / 2 &&
      viewportEnd <= cacheRef.current.viewportEnd - buffer / 2
    ) {
      return cacheRef.current.result;
    }

    const startIndex = Math.max(0, viewportStart - buffer);
    const endIndex = Math.min(klines.length, viewportEnd + buffer);

    const result: VirtualizedKlinesResult = {
      visibleKlines: klines.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalCount: klines.length,
      isBuffered: buffer > 0,
    };

    cacheRef.current = {
      klines,
      viewportStart: startIndex,
      viewportEnd: endIndex,
      buffer,
      result,
    };

    return result;
  }, [klines, viewport.start, viewport.end, buffer, enabled]);
};

export const getVisibleRange = (
  viewport: Viewport,
  klinesLength: number,
  buffer: number = 0
): { start: number; end: number } => {
  const viewportStart = Math.floor(viewport.start);
  const viewportEnd = Math.ceil(viewport.end);

  return {
    start: Math.max(0, viewportStart - buffer),
    end: Math.min(klinesLength, viewportEnd + buffer),
  };
};

export const isKlineVisible = (
  index: number,
  viewport: Viewport,
  buffer: number = 0
): boolean => {
  const viewportStart = Math.floor(viewport.start);
  const viewportEnd = Math.ceil(viewport.end);

  return index >= viewportStart - buffer && index <= viewportEnd + buffer;
};

export const calculateOptimalBuffer = (
  viewportRange: number,
  scrollSpeed: number = 1
): number => {
  const baseBuffer = Math.ceil(viewportRange * 0.5);
  const speedFactor = Math.min(2, Math.max(0.5, scrollSpeed));
  return Math.ceil(baseBuffer * speedFactor);
};
