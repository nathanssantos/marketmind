import type { AIPatternType } from '@marketmind/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PatternDetectionMode = 'ai-only' | 'algorithmic-only' | 'hybrid';

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
    }),
    {
      name: 'ui-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as UIState;
        
        if (version < 2 && state.algorithmicDetectionSettings) {
          state.algorithmicDetectionSettings.enabledPatterns = DEFAULT_ENABLED_PATTERNS;
        }
        
        return state;
      },
    }
  )
);
