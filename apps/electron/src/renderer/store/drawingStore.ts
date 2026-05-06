import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { create } from 'zustand';
import { duplicateDrawing, type DuplicateOptions } from '@renderer/components/Chart/drawings/duplicateDrawing';

export const compositeKey = (symbol: string, interval: string) => `${symbol}:${interval}`;

const hydratedKeys = new Set<string>();
const backendIdMaps = new Map<string, Map<string, number>>();

type DrawingOp =
  | { kind: 'add'; key: string; drawing: Drawing }
  | { kind: 'update'; key: string; before: Drawing; after: Drawing }
  | { kind: 'delete'; key: string; drawing: Drawing };

const HISTORY_LIMIT = 100;
const undoStacks = new Map<string, DrawingOp[]>();
const redoStacks = new Map<string, DrawingOp[]>();
let isApplyingHistory = false;

const recordOp = (op: DrawingOp): void => {
  if (isApplyingHistory) return;
  const stack = undoStacks.get(op.key) ?? [];
  stack.push(op);
  if (stack.length > HISTORY_LIMIT) stack.shift();
  undoStacks.set(op.key, stack);
  redoStacks.delete(op.key);
};

let clipboardDrawing: Drawing | null = null;

export const setDrawingClipboard = (drawing: Drawing | null): void => {
  clipboardDrawing = drawing ? structuredClone(drawing) : null;
};

export const getDrawingClipboard = (): Drawing | null =>
  clipboardDrawing ? structuredClone(clipboardDrawing) : null;

interface DrawingState {
  drawingsByKey: Record<string, Drawing[]>;
  activeTool: DrawingType | null;
  selectedDrawingId: string | null;
  magnetEnabled: boolean;

  setActiveTool: (tool: DrawingType | null) => void;
  selectDrawing: (id: string | null) => void;
  setMagnetEnabled: (enabled: boolean) => void;

  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  deleteDrawing: (id: string, symbol: string, interval: string) => void;
  duplicateDrawing: (source: Drawing, options?: DuplicateOptions) => Drawing;
  getDrawingsForSymbol: (symbol: string, interval: string) => Drawing[];

  setDrawingsForSymbol: (symbol: string, interval: string, drawings: Drawing[]) => void;
  clearAll: () => void;

  markHydrated: (symbol: string, interval: string) => void;
  isHydrated: (symbol: string, interval: string) => boolean;
  setBackendIdMap: (symbol: string, interval: string, map: Map<string, number>) => void;
  getBackendId: (frontendId: string, symbol: string, interval: string) => number | undefined;
  setBackendId: (frontendId: string, symbol: string, interval: string, backendId: number) => void;
  removeBackendId: (frontendId: string, symbol: string, interval: string) => void;

  undo: (symbol: string, interval: string) => boolean;
  redo: (symbol: string, interval: string) => boolean;
  canUndo: (symbol: string, interval: string) => boolean;
  canRedo: (symbol: string, interval: string) => boolean;
  clearHistory: (symbol?: string, interval?: string) => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawingsByKey: {},
  activeTool: null,
  selectedDrawingId: null,
  magnetEnabled: true,

  setActiveTool: (tool) => set((state) => ({
    activeTool: state.activeTool === tool ? null : tool,
    selectedDrawingId: null,
  })),

  selectDrawing: (id) => set({ selectedDrawingId: id, activeTool: null }),

  setMagnetEnabled: (enabled) => set({ magnetEnabled: enabled }),

  addDrawing: (drawing) => {
    const key = compositeKey(drawing.symbol, drawing.interval);
    recordOp({ kind: 'add', key, drawing });
    set((state) => {
      const existing = state.drawingsByKey[key] ?? [];
      return {
        drawingsByKey: {
          ...state.drawingsByKey,
          [key]: [...existing, drawing],
        },
      };
    });
  },

  updateDrawing: (id, updates) => {
    const state = get();
    for (const [key, drawings] of Object.entries(state.drawingsByKey)) {
      const idx = drawings.findIndex(d => d.id === id);
      if (idx === -1) continue;
      const before = drawings[idx]!;
      const after = { ...before, ...updates, updatedAt: Date.now() } as Drawing;
      recordOp({ kind: 'update', key, before, after });
      const updated = [...drawings];
      updated[idx] = after;
      set({ drawingsByKey: { ...state.drawingsByKey, [key]: updated } });
      return;
    }
  },

