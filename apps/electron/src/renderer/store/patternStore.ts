import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

/**
 * Per-grid-panel set of enabled user-pattern ids. The set is stored as a
 * `string[]` (ordered) — easier to persist + diff than `Set<string>`. Same
 * scoping model as `chartLayersStore` (#492 / #493): two chart panels in the
 * same layout — even on the same symbol/interval — keep independent toggles.
 */
interface PatternState {
  enabledIdsByPanelId: Record<string, string[]>;
  hydrate: (data: { enabledIdsByPanelId?: unknown }) => void;
  enableForPanel: (panelId: string, userPatternId: string) => void;
  disableForPanel: (panelId: string, userPatternId: string) => void;
  toggleForPanel: (panelId: string, userPatternId: string) => void;
  setForPanel: (panelId: string, ids: string[]) => void;
  isEnabled: (panelId: string, userPatternId: string) => boolean;
  getEnabledForPanel: (panelId: string) => string[];
  pruneRemovedPanels: (knownPanelIds: Set<string>) => void;
}

const sanitize = (raw: unknown): Record<string, string[]> => {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== 'string') continue;
    if (!Array.isArray(v)) continue;
    out[k] = v.filter((s): s is string => typeof s === 'string');
  }
  return out;
};

const persistToBackend = (state: Record<string, string[]>): void => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('chart', 'patternsByPanel', state);
};

export const usePatternStore = create<PatternState>((set, get) => ({
  enabledIdsByPanelId: {},

  hydrate: (data) => {
    if (data.enabledIdsByPanelId === undefined) return;
    set({ enabledIdsByPanelId: sanitize(data.enabledIdsByPanelId) });
  },

  enableForPanel: (panelId, userPatternId) =>
    set((state) => {
      const current = state.enabledIdsByPanelId[panelId] ?? [];
      if (current.includes(userPatternId)) return state;
      const next = { ...state.enabledIdsByPanelId, [panelId]: [...current, userPatternId] };
      persistToBackend(next);
      return { enabledIdsByPanelId: next };
    }),

  disableForPanel: (panelId, userPatternId) =>
    set((state) => {
      const current = state.enabledIdsByPanelId[panelId] ?? [];
      if (!current.includes(userPatternId)) return state;
      const next = { ...state.enabledIdsByPanelId, [panelId]: current.filter((id) => id !== userPatternId) };
      persistToBackend(next);
      return { enabledIdsByPanelId: next };
    }),

  toggleForPanel: (panelId, userPatternId) => {
    const current = get().enabledIdsByPanelId[panelId] ?? [];
    if (current.includes(userPatternId)) get().disableForPanel(panelId, userPatternId);
    else get().enableForPanel(panelId, userPatternId);
  },

  setForPanel: (panelId, ids) =>
    set((state) => {
      const next = { ...state.enabledIdsByPanelId, [panelId]: [...ids] };
      persistToBackend(next);
      return { enabledIdsByPanelId: next };
    }),

  isEnabled: (panelId, userPatternId) =>
    (get().enabledIdsByPanelId[panelId] ?? []).includes(userPatternId),

  getEnabledForPanel: (panelId) => get().enabledIdsByPanelId[panelId] ?? [],

  pruneRemovedPanels: (knownPanelIds) =>
    set((state) => {
      const next: Record<string, string[]> = {};
      let changed = false;
      for (const [id, ids] of Object.entries(state.enabledIdsByPanelId)) {
        if (knownPanelIds.has(id)) next[id] = ids;
        else changed = true;
      }
      if (!changed) return state;
      persistToBackend(next);
      return { enabledIdsByPanelId: next };
    }),
}));
