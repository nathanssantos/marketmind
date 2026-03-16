import { create } from 'zustand';

interface ApiBanState {
  banExpiresAt: number;
  isBanned: () => boolean;
  setBan: (expiresAt: number) => void;
  clearBan: () => void;
}

export const useApiBanStore = create<ApiBanState>((set, get) => ({
  banExpiresAt: 0,
  isBanned: () => get().banExpiresAt > Date.now(),
  setBan: (expiresAt) => set({ banExpiresAt: expiresAt }),
  clearBan: () => set({ banExpiresAt: 0 }),
}));
