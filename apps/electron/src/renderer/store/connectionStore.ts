import { create } from 'zustand';

interface ConnectionState {
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
