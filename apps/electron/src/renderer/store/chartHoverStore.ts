import type { Kline } from '@marketmind/types';
import { create } from 'zustand';

interface ChartHoverState {
  hoveredKlineByChart: Record<string, Kline | null>;
  currentKlineByChart: Record<string, Kline | null>;
  setHoveredKline: (chartKey: string, kline: Kline | null) => void;
  setCurrentKline: (chartKey: string, kline: Kline | null) => void;
  clearChart: (chartKey: string) => void;
}

export const makeChartKey = (symbol: string | undefined, timeframe: string | undefined): string =>
  `${symbol ?? ''}:${timeframe ?? ''}`;

export const useChartHoverStore = create<ChartHoverState>((set) => ({
  hoveredKlineByChart: {},
  currentKlineByChart: {},

  setHoveredKline: (chartKey, kline) =>
    set((state) => {
      const prev = state.hoveredKlineByChart[chartKey] ?? null;
      if (prev === kline) return state;
      return {
        hoveredKlineByChart: { ...state.hoveredKlineByChart, [chartKey]: kline },
      };
    }),

  setCurrentKline: (chartKey, kline) =>
    set((state) => {
      const prev = state.currentKlineByChart[chartKey] ?? null;
      if (prev === kline) return state;
      return {
        currentKlineByChart: { ...state.currentKlineByChart, [chartKey]: kline },
      };
    }),

  clearChart: (chartKey) =>
    set((state) => {
      const nextHovered = { ...state.hoveredKlineByChart };
      const nextCurrent = { ...state.currentKlineByChart };
      delete nextHovered[chartKey];
      delete nextCurrent[chartKey];
      return {
        hoveredKlineByChart: nextHovered,
        currentKlineByChart: nextCurrent,
      };
    }),
}));
