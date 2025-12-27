import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IndicatorId =
  | 'volume'
  | 'rsi'
  | 'stochastic'
  | 'bollingerBands'
  | 'atr'
  | 'vwap'
  | 'macd'
  | 'adx'
  | 'williamsR'
  | 'cci'
  | 'stochRsi'
  | 'cmo'
  | 'mfi'
  | 'ultimateOsc'
  | 'tsi'
  | 'ppo'
  | 'roc'
  | 'ao'
  | 'aroon'
  | 'vortex'
  | 'ichimoku'
  | 'supertrend'
  | 'parabolicSar'
  | 'keltner'
  | 'donchian'
  | 'obv'
  | 'cmf'
  | 'klinger'
  | 'elderRay'
  | 'pivotPoints'
  | 'fibonacci'
  | 'fvg'
  | 'liquidityLevels'
  | 'dema'
  | 'tema'
  | 'wma'
  | 'hma';

export type IndicatorCategory =
  | 'oscillators'
  | 'momentum'
  | 'trend'
  | 'volatility'
  | 'volume'
  | 'movingAverages'
  | 'priceStructure'
  | 'crypto';

export interface IndicatorParams {
  macd?: { fast: number; slow: number; signal: number };
  adx?: { period: number };
  williamsR?: { period: number };
  cci?: { period: number };
  stochRsi?: { rsiPeriod: number; stochPeriod: number; kPeriod: number; dPeriod: number };
  cmo?: { period: number };
  mfi?: { period: number };
  ultimateOsc?: { period1: number; period2: number; period3: number };
  tsi?: { longPeriod: number; shortPeriod: number; signalPeriod: number };
  ppo?: { fast: number; slow: number; signal: number };
  roc?: { period: number };
  ao?: { fastPeriod: number; slowPeriod: number };
  aroon?: { period: number };
  vortex?: { period: number };
  ichimoku?: { tenkan: number; kijun: number; senkou: number };
  supertrend?: { period: number; multiplier: number };
  parabolicSar?: { step: number; max: number };
  keltner?: { period: number; multiplier: number };
  donchian?: { period: number };
  obv?: { smaPeriod: number };
  cmf?: { period: number };
  klinger?: { shortPeriod: number; longPeriod: number; signalPeriod: number };
  elderRay?: { period: number };
  pivotPoints?: { type: 'standard' | 'fibonacci' | 'woodie' | 'camarilla' };
  fibonacci?: { levels: number[] };
  hma?: { period: number };
}

export const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  macd: { fast: 12, slow: 26, signal: 9 },
  adx: { period: 14 },
  williamsR: { period: 14 },
  cci: { period: 20 },
  stochRsi: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 },
  cmo: { period: 14 },
  mfi: { period: 14 },
  ultimateOsc: { period1: 7, period2: 14, period3: 28 },
  tsi: { longPeriod: 25, shortPeriod: 13, signalPeriod: 13 },
  ppo: { fast: 12, slow: 26, signal: 9 },
  roc: { period: 12 },
  ao: { fastPeriod: 5, slowPeriod: 34 },
  aroon: { period: 25 },
  vortex: { period: 14 },
  ichimoku: { tenkan: 9, kijun: 26, senkou: 52 },
  supertrend: { period: 10, multiplier: 3 },
  parabolicSar: { step: 0.02, max: 0.2 },
  keltner: { period: 20, multiplier: 2 },
  donchian: { period: 20 },
  obv: { smaPeriod: 20 },
  cmf: { period: 20 },
  klinger: { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 },
  elderRay: { period: 13 },
  pivotPoints: { type: 'standard' },
  fibonacci: { levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] },
  hma: { period: 20 },
};

