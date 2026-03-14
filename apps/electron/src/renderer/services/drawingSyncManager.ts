import type { Drawing, DrawingType, KlineTimeLookup } from '@marketmind/chart-studies';
import { serializeDrawingData } from '@marketmind/chart-studies';
import { trpc } from '@renderer/services/trpc';
import { useDrawingStore } from '@renderer/store/drawingStore';

const DEBOUNCE_DELAY = 300;

interface BackendDrawing {
  id: number;
  symbol: string;
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
      type: drawing.type as DrawingType,
      data: serializeDrawingData(drawing, sync.getOpenTime),
      visible: drawing.visible,
      locked: drawing.locked,
      zIndex: drawing.zIndex,
    });

    const created = result as BackendDrawing;
    useDrawingStore.getState().setBackendId(drawing.id, drawing.symbol, created.id);
  } catch (_e) {
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
    const backendId = store.getBackendId(drawingId, drawing.symbol);
    if (!backendId) return;

    try {
      trpc.drawing.update.mutate({
        id: backendId,
        data: serializeDrawingData(drawing, sync.getOpenTime),
        visible: drawing.visible,
        locked: drawing.locked,
        zIndex: drawing.zIndex,
      });
    } catch (_e) {
    }
  }, DEBOUNCE_DELAY);

  sync.updateTimers.set(drawingId, timer);
};

const handleDelete = (drawingId: string, symbol: string) => {
  const store = useDrawingStore.getState();
  const backendId = store.getBackendId(drawingId, symbol) ?? extractBackendId(drawingId);
  if (!backendId) return;

  store.removeBackendId(drawingId, symbol);

  try {
    trpc.drawing.delete.mutate({ id: backendId });
  } catch (_e) {
  }
};

const startSubscription = (symbol: string, sync: SymbolSync) => {
  sync.unsubscribe = useDrawingStore.subscribe((state) => {
    if (sync.suppressed || !symbol) return;

    const currentDrawings = state.drawingsBySymbol[symbol] ?? [];
    const prevDrawings = sync.prevDrawings;

    const prevIds = new Set(prevDrawings.map((d) => d.id));
    const currentIds = new Set(currentDrawings.map((d) => d.id));
    const prevMap = new Map(prevDrawings.map((d) => [d.id, d]));

    for (const drawing of currentDrawings) {
      if (!prevIds.has(drawing.id)) {
        handleCreate(drawing, sync);
        continue;
      }

      const prev = prevMap.get(drawing.id);
      if (prev && prev.updatedAt !== drawing.updatedAt) handleUpdate(drawing.id, drawing, sync);
    }

    for (const prevDrawing of prevDrawings) {
      if (!currentIds.has(prevDrawing.id)) handleDelete(prevDrawing.id, symbol);
    }

    sync.prevDrawings = currentDrawings;
  });
};

export const drawingSyncManager = {
  registerSymbol(symbol: string, getOpenTime: KlineTimeLookup) {
    const existing = symbolSyncs.get(symbol);
    if (existing) {
      existing.refCount++;
      existing.getOpenTime = getOpenTime;
      return;
    }

    const sync: SymbolSync = {
      refCount: 1,
      unsubscribe: null,
      prevDrawings: useDrawingStore.getState().drawingsBySymbol[symbol] ?? [],
      updateTimers: new Map(),
      pendingCreates: new Set(),
      getOpenTime,
      suppressed: false,
    };

    symbolSyncs.set(symbol, sync);
    startSubscription(symbol, sync);
  },

  unregisterSymbol(symbol: string) {
    const sync = symbolSyncs.get(symbol);
    if (!sync) return;

    sync.refCount--;
    if (sync.refCount > 0) return;

    sync.unsubscribe?.();
    for (const timer of sync.updateTimers.values()) clearTimeout(timer);
    sync.updateTimers.clear();
    symbolSyncs.delete(symbol);
  },

  setSuppressSync(symbol: string, suppressed: boolean) {
    const sync = symbolSyncs.get(symbol);
    if (sync) {
      sync.suppressed = suppressed;
      if (!suppressed) sync.prevDrawings = useDrawingStore.getState().drawingsBySymbol[symbol] ?? [];
    }
  },

  setOpenTimeLookup(symbol: string, getOpenTime: KlineTimeLookup) {
    const sync = symbolSyncs.get(symbol);
    if (sync) sync.getOpenTime = getOpenTime;
  },
};
