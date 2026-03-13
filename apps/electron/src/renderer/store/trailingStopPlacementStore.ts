import { create } from 'zustand';

interface TrailingStopPlacementState {
  isPlacing: boolean;
  previewPrice: number | null;

  activate: () => void;
  deactivate: () => void;
  setPreviewPrice: (price: number | null) => void;
}

export const useTrailingStopPlacementStore = create<TrailingStopPlacementState>((set) => ({
  isPlacing: false,
  previewPrice: null,

  activate: () => set({ isPlacing: true, previewPrice: null }),
  deactivate: () => set({ isPlacing: false, previewPrice: null }),
  setPreviewPrice: (price) => set({ previewPrice: price }),
}));
