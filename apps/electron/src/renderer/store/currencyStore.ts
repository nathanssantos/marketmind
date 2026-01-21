import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchUsdtBrlRate } from '../services/exchangeRateService';

const REFRESH_INTERVAL_MS = 60000;

interface CurrencyState {
  usdtBrlRate: number;
  lastUpdated: number | null;
  isLoading: boolean;
  showBrlValues: boolean;
  setUsdtBrlRate: (rate: number) => void;
  setIsLoading: (loading: boolean) => void;
  setShowBrlValues: (show: boolean) => void;
  refreshRate: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      usdtBrlRate: 6.0,
      lastUpdated: null,
      isLoading: false,
      showBrlValues: true,

      setUsdtBrlRate: (rate) => set({ usdtBrlRate: rate, lastUpdated: Date.now() }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setShowBrlValues: (show) => set({ showBrlValues: show }),

      refreshRate: async () => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true });
        try {
          const rate = await fetchUsdtBrlRate();
          set({ usdtBrlRate: rate, lastUpdated: Date.now() });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'currency-storage',
      version: 1,
      partialize: (state) => ({
        showBrlValues: state.showBrlValues,
        usdtBrlRate: state.usdtBrlRate,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

export const useCurrencyAutoRefresh = () => {
  const refreshRate = useCurrencyStore((s) => s.refreshRate);

  useEffect(() => {
    refreshRate();
    const interval = setInterval(refreshRate, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshRate]);
};

export const convertUsdtToBrl = (usdt: number, rate: number): number => usdt * rate;
