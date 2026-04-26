import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface BacktestModalState {
  isBacktestOpen: boolean;
  openBacktest: () => void;
  closeBacktest: () => void;
  toggleBacktest: () => void;
}

export const useBacktestModalStore = create<BacktestModalState>()(
  subscribeWithSelector((set) => ({
    isBacktestOpen: false,
    openBacktest: () => set({ isBacktestOpen: true }),
    closeBacktest: () => set({ isBacktestOpen: false }),
    toggleBacktest: () => set((s) => ({ isBacktestOpen: !s.isBacktestOpen })),
  })),
);
