import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { create } from 'zustand';

const hydratedSymbols = new Set<string>();
const backendIdMaps = new Map<string, Map<string, number>>();

interface DrawingState {
  drawingsBySymbol: Record<string, Drawing[]>;
  activeTool: DrawingType | null;
  selectedDrawingId: string | null;
  magnetEnabled: boolean;

  setActiveTool: (tool: DrawingType | null) => void;
  selectDrawing: (id: string | null) => void;
  setMagnetEnabled: (enabled: boolean) => void;

  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  deleteDrawing: (id: string, symbol: string) => void;
  getDrawingsForSymbol: (symbol: string) => Drawing[];

  setDrawingsForSymbol: (symbol: string, drawings: Drawing[]) => void;
  clearAll: () => void;

  markHydrated: (symbol: string) => void;
  isHydrated: (symbol: string) => boolean;
  setBackendIdMap: (symbol: string, map: Map<string, number>) => void;
  getBackendId: (frontendId: string, symbol: string) => number | undefined;
  setBackendId: (frontendId: string, symbol: string, backendId: number) => void;
  removeBackendId: (frontendId: string, symbol: string) => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawingsBySymbol: {},
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
    const existing = state.drawingsBySymbol[drawing.symbol] ?? [];
    return {
      drawingsBySymbol: {
        ...state.drawingsBySymbol,
        [drawing.symbol]: [...existing, drawing],
      },
    };
  }),

  updateDrawing: (id, updates) => set((state) => {
    const newBySymbol = { ...state.drawingsBySymbol };
    for (const [symbol, drawings] of Object.entries(newBySymbol)) {
      const idx = drawings.findIndex(d => d.id === id);
      if (idx !== -1) {
        const updated = [...drawings];
        updated[idx] = { ...drawings[idx]!, ...updates, updatedAt: Date.now() } as Drawing;
        newBySymbol[symbol] = updated;
        break;
      }
    }
    return { drawingsBySymbol: newBySymbol };
  }),

  deleteDrawing: (id, symbol) => set((state) => {
    const drawings = state.drawingsBySymbol[symbol];
    if (!drawings) return state;
    return {
      drawingsBySymbol: {
        ...state.drawingsBySymbol,
        [symbol]: drawings.filter(d => d.id !== id),
      },
      selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId,
    };
  }),

  getDrawingsForSymbol: (symbol) => get().drawingsBySymbol[symbol] ?? [],

  setDrawingsForSymbol: (symbol, drawings) => set((state) => ({
    drawingsBySymbol: {
      ...state.drawingsBySymbol,
      [symbol]: drawings,
    },
  })),

  clearAll: () => {
    hydratedSymbols.clear();
    backendIdMaps.clear();
    set({ drawingsBySymbol: {}, selectedDrawingId: null, activeTool: null });
  },

  markHydrated: (symbol) => { hydratedSymbols.add(symbol); },
  isHydrated: (symbol) => hydratedSymbols.has(symbol),

  setBackendIdMap: (symbol, map) => { backendIdMaps.set(symbol, map); },

  getBackendId: (frontendId, symbol) => {
    const map = backendIdMaps.get(symbol);
    return map?.get(frontendId);
  },

  setBackendId: (frontendId, symbol, backendId) => {
    let map = backendIdMaps.get(symbol);
    if (!map) {
      map = new Map();
      backendIdMaps.set(symbol, map);
    }
    map.set(frontendId, backendId);
  },

  removeBackendId: (frontendId, symbol) => {
    backendIdMaps.get(symbol)?.delete(frontendId);
  },
}));
