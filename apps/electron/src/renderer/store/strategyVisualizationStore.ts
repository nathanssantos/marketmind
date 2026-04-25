import type {
  HighlightedCandle,
  StrategyVisualizationData,
} from '@marketmind/types';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface StrategyVisualizationState {
  highlightedCandles: HighlightedCandle[];
  activeStrategyId: string | null;
  activeExecutionId: string | null;
  popoverData: StrategyVisualizationData | null;
  isLoading: boolean;

  setHighlightedCandles: (candles: HighlightedCandle[]) => void;
  setActiveStrategy: (
    strategyId: string,
    executionId: string,
    data: StrategyVisualizationData
  ) => void;
  setPopoverData: (data: StrategyVisualizationData | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;

  highlightCandlesFromData: (
    data: StrategyVisualizationData,
    baseIndex: number
  ) => void;
}

const createHighlightedCandles = (
  data: StrategyVisualizationData,
  baseIndex: number
): HighlightedCandle[] => {
  if (!data.education?.candlePattern?.candles) return [];

  return data.education.candlePattern.candles.map((candle) => ({
    index: baseIndex + candle.offset,
    offset: candle.offset,
    role: candle.role,
  }));
};

export const useStrategyVisualizationStore = create<StrategyVisualizationState>()(
  subscribeWithSelector((set) => ({
    highlightedCandles: [],
    activeStrategyId: null,
    activeExecutionId: null,
    popoverData: null,
    isLoading: false,

    setHighlightedCandles: (candles) =>
      set({ highlightedCandles: candles }),

    setActiveStrategy: (strategyId, executionId, data) =>
      set({
        activeStrategyId: strategyId,
        activeExecutionId: executionId,
        popoverData: data,
      }),

    setPopoverData: (data) =>
      set({ popoverData: data }),

    setLoading: (loading) =>
      set({ isLoading: loading }),

    clear: () =>
      set({
        highlightedCandles: [],
        activeStrategyId: null,
        activeExecutionId: null,
        popoverData: null,
        isLoading: false,
      }),

    highlightCandlesFromData: (data, baseIndex) =>
      set({
        highlightedCandles: createHighlightedCandles(data, baseIndex),
      }),
  }))
);
