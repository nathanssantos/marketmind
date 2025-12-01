import type { AIPatternType } from '@shared/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PatternDetectionConfig {
  sensitivity: number;
  minConfidence: number;
  formationPeriod: number;
  trendlineR2Threshold: number;
  volumeConfirmationWeight: number;
  enabledPatterns: AIPatternType[];
  showPreview: boolean;
  filteringMode: 'clean' | 'complete';
  maxPatternsTotal: number;
  enableNestedFiltering: boolean;
  enableOverlapFiltering: boolean;
  overlapThreshold: number;
  highlightConflicts: boolean;
  showChannelCenterline: boolean;
  showExtensions: boolean;
  extendTrendlines: boolean;
  extendChannels: boolean;
  extendSupport: boolean;
  extendResistance: boolean;
  maxPatternsPerTier: {
    macro: number;
    major: number;
    intermediate: number;
    minor: number;
  };
  maxPatternsPerCategory: number;
}

interface PatternDetectionConfigState {
  config: PatternDetectionConfig;
  setConfig: (config: Partial<PatternDetectionConfig>) => void;
  resetToDefaults: () => void;
  togglePattern: (pattern: AIPatternType) => void;
  isPatternEnabled: (pattern: AIPatternType) => boolean;
}

const DEFAULT_CONFIG: PatternDetectionConfig = {
  sensitivity: 50,
  minConfidence: 0.5,
  formationPeriod: 50,
  trendlineR2Threshold: 0.85,
  volumeConfirmationWeight: 0.3,
  enabledPatterns: [
    'head-and-shoulders',
    'inverse-head-and-shoulders',
    'double-top',
    'double-bottom',
    'triple-top',
    'triple-bottom',
    'triangle-ascending',
    'triangle-descending',
    'triangle-symmetrical',
    'flag-bullish',
    'flag-bearish',
    'pennant',
    'cup-and-handle',
    'rounding-bottom',
    'wedge-falling',
    'wedge-rising',
    'support',
    'resistance',
    'buy-zone',
    'sell-zone',
    'liquidity-zone',
    'accumulation-zone',
    'gap-common',
    'gap-breakaway',
    'gap-runaway',
    'gap-exhaustion',
  ],
  showPreview: true,
  filteringMode: 'clean',
  maxPatternsTotal: 20,
  enableNestedFiltering: false,
  enableOverlapFiltering: false,
  overlapThreshold: 0.6,
  highlightConflicts: true,
  showChannelCenterline: true,
  showExtensions: true,
  extendTrendlines: true,
  extendChannels: true,
  extendSupport: true,
  extendResistance: true,
  maxPatternsPerTier: {
    macro: 10,
    major: 8,
    intermediate: 6,
    minor: 4,
  },
  maxPatternsPerCategory: 5,
};

export const usePatternDetectionConfigStore = create<PatternDetectionConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,

      setConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),

      resetToDefaults: () =>
        set({
          config: DEFAULT_CONFIG,
        }),

      togglePattern: (pattern) =>
        set((state) => {
          const enabledPatterns = state.config.enabledPatterns.includes(pattern)
            ? state.config.enabledPatterns.filter((p) => p !== pattern)
            : [...state.config.enabledPatterns, pattern];

          return {
            config: {
              ...state.config,
              enabledPatterns,
            },
          };
        }),

      isPatternEnabled: (pattern) => get().config.enabledPatterns.includes(pattern),
    }),
    {
      name: 'marketmind-pattern-detection-config',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as PatternDetectionConfigState;
        
        if (version < 2) {
          return {
            ...state,
            config: {
              ...DEFAULT_CONFIG,
              ...state.config,
              extendTrendlines: state.config.extendTrendlines ?? true,
              extendChannels: state.config.extendChannels ?? true,
              extendSupport: state.config.extendSupport ?? true,
              extendResistance: state.config.extendResistance ?? true,
            },
          };
        }
        
        return state;
      },
    },
  ),
);
