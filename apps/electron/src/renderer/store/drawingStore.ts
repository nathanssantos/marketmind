import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { create } from 'zustand';
import { duplicateDrawing, type DuplicateOptions } from '@renderer/components/Chart/drawings/duplicateDrawing';

export const compositeKey = (symbol: string, interval: string) => `${symbol}:${interval}`;

const hydratedKeys = new Set<string>();
const backendIdMaps = new Map<string, Map<string, number>>();

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

  addDrawing: (drawing) => set((state) => {
    const key = compositeKey(drawing.symbol, drawing.interval);
    const existing = state.drawingsByKey[key] ?? [];
    return {
      drawingsByKey: {
        ...state.drawingsByKey,
        [key]: [...existing, drawing],
      },
    };
  }),

  updateDrawing: (id, updates) => set((state) => {
    for (const [key, drawings] of Object.entries(state.drawingsByKey)) {
      const idx = drawings.findIndex(d => d.id === id);
      if (idx === -1) continue;
      const updated = [...drawings];
      updated[idx] = { ...drawings[idx]!, ...updates, updatedAt: Date.now() } as Drawing;
      return { drawingsByKey: { ...state.drawingsByKey, [key]: updated } };
    }
    return state;
  }),

  deleteDrawing: (id, symbol, interval) => set((state) => {
    const key = compositeKey(symbol, interval);
    const drawings = state.drawingsByKey[key];
    if (!drawings) return state;
    return {
      drawingsByKey: {
        ...state.drawingsByKey,
        [key]: drawings.filter(d => d.id !== id),
      },
      selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
    };
  }),

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
}));
