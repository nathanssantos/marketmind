import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchExchangeRate, fetchUsdtBrlRate } from '../services/exchangeRateService';

const REFRESH_INTERVAL_MS = 60000;

interface CurrencyState {
  usdtBrlRate: number;
  rates: Record<string, number>;
  lastUpdated: number | null;
  isLoading: boolean;
  showBrlValues: boolean;
  setUsdtBrlRate: (rate: number) => void;
  setIsLoading: (loading: boolean) => void;
  setShowBrlValues: (show: boolean) => void;
  refreshRate: () => Promise<void>;
  fetchRate: (from: string, to: string) => Promise<number>;
}

const makePairKey = (from: string, to: string): string => `${from}:${to}`;

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      usdtBrlRate: 6.0,
      rates: {},
      lastUpdated: null,
      isLoading: false,
      showBrlValues: true,

      setUsdtBrlRate: (rate) => set((state) => ({
        usdtBrlRate: rate,
        rates: { ...state.rates, [makePairKey('USDT', 'BRL')]: rate },
        lastUpdated: Date.now(),
      })),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setShowBrlValues: (show) => set({ showBrlValues: show }),

      refreshRate: async () => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true });
        try {
          const rate = await fetchUsdtBrlRate();
          set((state) => ({
            usdtBrlRate: rate,
            rates: { ...state.rates, [makePairKey('USDT', 'BRL')]: rate },
            lastUpdated: Date.now(),
          }));
        } finally {
          set({ isLoading: false });
        }
      },

      fetchRate: async (from: string, to: string) => {
        const rate = await fetchExchangeRate(from, to);
        set((state) => ({
          rates: { ...state.rates, [makePairKey(from, to)]: rate },
        }));
        return rate;
      },
    }),
    {
      name: 'currency-storage',
      version: 2,
      partialize: (state) => ({
        showBrlValues: state.showBrlValues,
        usdtBrlRate: state.usdtBrlRate,
        rates: state.rates,
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

export const convertCurrency = (value: number, rate: number): number => value * rate;

export const getRate = (from: string, to: string): number | undefined => {
  if (from === to) return 1;
  return useCurrencyStore.getState().rates[makePairKey(from, to)];
};
