import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MarketType } from '@marketmind/types';

interface PriceEntry {
  price: number;
  timestamp: number;
  source: 'chart' | 'websocket' | 'api';
}

export interface DailyOpenEntry {
  open: number;
  lastPrice: number;
  openTime: number;
  updatedAt: number;
}

export const dailyOpenKey = (symbol: string, marketType: MarketType): string =>
  `${symbol}:${marketType}`;

interface PriceState {
  prices: Record<string, PriceEntry>;
  dailyOpen: Record<string, DailyOpenEntry>;
  updatePrice: (symbol: string, price: number, source: PriceEntry['source']) => void;
  updatePriceBatch: (updates: Map<string, number>) => void;
  setDailyOpen: (symbol: string, marketType: MarketType, entry: Omit<DailyOpenEntry, 'updatedAt'>) => void;
  setDailyOpenBatch: (
    marketType: MarketType,
    entries: Array<{ symbol: string; open: number; lastPrice: number; openTime: number }>,
  ) => void;
  getPrice: (symbol: string) => number | null;
  getPriceEntry: (symbol: string) => PriceEntry | null;
  cleanupStaleSymbols: () => void;
}

const PRICE_STALENESS_MS = 30000;
const MAX_PRICE_SYMBOLS = 500;
const STALE_CLEANUP_THRESHOLD_MS = 5 * 60 * 1000;

export const usePriceStore = create<PriceState>()(immer((set, get) => ({
  prices: {},
  dailyOpen: {},

  setDailyOpen: (symbol, marketType, entry) => {
    const now = Date.now();
    set((state) => {
      state.dailyOpen[dailyOpenKey(symbol, marketType)] = {
        open: entry.open,
        lastPrice: entry.lastPrice,
        openTime: entry.openTime,
        updatedAt: now,
      };
    });
  },

  setDailyOpenBatch: (marketType, entries) => {
    const now = Date.now();
    set((state) => {
      for (const { symbol, open, lastPrice, openTime } of entries) {
        state.dailyOpen[dailyOpenKey(symbol, marketType)] = { open, lastPrice, openTime, updatedAt: now };
      }
    });
  },

  updatePrice: (symbol, price, source) => {
    const now = Date.now();
    const current = get().prices[symbol];

    if (current) {
      if (source === 'chart') {
        set((state) => { state.prices[symbol] = { price, timestamp: now, source }; });
      } else if (source === 'websocket') {
        if (current.source !== 'chart' || now - current.timestamp > PRICE_STALENESS_MS) {
          set((state) => { state.prices[symbol] = { price, timestamp: now, source }; });
        }
      } else if (current.source === 'api' || now - current.timestamp > PRICE_STALENESS_MS) {
        set((state) => { state.prices[symbol] = { price, timestamp: now, source }; });
      }
    } else {
      set((state) => {
        const symbolCount = Object.keys(state.prices).length;
        if (symbolCount >= MAX_PRICE_SYMBOLS) get().cleanupStaleSymbols();
        state.prices[symbol] = { price, timestamp: now, source };
      });
    }
  },

  updatePriceBatch: (updates) => {
    const now = Date.now();
    set((state) => {
      for (const [symbol, price] of updates) {
        const current = state.prices[symbol];
        if (current && current.source === 'chart' && now - current.timestamp <= PRICE_STALENESS_MS) continue;
        state.prices[symbol] = { price, timestamp: now, source: 'websocket' };
      }
    });
  },

  getPrice: (symbol) => {
    const entry = get().prices[symbol];
    return entry ? entry.price : null;
  },

  getPriceEntry: (symbol) => {
    return get().prices[symbol] || null;
  },

  cleanupStaleSymbols: () => {
    const now = Date.now();
    const currentPrices = get().prices;
    const entries = Object.entries(currentPrices);

    if (entries.length <= MAX_PRICE_SYMBOLS) {
      set((state) => {
        for (const [sym, entry] of entries) {
          if (now - entry.timestamp >= STALE_CLEANUP_THRESHOLD_MS) {
            delete state.prices[sym];
          }
        }
      });
      return;
    }

    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const toRemove = sorted.slice(MAX_PRICE_SYMBOLS).map(([sym]) => sym);
    set((state) => {
      for (const sym of toRemove) {
        delete state.prices[sym];
      }
    });
  },
})));

