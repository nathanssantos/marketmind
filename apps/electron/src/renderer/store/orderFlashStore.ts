/**
 * Order flash registry — imperative, allocation-free on mutation.
 *
 * Earlier this was a Zustand store that called `set({ flashes: new Map(...) })`
 * on every flashOrder / clearFlash. The Map allocation per mutation +
 * the resulting subscriber notifications meant every order flash
 * during scalping triggered a fresh React subscriber wake-up — even
 * though the only consumer reads the live Map directly each frame.
 *
 * Design now:
 *  - One mutable Map at module scope. No per-mutation allocation.
 *  - Listeners are notified on every mutation but the Map identity
 *    stays stable, so ref-equality consumers never see a change.
 *  - The Zustand-shaped surface is preserved (`getState`, `subscribe`)
 *    so existing call sites work unchanged.
 *
 * Renderers that need the current flash state read `flashes` directly
 * each frame and consult `flashes.get(id)`. The `subscribe` API is
 * used only by the overlay-effect hook to start its rAF animation
 * loop when a new flash arrives — that hook never compares Map refs,
 * just calls `state.flashes.size`.
 */

const flashes = new Map<string, number>();
type Listener = (state: { flashes: Map<string, number> }) => void;
const listeners = new Set<Listener>();

const notify = (): void => {
  for (const listener of listeners) {
    listener({ flashes });
  }
};

const flashOrder = (id: string): void => {
  flashes.set(id, performance.now());
  notify();
};

const clearFlash = (id: string): void => {
  if (flashes.delete(id)) notify();
};

const getFlashTime = (id: string): number | undefined => flashes.get(id);

interface OrderFlashStoreApi {
  getState: () => {
    flashes: Map<string, number>;
    flashOrder: (id: string) => void;
    clearFlash: (id: string) => void;
    getFlashTime: (id: string) => number | undefined;
  };
  subscribe: (listener: Listener) => () => void;
}

export const useOrderFlashStore: OrderFlashStoreApi = {
  getState: () => ({ flashes, flashOrder, clearFlash, getFlashTime }),
  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
