import type { Drawing, KlineTimeLookup } from '@marketmind/chart-studies';
import { serializeDrawingData } from '@marketmind/chart-studies';
import { trpc } from '@renderer/services/trpc';
import { useDrawingStore } from '@renderer/store/drawingStore';

const DEBOUNCE_DELAY = 300;

interface BackendDrawing {
  id: number;
  symbol: string;
  interval: string;
  type: string;
  data: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const extractBackendId = (frontendId: string): number | null => {
  if (!frontendId.startsWith('backend-')) return null;
  const num = parseInt(frontendId.replace('backend-', ''), 10);
  return isNaN(num) ? null : num;
};

interface SymbolSync {
  refCount: number;
  unsubscribe: (() => void) | null;
  prevDrawings: Drawing[];
  updateTimers: Map<string, NodeJS.Timeout>;
  pendingCreates: Set<string>;
  getOpenTime: KlineTimeLookup;
  suppressed: boolean;
}

const symbolSyncs = new Map<string, SymbolSync>();

const handleCreate = async (drawing: Drawing, sync: SymbolSync) => {
  if (sync.pendingCreates.has(drawing.id)) return;
  sync.pendingCreates.add(drawing.id);

  try {
    const result = await trpc.drawing.create.mutate({
      symbol: drawing.symbol,
      interval: drawing.interval,
      type: drawing.type,
      data: serializeDrawingData(drawing, sync.getOpenTime),
      visible: drawing.visible,
      locked: drawing.locked,
      zIndex: drawing.zIndex,
    });

    const created = result as BackendDrawing;
    useDrawingStore.getState().setBackendId(drawing.id, drawing.symbol, drawing.interval, created.id);
  } catch (e) {
    console.warn('drawingSync create failed', e);
  } finally {
    sync.pendingCreates.delete(drawing.id);
  }
};

const handleUpdate = (drawingId: string, drawing: Drawing, sync: SymbolSync) => {
  const existing = sync.updateTimers.get(drawingId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    sync.updateTimers.delete(drawingId);
    const store = useDrawingStore.getState();
    const backendId = store.getBackendId(drawingId, drawing.symbol, drawing.interval);
    if (!backendId) return;

    try {
      void trpc.drawing.update.mutate({
        id: backendId,
        data: serializeDrawingData(drawing, sync.getOpenTime),
        visible: drawing.visible,
        locked: drawing.locked,
        zIndex: drawing.zIndex,
      });
    } catch (e) {
      console.warn('drawingSync update failed', e);
    }
  }, DEBOUNCE_DELAY);

  sync.updateTimers.set(drawingId, timer);
};

const handleDelete = (drawingId: string, drawing: Drawing) => {
  const store = useDrawingStore.getState();
  const backendId = store.getBackendId(drawingId, drawing.symbol, drawing.interval) ?? extractBackendId(drawingId);
  if (!backendId) return;

  store.removeBackendId(drawingId, drawing.symbol, drawing.interval);

  try {
    void trpc.drawing.delete.mutate({ id: backendId });
  } catch (e) {
    console.warn('drawingSync delete failed', e);
  }
};

const startSubscription = (syncKey: string, sync: SymbolSync) => {
  sync.unsubscribe = useDrawingStore.subscribe((state) => {
    if (sync.suppressed || !syncKey) return;

    const currentDrawings = state.drawingsByKey[syncKey] ?? [];
    const prevDrawings = sync.prevDrawings;

    const prevIds = new Set(prevDrawings.map((d) => d.id));
    const currentIds = new Set(currentDrawings.map((d) => d.id));
    const prevMap = new Map(prevDrawings.map((d) => [d.id, d]));

    for (const drawing of currentDrawings) {
      if (!prevIds.has(drawing.id)) {
        void handleCreate(drawing, sync);
        continue;
      }

      const prev = prevMap.get(drawing.id);
      if (prev && prev.updatedAt !== drawing.updatedAt) handleUpdate(drawing.id, drawing, sync);
    }

    for (const prevDrawing of prevDrawings) {
      if (!currentIds.has(prevDrawing.id)) handleDelete(prevDrawing.id, prevDrawing);
    }

    sync.prevDrawings = currentDrawings;
  });
};

export const drawingSyncManager = {
  registerSymbol(syncKey: string, getOpenTime: KlineTimeLookup) {
    const existing = symbolSyncs.get(syncKey);
    if (existing) {
      existing.refCount++;
      existing.getOpenTime = getOpenTime;
      return;
    }

    const sync: SymbolSync = {
      refCount: 1,
      unsubscribe: null,
      prevDrawings: useDrawingStore.getState().drawingsByKey[syncKey] ?? [],
      updateTimers: new Map(),
      pendingCreates: new Set(),
      getOpenTime,
      suppressed: false,
    };

    symbolSyncs.set(syncKey, sync);
    startSubscription(syncKey, sync);
  },

  unregisterSymbol(syncKey: string) {
    const sync = symbolSyncs.get(syncKey);
    if (!sync) return;

    sync.refCount--;
    if (sync.refCount > 0) return;

    sync.unsubscribe?.();
    for (const timer of sync.updateTimers.values()) clearTimeout(timer);
    sync.updateTimers.clear();
    symbolSyncs.delete(syncKey);
  },

  setSuppressSync(syncKey: string, suppressed: boolean) {
    const sync = symbolSyncs.get(syncKey);
    if (sync) {
      sync.suppressed = suppressed;
      if (!suppressed) sync.prevDrawings = useDrawingStore.getState().drawingsByKey[syncKey] ?? [];
    }
  },

  setOpenTimeLookup(syncKey: string, getOpenTime: KlineTimeLookup) {
    const sync = symbolSyncs.get(syncKey);
    if (sync) sync.getOpenTime = getOpenTime;
  },
};
