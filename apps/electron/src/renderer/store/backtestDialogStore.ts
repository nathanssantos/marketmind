import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface BacktestDialogState {
  isBacktestOpen: boolean;
  openBacktest: () => void;
  closeBacktest: () => void;
  toggleBacktest: () => void;
}

export const useBacktestDialogStore = create<BacktestDialogState>()(
  subscribeWithSelector((set) => ({
    isBacktestOpen: false,
    openBacktest: () => set({ isBacktestOpen: true }),
    closeBacktest: () => set({ isBacktestOpen: false }),
    toggleBacktest: () => set((s) => ({ isBacktestOpen: !s.isBacktestOpen })),
  })),
);
