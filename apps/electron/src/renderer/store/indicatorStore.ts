import type { IndicatorParamValue } from '@marketmind/trading-core';
import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

export interface IndicatorInstance {
  id: string;
  userIndicatorId: string;
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
  visible: boolean;
  /**
   * Sub-pane ID INSIDE a chart-panel (e.g. `'stochastic'`, `'rsi'`)
   * — used to stack indicators of the same kind into the same
   * bottom strip. Not the grid-panel id.
   */
  paneId?: string;
  /**
   * Grid-panel ID this indicator instance belongs to. Optional for
   * legacy reasons (older saved state may have no panelId — those
   * instances are treated as "global" and won't render anywhere
   * after the bug fix). Going forward, every new instance must have
   * panelId set so it only renders on the focused chart.
   */
  panelId?: string;
  zIndex?: number;
}

const generateInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const syncInstancesToPreferences = (instances: IndicatorInstance[]) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('chart', 'indicatorInstances', instances);
};

interface IndicatorState {
  instances: IndicatorInstance[];

  hydrate: (data: { instances?: IndicatorInstance[] | unknown }) => void;

  addInstance: (input: Omit<IndicatorInstance, 'id'>) => string;
  removeInstance: (id: string) => void;
  removeInstancesByUserIndicatorId: (userIndicatorId: string, panelId?: string) => void;
  updateInstance: (id: string, patch: Partial<Omit<IndicatorInstance, 'id'>>) => void;
  toggleInstanceVisible: (id: string) => void;
  reorderInstances: (ids: string[]) => void;
  getVisibleInstances: () => IndicatorInstance[];
  /** Filters instances by sub-pane ID (e.g. `'stochastic'`). */
  getInstancesByPaneId: (paneId: string) => IndicatorInstance[];
  /** Filters instances by grid-panel ID (the chart this instance is bound to). */
  getInstancesByPanelId: (panelId: string) => IndicatorInstance[];
  /** Drop entries for grid-panels that no longer exist. */
  pruneRemovedPanels: (knownPanelIds: Set<string>) => void;
}

const sanitizeInstance = (raw: unknown): IndicatorInstance | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<IndicatorInstance>;
  if (typeof candidate.userIndicatorId !== 'string') return null;
  if (typeof candidate.catalogType !== 'string') return null;
  if (!candidate.params || typeof candidate.params !== 'object') return null;
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : generateInstanceId(),
    userIndicatorId: candidate.userIndicatorId,
    catalogType: candidate.catalogType,
    params: candidate.params,
    visible: candidate.visible !== false,
    paneId: typeof candidate.paneId === 'string' ? candidate.paneId : undefined,
    panelId: typeof candidate.panelId === 'string' ? candidate.panelId : undefined,
    zIndex: typeof candidate.zIndex === 'number' ? candidate.zIndex : undefined,
  };
};

const sanitizeInstances = (raw: unknown): IndicatorInstance[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeInstance)
    .filter((inst): inst is IndicatorInstance => inst !== null);
};

export const useIndicatorStore = create<IndicatorState>()((set, get) => ({
  instances: [],

  hydrate: (data) => {
    if (data.instances === undefined) return;
    set({ instances: sanitizeInstances(data.instances) });
  },

  addInstance: (input) => {
    const id = generateInstanceId();
    const next: IndicatorInstance = {
      id,
      userIndicatorId: input.userIndicatorId,
      catalogType: input.catalogType,
      params: { ...input.params },
      visible: input.visible !== false,
      paneId: input.paneId,
      panelId: input.panelId,
      zIndex: input.zIndex,
    };
    set((state) => {
      const instances = [...state.instances, next];
      syncInstancesToPreferences(instances);
      return { instances };
    });
    return id;
  },

  removeInstance: (id) =>
    set((state) => {
      const instances = state.instances.filter((inst) => inst.id !== id);
      if (instances.length === state.instances.length) return state;
      syncInstancesToPreferences(instances);
      return { instances };
    }),

  removeInstancesByUserIndicatorId: (userIndicatorId, panelId) =>
    set((state) => {
      const instances = state.instances.filter((inst) => {
        if (inst.userIndicatorId !== userIndicatorId) return true;
        // When panelId is given, only drop instances bound to that
        // panel — leaves the same indicator on other panels alone.
        if (panelId !== undefined && inst.panelId !== panelId) return true;
        return false;
      });
      if (instances.length === state.instances.length) return state;
      syncInstancesToPreferences(instances);
      return { instances };
    }),

  updateInstance: (id, patch) =>
    set((state) => {
      let mutated = false;
      const instances = state.instances.map((inst) => {
        if (inst.id !== id) return inst;
        mutated = true;
        return {
          ...inst,
          ...patch,
          id: inst.id,
          params: patch.params ? { ...inst.params, ...patch.params } : inst.params,
        };
      });
      if (!mutated) return state;
      syncInstancesToPreferences(instances);
      return { instances };
    }),

  toggleInstanceVisible: (id) =>
    set((state) => {
      let mutated = false;
      const instances = state.instances.map((inst) => {
        if (inst.id !== id) return inst;
        mutated = true;
        return { ...inst, visible: !inst.visible };
      });
      if (!mutated) return state;
      syncInstancesToPreferences(instances);
      return { instances };
    }),

  reorderInstances: (ids) =>
    set((state) => {
      const order = new Map(ids.map((id, idx) => [id, idx]));
      const instances = [...state.instances].sort((a, b) => {
        const ai = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const bi = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      syncInstancesToPreferences(instances);
      return { instances };
    }),

  getVisibleInstances: () => get().instances.filter((inst) => inst.visible),

  getInstancesByPaneId: (paneId) => get().instances.filter((inst) => inst.paneId === paneId),

  getInstancesByPanelId: (panelId) => get().instances.filter((inst) => inst.panelId === panelId),

  pruneRemovedPanels: (knownPanelIds) =>
    set((state) => {
      const instances = state.instances.filter(
        (inst) => inst.panelId === undefined || knownPanelIds.has(inst.panelId),
      );
      if (instances.length === state.instances.length) return state;
      syncInstancesToPreferences(instances);
      return { instances };
    }),
}));