  deleteDrawing: (id, symbol, interval) => {
    const key = compositeKey(symbol, interval);
    const state = get();
    const drawings = state.drawingsByKey[key];
    if (!drawings) return;
    const target = drawings.find(d => d.id === id);
    if (!target) return;
    recordOp({ kind: 'delete', key, drawing: target });
    set({
      drawingsByKey: {
        ...state.drawingsByKey,
        [key]: drawings.filter(d => d.id !== id),
      },
      selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
    });
  },

  duplicateDrawing: (source, options) => {
    const clone = duplicateDrawing(source, options);
    set((state) => {
      const key = compositeKey(clone.symbol, clone.interval);
      const existing = state.drawingsByKey[key] ?? [];
      return {
        drawingsByKey: {
          ...state.drawingsByKey,
          [key]: [...existing, clone],
        },
        selectedDrawingId: clone.id,
      };
    });
    return clone;
  },

  getDrawingsForSymbol: (symbol, interval) => get().drawingsByKey[compositeKey(symbol, interval)] ?? [],

  setDrawingsForSymbol: (symbol, interval, drawings) => set((state) => ({
    drawingsByKey: {
      ...state.drawingsByKey,
      [compositeKey(symbol, interval)]: drawings,
    },
  })),

  clearAll: () => {
    hydratedKeys.clear();
    backendIdMaps.clear();
    set({ drawingsByKey: {}, selectedDrawingId: null, activeTool: null });
  },

  markHydrated: (symbol, interval) => { hydratedKeys.add(compositeKey(symbol, interval)); },
  isHydrated: (symbol, interval) => hydratedKeys.has(compositeKey(symbol, interval)),

  setBackendIdMap: (symbol, interval, map) => { backendIdMaps.set(compositeKey(symbol, interval), map); },

  getBackendId: (frontendId, symbol, interval) => {
    const map = backendIdMaps.get(compositeKey(symbol, interval));
    return map?.get(frontendId);
  },

  setBackendId: (frontendId, symbol, interval, backendId) => {
    const key = compositeKey(symbol, interval);
    let map = backendIdMaps.get(key);
    if (!map) {
      map = new Map();
      backendIdMaps.set(key, map);
    }
    map.set(frontendId, backendId);
  },

  removeBackendId: (frontendId, symbol, interval) => {
    backendIdMaps.get(compositeKey(symbol, interval))?.delete(frontendId);
  },

  undo: (symbol, interval) => {
    const key = compositeKey(symbol, interval);
    const stack = undoStacks.get(key);
    if (!stack || stack.length === 0) return false;
    const op = stack.pop()!;
    undoStacks.set(key, stack);

    isApplyingHistory = true;
    try {
      const actions = get();
      if (op.kind === 'add') {
        actions.deleteDrawing(op.drawing.id, op.drawing.symbol, op.drawing.interval);
      } else if (op.kind === 'delete') {
        actions.addDrawing(op.drawing);
      } else {
        actions.updateDrawing(op.before.id, op.before);
      }
    } finally {
      isApplyingHistory = false;
    }

    const redo = redoStacks.get(key) ?? [];
    redo.push(op);
    redoStacks.set(key, redo);
    return true;
  },

  redo: (symbol, interval) => {
    const key = compositeKey(symbol, interval);
    const stack = redoStacks.get(key);
    if (!stack || stack.length === 0) return false;
    const op = stack.pop()!;
    redoStacks.set(key, stack);

    isApplyingHistory = true;
    try {
      const actions = get();
      if (op.kind === 'add') {
        actions.addDrawing(op.drawing);
      } else if (op.kind === 'delete') {
        actions.deleteDrawing(op.drawing.id, op.drawing.symbol, op.drawing.interval);
      } else {
        actions.updateDrawing(op.after.id, op.after);
      }
    } finally {
      isApplyingHistory = false;
    }

    const undo = undoStacks.get(key) ?? [];
    undo.push(op);
    undoStacks.set(key, undo);
    return true;
  },

  canUndo: (symbol, interval) => (undoStacks.get(compositeKey(symbol, interval))?.length ?? 0) > 0,
  canRedo: (symbol, interval) => (redoStacks.get(compositeKey(symbol, interval))?.length ?? 0) > 0,

  clearHistory: (symbol, interval) => {
    if (symbol === undefined || interval === undefined) {
      undoStacks.clear();
      redoStacks.clear();
      return;
    }
    const key = compositeKey(symbol, interval);
    undoStacks.delete(key);
    redoStacks.delete(key);
  },
}));
