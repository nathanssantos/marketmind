import type { AIPatternType } from '@marketmind/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PatternDetectionMode = 'ai-only' | 'algorithmic-only' | 'hybrid';
export type TradingSidebarTab = 'ticket' | 'orders' | 'portfolio' | 'wallets' | 'analytics';
export type OrdersFilterOption = 'all' | 'pending' | 'active' | 'filled' | 'closed' | 'cancelled' | 'expired';
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';

interface UIState {
  chatPosition: 'left' | 'right';
  setChatPosition: (position: 'left' | 'right') => void;

  patternDetectionMode: PatternDetectionMode;
  setPatternDetectionMode: (mode: PatternDetectionMode) => void;

  algorithmicDetectionSettings: {
    minConfidence: number;
    pivotSensitivity: number;
    enabledPatterns: AIPatternType[];
    autoDisplayPatterns: boolean;
  };
  setAlgorithmicDetectionSettings: (settings: Partial<UIState['algorithmicDetectionSettings']>) => void;

  tradingSidebarTab: TradingSidebarTab;
  setTradingSidebarTab: (tab: TradingSidebarTab) => void;

  ordersFilterStatus: OrdersFilterOption;
  setOrdersFilterStatus: (filter: OrdersFilterOption) => void;

  performancePeriod: AnalyticsPeriod;
  setPerformancePeriod: (period: AnalyticsPeriod) => void;

  setupStatsPeriod: AnalyticsPeriod;
  setSetupStatsPeriod: (period: AnalyticsPeriod) => void;
}

const DEFAULT_ENABLED_PATTERNS: AIPatternType[] = [
  'support',
  'resistance',
  'trendline-bullish',
  'trendline-bearish',
  'fibonacci-retracement',
  'fibonacci-extension',
  'channel-ascending',
  'channel-descending',
  'channel-horizontal',
  'triangle-ascending',
  'triangle-descending',
  'triangle-symmetrical',
  'wedge-rising',
  'wedge-falling',
  'head-and-shoulders',
  'inverse-head-and-shoulders',
  'double-top',
  'double-bottom',
  'triple-top',
  'triple-bottom',
  'flag-bullish',
  'flag-bearish',
  'pennant',
  'cup-and-handle',
  'rounding-bottom',
  'gap-common',
  'gap-breakaway',
  'gap-runaway',
  'gap-exhaustion',
  'liquidity-zone',
  'sell-zone',
  'buy-zone',
  'accumulation-zone',
];

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      chatPosition: 'right',
      setChatPosition: (position) => set({ chatPosition: position }),

      patternDetectionMode: 'ai-only',
      setPatternDetectionMode: (mode) => set({ patternDetectionMode: mode }),

      algorithmicDetectionSettings: {
        minConfidence: 0.6,
        pivotSensitivity: 5,
        enabledPatterns: DEFAULT_ENABLED_PATTERNS,
        autoDisplayPatterns: true,
      },
      setAlgorithmicDetectionSettings: (settings) =>
        set((state) => ({
          algorithmicDetectionSettings: {
            ...state.algorithmicDetectionSettings,
            ...settings,
          },
        })),

      tradingSidebarTab: 'orders',
      setTradingSidebarTab: (tab) => set({ tradingSidebarTab: tab }),

      ordersFilterStatus: 'pending',
      setOrdersFilterStatus: (filter) => set({ ordersFilterStatus: filter }),

      performancePeriod: 'all',
      setPerformancePeriod: (period) => set({ performancePeriod: period }),

      setupStatsPeriod: 'all',
      setSetupStatsPeriod: (period) => set({ setupStatsPeriod: period }),
    }),
    {
      name: 'ui-storage',
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as UIState;

        if (version < 2 && state.algorithmicDetectionSettings) {
          state.algorithmicDetectionSettings.enabledPatterns = DEFAULT_ENABLED_PATTERNS;
        }

        if (version < 3) {
          state.tradingSidebarTab = 'orders';
        }

        if (version < 4) {
          state.ordersFilterStatus = 'pending';
          state.performancePeriod = 'all';
          state.setupStatsPeriod = 'all';
        }

        return state;
      },
    }
  )
);
