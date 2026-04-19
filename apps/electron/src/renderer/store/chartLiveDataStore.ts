import type { Kline, MarketType } from '@marketmind/types';
import { create } from 'zustand';
import type { IndicatorOutputs } from '@renderer/components/Chart/ChartCanvas/useGenericChartIndicators';

export interface ChartLiveIndicatorEntry {
  catalogType: string;
  outputs: IndicatorOutputs;
}

export interface ChartLiveDataEntry {
  symbol: string;
  interval: string;
  marketType: MarketType;
  klines: Kline[];
  indicators: Map<string, ChartLiveIndicatorEntry>;
}

interface ChartLiveDataState {
  entries: Map<string, ChartLiveDataEntry>;
  setEntry: (key: string, entry: ChartLiveDataEntry) => void;
  clearEntry: (key: string) => void;
  getEntry: (key: string) => ChartLiveDataEntry | undefined;
}

export const buildChartLiveDataKey = (
  symbol: string,
  interval: string,
  marketType: MarketType,
): string => `${marketType}:${symbol}:${interval}`;

export const useChartLiveDataStore = create<ChartLiveDataState>((set, get) => ({
  entries: new Map(),
  setEntry: (key, entry) =>
    set((state) => {
      const next = new Map(state.entries);
      next.set(key, entry);
      return { entries: next };
    }),
  clearEntry: (key) =>
    set((state) => {
      if (!state.entries.has(key)) return state;
      const next = new Map(state.entries);
      next.delete(key);
      return { entries: next };
    }),
  getEntry: (key) => get().entries.get(key),
}));
