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

interface ChartLayersState {
  // Keyed on the chart-panel ID (the unique grid-panel id inside the
  // active layout). Earlier this was keyed on `${symbol}:${interval}`,
  // which leaked state across layouts: two BTC@1h panels in different
  // layouts shared flags. Per-panel scoping lets each chart in a
  // layout carry its own visibility set.
  flagsByPanelId: Record<string, ChartLayerFlags>;
  getFlags: (panelId: string) => ChartLayerFlags;
  setFlag: (panelId: string, layer: keyof ChartLayerFlags, visible: boolean) => void;
  toggleFlag: (panelId: string, layer: keyof ChartLayerFlags) => void;
  /** Drop entries for panels that no longer exist (called on layout teardown). */
  pruneRemovedPanels: (knownPanelIds: Set<string>) => void;
}

export const useChartLayersStore = create<ChartLayersState>((set, get) => ({
  flagsByPanelId: {},

  getFlags: (panelId) => get().flagsByPanelId[panelId] ?? DEFAULT_FLAGS,

  setFlag: (panelId, layer, visible) =>
    set((state) => {
      const current = state.flagsByPanelId[panelId] ?? DEFAULT_FLAGS;
      if (current[layer] === visible) return state;
      return {
        flagsByPanelId: {
          ...state.flagsByPanelId,
          [panelId]: { ...current, [layer]: visible },
        },
      };
    }),

  toggleFlag: (panelId, layer) =>
    set((state) => {
      const current = state.flagsByPanelId[panelId] ?? DEFAULT_FLAGS;
      return {
        flagsByPanelId: {
          ...state.flagsByPanelId,
          [panelId]: { ...current, [layer]: !current[layer] },
        },
      };
    }),

  pruneRemovedPanels: (knownPanelIds) =>
    set((state) => {
      const next: Record<string, ChartLayerFlags> = {};
      let changed = false;
      for (const [id, flags] of Object.entries(state.flagsByPanelId)) {
        if (knownPanelIds.has(id)) next[id] = flags;
        else changed = true;
      }
      return changed ? { flagsByPanelId: next } : state;
    }),
}));

export const useChartLayerFlags = (panelId: string): ChartLayerFlags =>
  useChartLayersStore((s) => s.flagsByPanelId[panelId] ?? DEFAULT_FLAGS);
