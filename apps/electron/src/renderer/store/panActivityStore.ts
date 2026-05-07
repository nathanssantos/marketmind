import { create } from 'zustand';

interface PanActivityState {
  /** Active pan/zoom interactions, by panel id. While the set is non-empty,
   * the live-stream registry applies `panMultiplier` to throttle non-critical
   * updates and free the main thread for canvas paint + mousemove. */
  activePanels: Set<string>;
  isPanning: boolean;
  beginPan: (panelId: string) => void;
  endPan: (panelId: string) => void;
}

// Vanilla store — most consumers read it via `getState()` from inside
// imperative subscribers (pacing the throttle window, deciding to drop
// frames). React subscribers can still subscribe via `useStore` if they
// want to react to pan transitions, but in the default policy nobody
// subscribes — we don't want a state change here to trigger renders
// across the tree.
export const usePanActivityStore = create<PanActivityState>((set) => ({
  activePanels: new Set(),
  isPanning: false,
  beginPan: (panelId) =>
    set((state) => {
      if (state.activePanels.has(panelId)) return state;
      const next = new Set(state.activePanels);
      next.add(panelId);
      return { activePanels: next, isPanning: true };
    }),
  endPan: (panelId) =>
    set((state) => {
      if (!state.activePanels.has(panelId)) return state;
      const next = new Set(state.activePanels);
      next.delete(panelId);
      return { activePanels: next, isPanning: next.size > 0 };
    }),
}));

/** Cheap imperative read — use inside throttle decisions instead of subscribing. */
export const isPanActive = (): boolean => usePanActivityStore.getState().isPanning;
