import { create } from 'zustand';

export interface ChartLayerFlags {
  drawings: boolean;
  indicators: boolean;
  orderLines: boolean;
  setupMarkers: boolean;
  heatmap: boolean;
}

const DEFAULT_FLAGS: ChartLayerFlags = {
  drawings: true,
  indicators: true,
  orderLines: true,
  setupMarkers: true,
  heatmap: true,
};

const compositeKey = (symbol: string, interval: string) => `${symbol}:${interval}`;

interface ChartLayersState {
  flagsByKey: Record<string, ChartLayerFlags>;
  getFlags: (symbol: string, interval: string) => ChartLayerFlags;
  setFlag: (symbol: string, interval: string, layer: keyof ChartLayerFlags, visible: boolean) => void;
  toggleFlag: (symbol: string, interval: string, layer: keyof ChartLayerFlags) => void;
}

export const useChartLayersStore = create<ChartLayersState>((set, get) => ({
  flagsByKey: {},

  getFlags: (symbol, interval) => {
    const key = compositeKey(symbol, interval);
    return get().flagsByKey[key] ?? DEFAULT_FLAGS;
  },

  setFlag: (symbol, interval, layer, visible) =>
    set((state) => {
      const key = compositeKey(symbol, interval);
      const current = state.flagsByKey[key] ?? DEFAULT_FLAGS;
      if (current[layer] === visible) return state;
      return {
        flagsByKey: {
          ...state.flagsByKey,
          [key]: { ...current, [layer]: visible },
        },
      };
    }),

  toggleFlag: (symbol, interval, layer) =>
    set((state) => {
      const key = compositeKey(symbol, interval);
      const current = state.flagsByKey[key] ?? DEFAULT_FLAGS;
      return {
        flagsByKey: {
          ...state.flagsByKey,
          [key]: { ...current, [layer]: !current[layer] },
        },
      };
    }),
}));

export const useChartLayerFlags = (symbol: string, interval: string): ChartLayerFlags =>
  useChartLayersStore((s) => s.flagsByKey[compositeKey(symbol, interval)] ?? DEFAULT_FLAGS);
