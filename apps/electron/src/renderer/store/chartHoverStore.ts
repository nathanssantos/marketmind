import type { Kline } from '@marketmind/types';
import { create } from 'zustand';

interface ChartHoverState {
  hoveredKlineByChart: Record<string, Kline | null>;
  setHoveredKline: (chartKey: string, kline: Kline | null) => void;
}

export const makeChartKey = (symbol: string | undefined, timeframe: string | undefined): string =>
  `${symbol ?? ''}:${timeframe ?? ''}`;

export const useChartHoverStore = create<ChartHoverState>((set) => ({
  hoveredKlineByChart: {},
  setHoveredKline: (chartKey, kline) =>
    set((state) => {
      const prev = state.hoveredKlineByChart[chartKey];
      if (prev === kline) return state;
      return {
        hoveredKlineByChart: { ...state.hoveredKlineByChart, [chartKey]: kline },
      };
    }),
}));
