import { create } from 'zustand';

interface OrderFlashState {
  flashes: Map<string, number>;
  flashOrder: (id: string) => void;
  getFlashTime: (id: string) => number | undefined;
  clearFlash: (id: string) => void;
}

export const useOrderFlashStore = create<OrderFlashState>((set, get) => ({
  flashes: new Map(),
  flashOrder: (id) => {
    const flashes = new Map(get().flashes);
    flashes.set(id, performance.now());
    set({ flashes });
  },
  getFlashTime: (id) => get().flashes.get(id),
  clearFlash: (id) => {
    const flashes = new Map(get().flashes);
    flashes.delete(id);
    set({ flashes });
  },
}));
