import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { deserializeDrawingData, serializeDrawingData } from '@marketmind/chart-studies';
import type { KlineTimeLookup, TimeToIndexLookup } from '@marketmind/chart-studies';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { trpc } from '@renderer/services/trpc';
import { useDrawingStore } from '@renderer/store/drawingStore';
import type { Kline } from '@marketmind/types';

const DEBOUNCE_DELAY = 300;

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

const extractBackendId = (frontendId: string): number | null => {
  if (!frontendId.startsWith('backend-')) return null;
  const num = parseInt(frontendId.replace('backend-', ''), 10);
  return isNaN(num) ? null : num;
};

export const useBackendDrawings = (symbol: string, klines: Kline[]) => {
  const queryClient = useQueryClient();
  const backendIdMapRef = useRef<Map<string, number>>(new Map());
  const pendingCreatesRef = useRef<Set<string>>(new Set());
  const suppressSyncRef = useRef(false);
  const updateTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevDrawingsRef = useRef<Drawing[]>([]);
  const klinesRef = useRef<Kline[]>(klines);
  klinesRef.current = klines;

  const setDrawingsForSymbol = useDrawingStore((s) => s.setDrawingsForSymbol);

  const { data: backendDrawings, isLoading } = useQuery({
    queryKey: ['drawings', symbol],
    queryFn: () => trpc.drawing.listBySymbol.query({ symbol }),
    enabled: !!symbol,
    staleTime: 5000,
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      symbol: string;
      type: DrawingType;
      data: string;
      visible: boolean;
      locked: boolean;
      zIndex: number;
    }) => trpc.drawing.create.mutate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drawings', symbol] }),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: number;
      data?: string;
      visible?: boolean;
      locked?: boolean;
      zIndex?: number;
    }) => trpc.drawing.update.mutate(input),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpc.drawing.delete.mutate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drawings', symbol] }),
  });

  useEffect(() => {
    if (!backendDrawings || !symbol || klines.length === 0) return;
    if (updateTimersRef.current.size > 0) return;

    suppressSyncRef.current = true;
    const newIdMap = new Map<string, number>();
    const drawings: Drawing[] = [];
    const timeToIndex = buildTimeToIndex(klines);

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

    backendIdMapRef.current = newIdMap;
    setDrawingsForSymbol(symbol, drawings);
    prevDrawingsRef.current = drawings;

    requestAnimationFrame(() => {
      suppressSyncRef.current = false;
    });
  }, [backendDrawings, symbol, klines.length, setDrawingsForSymbol]);

  const getOpenTime = useCallback((): KlineTimeLookup => buildGetOpenTime(klinesRef.current), []);

  const debouncedUpdate = useCallback(
    (drawingId: string, drawing: Drawing) => {
      const existing = updateTimersRef.current.get(drawingId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        updateTimersRef.current.delete(drawingId);
        const backendId = backendIdMapRef.current.get(drawingId);
        if (!backendId) return;

        try {
          updateMutation.mutate({
            id: backendId,
            data: serializeDrawingData(drawing, getOpenTime()),
            visible: drawing.visible,
            locked: drawing.locked,
            zIndex: drawing.zIndex,
          });
        } catch (_e) {
        }
      }, DEBOUNCE_DELAY);

      updateTimersRef.current.set(drawingId, timer);
    },
    [updateMutation, getOpenTime]
  );

  const handleCreate = useCallback(
    async (drawing: Drawing) => {
      if (pendingCreatesRef.current.has(drawing.id)) return;
      pendingCreatesRef.current.add(drawing.id);

      try {
        const result = await createMutation.mutateAsync({
          symbol: drawing.symbol,
          type: drawing.type,
          data: serializeDrawingData(drawing, getOpenTime()),
          visible: drawing.visible,
          locked: drawing.locked,
          zIndex: drawing.zIndex,
        });

        const created = result as BackendDrawing;
        backendIdMapRef.current.set(drawing.id, created.id);
      } catch (_e) {
      } finally {
        pendingCreatesRef.current.delete(drawing.id);
      }
    },
    [createMutation, getOpenTime]
  );

  const handleDelete = useCallback(
    (drawingId: string) => {
      const backendId = backendIdMapRef.current.get(drawingId) ?? extractBackendId(drawingId);
      if (!backendId) return;

      backendIdMapRef.current.delete(drawingId);

      try {
        deleteMutation.mutate(backendId);
      } catch (_e) {
      }
    },
    [deleteMutation]
  );

  useEffect(() => {
    const unsubscribe = useDrawingStore.subscribe((state) => {
      if (suppressSyncRef.current || !symbol) return;

      const currentDrawings = state.drawingsBySymbol[symbol] ?? [];
      const prevDrawings = prevDrawingsRef.current;

      const prevIds = new Set(prevDrawings.map((d) => d.id));
      const currentIds = new Set(currentDrawings.map((d) => d.id));
      const prevMap = new Map(prevDrawings.map((d) => [d.id, d]));

      for (const drawing of currentDrawings) {
        if (!prevIds.has(drawing.id)) {
          handleCreate(drawing);
          continue;
        }

        const prev = prevMap.get(drawing.id);
        if (prev && prev.updatedAt !== drawing.updatedAt) {
          debouncedUpdate(drawing.id, drawing);
        }
      }

      for (const prevDrawing of prevDrawings) {
        if (!currentIds.has(prevDrawing.id)) {
          handleDelete(prevDrawing.id);
        }
      }

      prevDrawingsRef.current = currentDrawings;
    });

    return () => {
      unsubscribe();
      for (const timer of updateTimersRef.current.values()) {
        clearTimeout(timer);
      }
      updateTimersRef.current.clear();
    };
  }, [symbol, handleCreate, handleDelete, debouncedUpdate]);

  return {
    isLoading,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
