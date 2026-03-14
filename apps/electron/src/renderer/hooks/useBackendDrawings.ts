import type { Drawing, DrawingType, TimeToIndexLookup } from '@marketmind/chart-studies';
import { deserializeDrawingData } from '@marketmind/chart-studies';
import type { KlineTimeLookup } from '@marketmind/chart-studies';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { trpc } from '@renderer/services/trpc';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { drawingSyncManager } from '@renderer/services/drawingSyncManager';
import type { Kline } from '@marketmind/types';

interface BackendDrawing {
  id: number;
  userId: string;
  symbol: string;
  type: string;
  data: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const buildTimeToIndex = (klines: Kline[]): TimeToIndexLookup => {
  const timeMap = new Map<number, number>();
  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    if (k) timeMap.set(k.openTime, i);
  }

  return (time: number): number => {
    const exact = timeMap.get(time);
    if (exact !== undefined) return exact;

    let lo = 0;
    let hi = klines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const midTime = klines[mid]?.openTime ?? 0;
      if (midTime < time) lo = mid + 1;
      else if (midTime > time) hi = mid - 1;
      else return mid;
    }
    return Math.max(0, Math.min(lo, klines.length - 1));
  };
};

const buildGetOpenTime = (klines: Kline[]): KlineTimeLookup =>
  (index: number): number | undefined => {
    const clamped = Math.round(Math.max(0, Math.min(index, klines.length - 1)));
    return klines[clamped]?.openTime;
  };

export const useBackendDrawings = (symbol: string, klines: Kline[]) => {
  const klinesRef = useRef<Kline[]>(klines);
  klinesRef.current = klines;

  const { data: backendDrawings, isLoading } = useQuery({
    queryKey: ['drawings', symbol],
    queryFn: () => trpc.drawing.listBySymbol.query({ symbol }),
    enabled: !!symbol,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!backendDrawings || !symbol || klines.length === 0) return;
    const store = useDrawingStore.getState();
    if (store.isHydrated(symbol)) return;

    store.markHydrated(symbol);
    drawingSyncManager.setSuppressSync(symbol, true);

    const timeToIndex = buildTimeToIndex(klines);
    const newIdMap = new Map<string, number>();
    const drawings: Drawing[] = [];

    for (const bd of backendDrawings) {
      const drawing = deserializeDrawingData(
        bd.type as DrawingType,
        (bd as BackendDrawing).data,
        {
          id: `backend-${bd.id}`,
          symbol: (bd as BackendDrawing).symbol,
          visible: (bd as BackendDrawing).visible,
          locked: (bd as BackendDrawing).locked,
          zIndex: (bd as BackendDrawing).zIndex,
          createdAt: new Date((bd as BackendDrawing).createdAt).getTime(),
          updatedAt: new Date((bd as BackendDrawing).updatedAt).getTime(),
        },
        timeToIndex,
      );
      if (!drawing) continue;
      newIdMap.set(drawing.id, bd.id);
      drawings.push(drawing);
    }

    store.setBackendIdMap(symbol, newIdMap);
    store.setDrawingsForSymbol(symbol, drawings);

    requestAnimationFrame(() => {
      drawingSyncManager.setSuppressSync(symbol, false);
    });
  }, [backendDrawings, symbol, klines.length]);

  const getOpenTime = useCallback(
    (): KlineTimeLookup => buildGetOpenTime(klinesRef.current),
    []
  );

  useEffect(() => {
    if (!symbol) return;
    drawingSyncManager.registerSymbol(symbol, getOpenTime());
    return () => drawingSyncManager.unregisterSymbol(symbol);
  }, [symbol, getOpenTime]);

  useEffect(() => {
    if (!symbol) return;
    drawingSyncManager.setOpenTimeLookup(symbol, getOpenTime());
  }, [symbol, klines.length, getOpenTime]);

  return { isLoading };
};
