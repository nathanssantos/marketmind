import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { trpc } from '../services/trpc';

type PreferenceCategory = 'chart' | 'ui' | 'trading';

interface PreferencesState {
  isHydrated: boolean;
  chart: Record<string, unknown>;
  ui: Record<string, unknown>;
  trading: Record<string, unknown>;

  hydrate: (allPrefs: Record<string, Record<string, unknown>>) => void;
  set: (category: PreferenceCategory, key: string, value: unknown) => void;
  reset: () => void;
}

const FLUSH_DEBOUNCE_MS = 300;

let pendingWrites: Record<PreferenceCategory, Record<string, unknown>> = {
  chart: {},
  ui: {},
  trading: {},
};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flushToBackend = async () => {
  const writes = pendingWrites;
  pendingWrites = { chart: {}, ui: {}, trading: {} };

  for (const [category, prefs] of Object.entries(writes)) {
    if (Object.keys(prefs).length === 0) continue;
    try {
      await trpc.preferences.bulkSet.mutate({
        category: category as PreferenceCategory,
        preferences: prefs,
      });
    } catch (e) {
      console.error(`[preferences] Failed to sync ${category}:`, e);
    }
  }
};

const queueFlush = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushToBackend, FLUSH_DEBOUNCE_MS);
};

export const immediateFlushPreferences = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushToBackend();
};

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  isHydrated: false,
  chart: {},
  ui: {},
  trading: {},

  hydrate: (allPrefs) =>
    set({
      isHydrated: true,
      chart: allPrefs['chart'] ?? {},
      ui: allPrefs['ui'] ?? {},
      trading: allPrefs['trading'] ?? {},
    }),

  set: (category, key, value) => {
    set((state) => ({
      [category]: { ...state[category], [key]: value },
    }));
    pendingWrites[category][key] = value;
    queueFlush();
  },

  reset: () => {
    if (flushTimer) clearTimeout(flushTimer);
    pendingWrites = { chart: {}, ui: {}, trading: {} };
    set({ isHydrated: false, chart: {}, ui: {}, trading: {} });
  },
}));

export function useChartPref<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultRef = useRef(defaultValue);

  const value = usePreferencesStore((state) => {
    const v = state.chart[key];
    return v !== undefined ? (v as T) : defaultRef.current;
  });

  const setter = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const store = usePreferencesStore.getState();
      const current = store.chart[key] !== undefined ? (store.chart[key] as T) : defaultRef.current;
      const computed = typeof newValue === 'function' ? (newValue as (prev: T) => T)(current) : newValue;
      store.set('chart', key, computed);
    },
    [key]
  );

  return [value, setter];
}

export function useUIPref<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultRef = useRef(defaultValue);

  const value = usePreferencesStore((state) => {
    const v = state.ui[key];
    return v !== undefined ? (v as T) : defaultRef.current;
  });

  const setter = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const store = usePreferencesStore.getState();
      const current = store.ui[key] !== undefined ? (store.ui[key] as T) : defaultRef.current;
      const computed = typeof newValue === 'function' ? (newValue as (prev: T) => T)(current) : newValue;
      store.set('ui', key, computed);
    },
    [key]
  );

  return [value, setter];
}

export function useTradingPref<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultRef = useRef(defaultValue);

  const value = usePreferencesStore((state) => {
    const v = state.trading[key];
    return v !== undefined ? (v as T) : defaultRef.current;
  });

  const setter = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const store = usePreferencesStore.getState();
      const current = store.trading[key] !== undefined ? (store.trading[key] as T) : defaultRef.current;
      const computed = typeof newValue === 'function' ? (newValue as (prev: T) => T)(current) : newValue;
      store.set('trading', key, computed);
    },
    [key]
  );

  return [value, setter];
}
