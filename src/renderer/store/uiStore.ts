import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  chatPosition: 'left' | 'right';
  setChatPosition: (position: 'left' | 'right') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      chatPosition: 'right',
      setChatPosition: (position) => set({ chatPosition: position }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
