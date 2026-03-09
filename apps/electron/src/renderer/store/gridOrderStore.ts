import { create } from 'zustand';

export const GRID_ORDER_LIMITS = {
  MIN_ORDERS: 2,
  MAX_ORDERS: 50,
  DEFAULT_ORDERS: 10,
  MIN_SNAP_DISTANCE_PX: 3,
  MAX_SNAP_DISTANCE_PX: 30,
  DEFAULT_SNAP_DISTANCE_PX: 10,
} as const;

interface GridOrderState {
  isGridModeActive: boolean;
  gridSide: 'BUY' | 'SELL';
  gridCount: number;
  snapEnabled: boolean;
  snapDistancePx: number;
  isDrawingGrid: boolean;
  startPrice: number | null;
  endPrice: number | null;

  setGridModeActive: (active: boolean) => void;
  toggleGridMode: () => void;
  setGridSide: (side: 'BUY' | 'SELL') => void;
  setGridCount: (count: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapDistancePx: (px: number) => void;
  setIsDrawingGrid: (drawing: boolean) => void;
  setStartPrice: (price: number | null) => void;
  setEndPrice: (price: number | null) => void;
  resetDrawing: () => void;
}

export const useGridOrderStore = create<GridOrderState>((set) => ({
  isGridModeActive: false,
  gridSide: 'BUY',
  gridCount: GRID_ORDER_LIMITS.DEFAULT_ORDERS,
  snapEnabled: true,
  snapDistancePx: GRID_ORDER_LIMITS.DEFAULT_SNAP_DISTANCE_PX,
  isDrawingGrid: false,
  startPrice: null,
  endPrice: null,

  setGridModeActive: (active) => set({ isGridModeActive: active, isDrawingGrid: false, startPrice: null, endPrice: null }),
  toggleGridMode: () => set((s) => ({ isGridModeActive: !s.isGridModeActive, isDrawingGrid: false, startPrice: null, endPrice: null })),
  setGridSide: (side) => set({ gridSide: side }),
  setGridCount: (count) => set({ gridCount: Math.max(GRID_ORDER_LIMITS.MIN_ORDERS, Math.min(GRID_ORDER_LIMITS.MAX_ORDERS, count)) }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setSnapDistancePx: (px) => set({ snapDistancePx: Math.max(GRID_ORDER_LIMITS.MIN_SNAP_DISTANCE_PX, Math.min(GRID_ORDER_LIMITS.MAX_SNAP_DISTANCE_PX, px)) }),
  setIsDrawingGrid: (drawing) => set({ isDrawingGrid: drawing }),
  setStartPrice: (price) => set({ startPrice: price }),
  setEndPrice: (price) => set({ endPrice: price }),
  resetDrawing: () => set({ isDrawingGrid: false, startPrice: null, endPrice: null }),
}));
