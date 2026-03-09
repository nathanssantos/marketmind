import { create } from 'zustand';

interface QuickTradeState {
  sizePercent: number;
  useMinNotional: boolean;
  setSizePercent: (pct: number) => void;
  setMinNotional: (pct: number) => void;
}

export const useQuickTradeStore = create<QuickTradeState>((set) => ({
  sizePercent: 0.3,
  useMinNotional: false,
  setSizePercent: (pct) =>
    set((state) => {
      if (state.useMinNotional && Math.abs(pct - state.sizePercent) < 0.05) return state;
      return { sizePercent: pct, useMinNotional: false };
    }),
  setMinNotional: (pct) => set({ sizePercent: pct, useMinNotional: true }),
}));
