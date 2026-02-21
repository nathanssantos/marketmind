import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchExchangeRate, fetchUsdtBrlRate } from '../services/exchangeRateService';
import { usePreferencesStore } from './preferencesStore';

const REFRESH_INTERVAL_MS = 60000;

const syncUI = (key: string, value: unknown) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('ui', key, value);
};

interface CurrencyState {
  hydrate: (data: Record<string, unknown>) => void;
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
  (set, get) => ({
    hydrate: (data) => {
      if ('showBrlValues' in data) set({ showBrlValues: data['showBrlValues'] as boolean });
    },

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
    setShowBrlValues: (show) => { set({ showBrlValues: show }); syncUI('showBrlValues', show); },

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
  })
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