export const INDICATOR_CATEGORIES: Record<IndicatorCategory, IndicatorId[]> = {
  oscillators: ['rsi', 'stochastic', 'williamsR', 'cci', 'stochRsi', 'cmo', 'mfi', 'ultimateOsc'],
  momentum: ['macd', 'tsi', 'ppo', 'roc', 'ao'],
  trend: ['adx', 'aroon', 'vortex', 'parabolicSar', 'supertrend'],
  volatility: ['bollingerBands', 'atr', 'keltner', 'donchian'],
  volume: ['volume', 'vwap', 'obv', 'cmf', 'klinger', 'elderRay'],
  movingAverages: ['dema', 'tema', 'wma', 'hma'],
  priceStructure: ['ichimoku', 'pivotPoints', 'fibonacci', 'fvg', 'liquidityLevels'],
  crypto: [],
};

export const PANEL_INDICATORS: IndicatorId[] = [
  'rsi',
  'stochastic',
  'macd',
  'adx',
  'williamsR',
  'cci',
  'stochRsi',
  'cmo',
  'mfi',
  'ultimateOsc',
  'tsi',
  'ppo',
  'roc',
  'ao',
  'aroon',
  'vortex',
  'obv',
  'cmf',
  'klinger',
  'elderRay',
];

export const OVERLAY_INDICATORS: IndicatorId[] = [
  'volume',
  'bollingerBands',
  'atr',
  'vwap',
  'ichimoku',
  'supertrend',
  'parabolicSar',
  'keltner',
  'donchian',
  'pivotPoints',
  'fibonacci',
  'fvg',
  'liquidityLevels',
  'dema',
  'tema',
  'wma',
  'hma',
];

interface IndicatorState {
  activeIndicators: IndicatorId[];
  indicatorParams: IndicatorParams;

  toggleIndicator: (id: IndicatorId) => void;
  setIndicatorActive: (id: IndicatorId, active: boolean) => void;
  isActive: (id: IndicatorId) => boolean;
  setIndicatorParams: <K extends keyof IndicatorParams>(
    indicator: K,
    params: Partial<NonNullable<IndicatorParams[K]>>
  ) => void;
  getActiveByCategory: (category: IndicatorCategory) => IndicatorId[];
  getActivePanelIndicators: () => IndicatorId[];
  getActiveOverlayIndicators: () => IndicatorId[];
  resetParams: (indicator: keyof IndicatorParams) => void;
}

export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set, get) => ({
      activeIndicators: ['volume'],
      indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },

      toggleIndicator: (id) =>
        set((state) => {
          const isActive = state.activeIndicators.includes(id);
          return {
            activeIndicators: isActive
              ? state.activeIndicators.filter((i) => i !== id)
              : [...state.activeIndicators, id],
          };
        }),

      setIndicatorActive: (id, active) =>
        set((state) => {
          const isActive = state.activeIndicators.includes(id);
          if (active && !isActive) {
            return { activeIndicators: [...state.activeIndicators, id] };
          }
          if (!active && isActive) {
            return { activeIndicators: state.activeIndicators.filter((i) => i !== id) };
          }
          return state;
        }),

      isActive: (id) => get().activeIndicators.includes(id),

      setIndicatorParams: (indicator, params) =>
        set((state) => ({
          indicatorParams: {
            ...state.indicatorParams,
            [indicator]: {
              ...state.indicatorParams[indicator],
              ...params,
            },
          },
        })),

      getActiveByCategory: (category) => {
        const state = get();
        const categoryIndicators = INDICATOR_CATEGORIES[category];
        return state.activeIndicators.filter((id) => categoryIndicators.includes(id));
      },

      getActivePanelIndicators: () => {
        const state = get();
        return state.activeIndicators.filter((id) => PANEL_INDICATORS.includes(id));
      },

      getActiveOverlayIndicators: () => {
        const state = get();
        return state.activeIndicators.filter((id) => OVERLAY_INDICATORS.includes(id));
      },

      resetParams: (indicator) =>
        set((state) => ({
          indicatorParams: {
            ...state.indicatorParams,
            [indicator]: DEFAULT_INDICATOR_PARAMS[indicator],
          },
        })),
    }),
    {
      name: 'indicator-storage',
      version: 1,
    }
  )
);
