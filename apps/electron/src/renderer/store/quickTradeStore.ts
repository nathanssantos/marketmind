import { create } from 'zustand';

interface QuickTradeState {
  sizePercent: number;
  setSizePercent: (pct: number) => void;
}

export const useQuickTradeStore = create<QuickTradeState>((set) => ({
  sizePercent: 0.1,
  setSizePercent: (pct) => set({ sizePercent: pct }),
}));
