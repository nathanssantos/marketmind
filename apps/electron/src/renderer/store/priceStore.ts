import { create } from 'zustand';

interface PriceEntry {
  price: number;
  timestamp: number;
  source: 'chart' | 'websocket' | 'api';
}

interface PriceState {
  prices: Record<string, PriceEntry>;
  updatePrice: (symbol: string, price: number, source: PriceEntry['source']) => void;
  getPrice: (symbol: string) => number | null;
  getPriceEntry: (symbol: string) => PriceEntry | null;
}

const PRICE_STALENESS_MS = 30000;

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},

  updatePrice: (symbol, price, source) => {
    const now = Date.now();
    const current = get().prices[symbol];

    if (current) {
      if (source === 'chart') {
        set((state) => ({
          prices: {
            ...state.prices,
            [symbol]: { price, timestamp: now, source },
          },
        }));
      } else if (source === 'websocket') {
        if (current.source !== 'chart' || now - current.timestamp > PRICE_STALENESS_MS) {
          set((state) => ({
            prices: {
              ...state.prices,
              [symbol]: { price, timestamp: now, source },
            },
          }));
        }
      } else if (current.source === 'api' || now - current.timestamp > PRICE_STALENESS_MS) {
        set((state) => ({
          prices: {
            ...state.prices,
            [symbol]: { price, timestamp: now, source },
          },
        }));
      }
    } else {
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: { price, timestamp: now, source },
        },
      }));
    }
  },

  getPrice: (symbol) => {
    const entry = get().prices[symbol];
    return entry ? entry.price : null;
  },

  getPriceEntry: (symbol) => {
    return get().prices[symbol] || null;
  },
}));
