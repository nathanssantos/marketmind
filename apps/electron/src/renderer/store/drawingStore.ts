import type { Drawing, DrawingType } from '@marketmind/chart-studies';
import { create } from 'zustand';

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
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawingsBySymbol: {},
  activeTool: null,
  selectedDrawingId: null,
  magnetEnabled: false,

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

  clearAll: () => set({ drawingsBySymbol: {}, selectedDrawingId: null, activeTool: null }),
}));