const SIDEBAR_PRICE_UPDATE_THROTTLE_MS = 250;

const LIVE_PRICE_THROTTLE_MS = 250;

export const useFastPriceForSymbol = (symbol: string): number | null => {
  const [price, setPrice] = useState<number | null>(
    () => usePriceStore.getState().prices[symbol]?.price ?? null,
  );
  const lastPriceRef = useRef<number | null>(price);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    const run = () => {
      timer = null;
      pending = false;
      const next = usePriceStore.getState().prices[symbol]?.price ?? null;
      if (next === lastPriceRef.current) return;
      lastPriceRef.current = next;
      setPrice(next);
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(run, LIVE_PRICE_THROTTLE_MS);
    };

    run();
    const unsub = usePriceStore.subscribe(schedule);

    return () => {
      unsub();
      if (timer !== null) clearTimeout(timer);
    };
  }, [symbol]);

  return price;
};

const DAILY_CHANGE_THROTTLE_MS = 250;

const computeDailyChangePct = (symbol: string, marketType: MarketType): number | null => {
  const state = usePriceStore.getState();
  const entry = state.dailyOpen[dailyOpenKey(symbol, marketType)];
  if (!entry || entry.open <= 0) return null;
  const livePrice = state.prices[symbol]?.price ?? entry.lastPrice;
  const pct = ((livePrice - entry.open) / entry.open) * 100;
  return Math.round(pct * 100) / 100;
};

export const useDailyChangePct = (symbol: string, marketType: MarketType): number | null => {
  const [pct, setPct] = useState<number | null>(() => computeDailyChangePct(symbol, marketType));
  const lastPctRef = useRef<number | null>(pct);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    const run = () => {
      timer = null;
      pending = false;
      const next = computeDailyChangePct(symbol, marketType);
      if (next === lastPctRef.current) return;
      lastPctRef.current = next;
      setPct(next);
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(run, DAILY_CHANGE_THROTTLE_MS);
    };

    run();

    const unsub = usePriceStore.subscribe(schedule);

    return () => {
      unsub();
      if (timer !== null) clearTimeout(timer);
    };
  }, [symbol, marketType]);

  return pct;
};

export const usePricesForSymbols = (symbols: string[]): Record<string, number> => {
  const joinedSymbols = symbols.join(',');
  const symbolsKey = useMemo(
    () => (joinedSymbols ? joinedSymbols.split(',').sort().join(',') : ''),
    [joinedSymbols]
  );
  const symbolsRef = useRef<string[]>(symbols);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const lastPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    symbolsRef.current = symbols;
  });

  useEffect(() => {
    if (!symbolsKey) {
      setPrices({});
      lastPricesRef.current = {};
      return;
    }

    const currentSymbols = symbolsKey.split(',');
    let throttleTimeout: NodeJS.Timeout | null = null;
    let pendingUpdate = false;

    const getCurrentPrices = () => {
      const state = usePriceStore.getState();
      const result: Record<string, number> = {};
      for (const symbol of currentSymbols) {
        const entry = state.prices[symbol];
        if (entry) {
          result[symbol] = entry.price;
        }
      }
      return result;
    };

    const initial = getCurrentPrices();
    lastPricesRef.current = initial;
    setPrices(initial);

    const processUpdate = () => {
      const syms = symbolsRef.current;
      if (syms.length === 0) return;

      const state = usePriceStore.getState();
      const newPrices: Record<string, number> = {};
      let hasChanged = false;

      for (const symbol of syms) {
        const entry = state.prices[symbol];
        const newPrice = entry?.price ?? 0;
        newPrices[symbol] = newPrice;

        if (lastPricesRef.current[symbol] !== newPrice) {
          hasChanged = true;
        }
      }

      if (hasChanged) {
        lastPricesRef.current = newPrices;
        setPrices(newPrices);
      }
      pendingUpdate = false;
    };

    const unsubscribe = usePriceStore.subscribe(() => {
      if (pendingUpdate) return;
      pendingUpdate = true;
      if (throttleTimeout) clearTimeout(throttleTimeout);
      throttleTimeout = setTimeout(processUpdate, SIDEBAR_PRICE_UPDATE_THROTTLE_MS);
    });

    return () => {
      unsubscribe();
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [symbolsKey]);

  return prices;
};
