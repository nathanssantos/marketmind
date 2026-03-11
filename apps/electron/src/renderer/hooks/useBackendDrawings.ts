import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { deserializeDrawingData, serializeDrawingData } from '@marketmind/chart-studies';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { trpc } from '@renderer/services/trpc';
import { useDrawingStore } from '@renderer/store/drawingStore';

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

const backendToFrontend = (bd: BackendDrawing): Drawing | null =>
  deserializeDrawingData(bd.type as DrawingType, bd.data, {
    id: `backend-${bd.id}`,
    symbol: bd.symbol,
    visible: bd.visible,
    locked: bd.locked,
    zIndex: bd.zIndex,
    createdAt: new Date(bd.createdAt).getTime(),
    updatedAt: new Date(bd.updatedAt).getTime(),
  });

const extractBackendId = (frontendId: string): number | null => {
  if (!frontendId.startsWith('backend-')) return null;
  const num = parseInt(frontendId.replace('backend-', ''), 10);
  return isNaN(num) ? null : num;
};

export const useBackendDrawings = (symbol: string) => {
  const queryClient = useQueryClient();
  const backendIdMapRef = useRef<Map<string, number>>(new Map());
  const pendingCreatesRef = useRef<Set<string>>(new Set());
  const suppressSyncRef = useRef(false);
  const updateTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevDrawingsRef = useRef<Drawing[]>([]);

  const setDrawingsForSymbol = useDrawingStore((s) => s.setDrawingsForSymbol);

  const { data: backendDrawings, isLoading } = useQuery({
    queryKey: ['drawings', symbol],
    queryFn: () => trpc.drawing.listBySymbol.query({ symbol }),
    enabled: !!symbol,
    staleTime: 60_000,
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
    if (!backendDrawings || !symbol) return;

    suppressSyncRef.current = true;
    const newIdMap = new Map<string, number>();
    const drawings: Drawing[] = [];

    for (const bd of backendDrawings) {
      const drawing = backendToFrontend(bd as BackendDrawing);
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
  }, [backendDrawings, symbol, setDrawingsForSymbol]);

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
            data: serializeDrawingData(drawing),
            visible: drawing.visible,
            locked: drawing.locked,
            zIndex: drawing.zIndex,
          });
        } catch (_e) {
        }
      }, DEBOUNCE_DELAY);

      updateTimersRef.current.set(drawingId, timer);
    },
    [updateMutation]
  );

  const handleCreate = useCallback(
    async (drawing: Drawing) => {
      if (pendingCreatesRef.current.has(drawing.id)) return;
      pendingCreatesRef.current.add(drawing.id);

      try {
        const result = await createMutation.mutateAsync({
          symbol: drawing.symbol,
          type: drawing.type,
          data: serializeDrawingData(drawing),
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
    [createMutation]
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
