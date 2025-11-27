import type { AIStudyType } from '@shared/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PatternDetectionConfig {
  sensitivity: number;
  minConfidence: number;
  formationPeriod: number;
  trendlineR2Threshold: number;
  volumeConfirmationWeight: number;
  enabledPatterns: AIStudyType[];
  showPreview: boolean;
}

interface PatternDetectionConfigState {
  config: PatternDetectionConfig;
  setConfig: (config: Partial<PatternDetectionConfig>) => void;
  resetToDefaults: () => void;
  togglePattern: (pattern: AIStudyType) => void;
  isPatternEnabled: (pattern: AIStudyType) => boolean;
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
      version: 1,
    },
  ),
);
