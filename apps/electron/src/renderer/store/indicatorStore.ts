import { FIBONACCI_LEVELS } from '../lib/indicators';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

export interface IndicatorInstance {
  id: string;
  userIndicatorId: string;
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
  visible: boolean;
  paneId?: string;
  zIndex?: number;
}

const generateInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export type IndicatorId =
  | 'ema-7' | 'ema-8' | 'ema-9' | 'ema-10' | 'ema-19' | 'ema-20' | 'ema-21'
  | 'ema-50' | 'ema-70' | 'ema-100' | 'ema-200'
  | 'volume'
  | 'rsi'
  | 'rsi14'
  | 'stochastic'
  | 'bollingerBands'
  | 'atr'
  | 'dailyVwap'
  | 'weeklyVwap'
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
  | 'hma'
  | 'activityIndicator'
  | 'cvd'
  | 'bookImbalance'
  | 'volumeProfile'
  | 'footprint'
  | 'liquidityHeatmap'
  | 'liquidationMarkers'
  | 'orb';

export type IndicatorCategory =
  | 'oscillators'
  | 'momentum'
  | 'trend'
  | 'volatility'
  | 'volume'
  | 'movingAverages'
  | 'priceStructure'
  | 'crypto'
  | 'orderFlow';

export interface MAParams {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  lineWidth: number;
}

export interface IndicatorParams {
  'ema-7'?: MAParams;
  'ema-8'?: MAParams;
  'ema-9'?: MAParams;
  'ema-10'?: MAParams;
  'ema-19'?: MAParams;
  'ema-20'?: MAParams;
  'ema-21'?: MAParams;
  'ema-50'?: MAParams;
  'ema-70'?: MAParams;
  'ema-100'?: MAParams;
  'ema-200'?: MAParams;
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
  'ema-7': { period: 7, type: 'EMA', color: '#00bfff', lineWidth: 1 },
  'ema-8': { period: 8, type: 'EMA', color: '#00bcd4', lineWidth: 1 },
  'ema-9': { period: 9, type: 'EMA', color: '#ff00ff', lineWidth: 1 },
  'ema-10': { period: 10, type: 'EMA', color: '#14b8a6', lineWidth: 1 },
  'ema-19': { period: 19, type: 'EMA', color: '#ff00ff', lineWidth: 1 },
  'ema-20': { period: 20, type: 'EMA', color: '#2196f3', lineWidth: 1 },
  'ema-21': { period: 21, type: 'EMA', color: '#00e676', lineWidth: 1 },
  'ema-50': { period: 50, type: 'EMA', color: '#607d8b', lineWidth: 1 },
  'ema-70': { period: 70, type: 'EMA', color: '#9c27b0', lineWidth: 1 },
  'ema-100': { period: 100, type: 'EMA', color: '#607d8b', lineWidth: 2 },
  'ema-200': { period: 200, type: 'EMA', color: '#607d8b', lineWidth: 3 },
  macd: { fast: 12, slow: 26, signal: 9 },
  adx: { period: 14 },
  williamsR: { period: 14 },
  cci: { period: 14 },
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
  parabolicSar: { step: 0.03, max: 0.3 },
  keltner: { period: 20, multiplier: 2 },
  donchian: { period: 20 },
  obv: { smaPeriod: 20 },
  cmf: { period: 20 },
  klinger: { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 },
  elderRay: { period: 13 },
  pivotPoints: { type: 'standard' },
  fibonacci: { levels: [...FIBONACCI_LEVELS] },
  hma: { period: 20 },
};

export const INDICATOR_CATEGORIES: Record<IndicatorCategory, IndicatorId[]> = {
  oscillators: ['rsi', 'rsi14', 'stochastic', 'williamsR', 'cci', 'stochRsi', 'cmo', 'mfi', 'ultimateOsc'],
  momentum: ['macd', 'tsi', 'ppo', 'roc', 'ao'],
  trend: ['adx', 'aroon', 'vortex', 'parabolicSar', 'supertrend'],
  volatility: ['bollingerBands', 'atr', 'keltner', 'donchian'],
  volume: ['volume', 'dailyVwap', 'weeklyVwap', 'vwap', 'obv', 'cmf', 'klinger', 'elderRay'],
  movingAverages: ['ema-7', 'ema-8', 'ema-9', 'ema-10', 'ema-19', 'ema-20', 'ema-21', 'ema-50', 'ema-70', 'ema-100', 'ema-200', 'dema', 'tema', 'wma', 'hma'],
  priceStructure: ['ichimoku', 'pivotPoints', 'fibonacci', 'fvg', 'liquidityLevels', 'orb'],
  crypto: [],
  orderFlow: ['cvd', 'bookImbalance', 'volumeProfile', 'footprint', 'liquidityHeatmap', 'liquidationMarkers'],
};

export const PANEL_INDICATORS: IndicatorId[] = [
  'rsi',
  'rsi14',
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
  'cvd',
  'bookImbalance',
];

export const OVERLAY_INDICATORS: IndicatorId[] = [
  'ema-7', 'ema-8', 'ema-9', 'ema-10', 'ema-19', 'ema-20', 'ema-21',
  'ema-50', 'ema-70', 'ema-100', 'ema-200',
  'volume',
  'bollingerBands',
  'atr',
  'dailyVwap',
  'weeklyVwap',
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
  'activityIndicator',
  'volumeProfile',
  'footprint',
  'liquidityHeatmap',
  'liquidationMarkers',
  'orb',
];

export const isMAIndicator = (id: string): boolean => id.startsWith('ema-') || id.startsWith('sma-');

export const getMAParams = (id: IndicatorId, params: IndicatorParams): MAParams | undefined =>
  params[id as keyof IndicatorParams] as MAParams | undefined;

const syncToPreferences = (activeIndicators: IndicatorId[], indicatorParams: IndicatorParams) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('chart', 'activeIndicators', activeIndicators);
  prefs.set('chart', 'indicatorParams', indicatorParams);
};

const syncInstancesToPreferences = (instances: IndicatorInstance[]) => {
  const prefs = usePreferencesStore.getState();
  if (!prefs.isHydrated) return;
  prefs.set('chart', 'indicatorInstances', instances);
};

interface IndicatorState {
  activeIndicators: IndicatorId[];
  indicatorParams: IndicatorParams;
  instances: IndicatorInstance[];

  hydrate: (data: {
    activeIndicators?: string[] | undefined;
    indicatorParams?: Record<string, unknown> | undefined;
    instances?: IndicatorInstance[] | unknown;
  }) => void;
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
  clearLegacyState: () => void;

  addInstance: (input: Omit<IndicatorInstance, 'id'>) => string;
  removeInstance: (id: string) => void;
  removeInstancesByUserIndicatorId: (userIndicatorId: string) => void;
  updateInstance: (id: string, patch: Partial<Omit<IndicatorInstance, 'id'>>) => void;
  toggleInstanceVisible: (id: string) => void;
  reorderInstances: (ids: string[]) => void;
  getVisibleInstances: () => IndicatorInstance[];
  getInstancesByPaneId: (paneId: string) => IndicatorInstance[];
}

const sanitizeInstance = (raw: unknown): IndicatorInstance | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<IndicatorInstance>;
  if (typeof candidate.userIndicatorId !== 'string') return null;
  if (typeof candidate.catalogType !== 'string') return null;
  if (!candidate.params || typeof candidate.params !== 'object') return null;
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : generateInstanceId(),
    userIndicatorId: candidate.userIndicatorId,
    catalogType: candidate.catalogType,
    params: candidate.params as Record<string, IndicatorParamValue>,
    visible: candidate.visible !== false,
    paneId: typeof candidate.paneId === 'string' ? candidate.paneId : undefined,
    zIndex: typeof candidate.zIndex === 'number' ? candidate.zIndex : undefined,
  };
};

const sanitizeInstances = (raw: unknown): IndicatorInstance[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeInstance)
    .filter((inst): inst is IndicatorInstance => inst !== null);
};

export const useIndicatorStore = create<IndicatorState>()(
  (set, get) => ({
    activeIndicators: ['volume', 'ema-9', 'ema-21', 'ema-200', 'stochastic', 'rsi'],
    indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
    instances: [],

    hydrate: (data) => {
      const updates: Partial<IndicatorState> = {};
      if (data.activeIndicators) updates.activeIndicators = data.activeIndicators as IndicatorId[];
      if (data.indicatorParams) updates.indicatorParams = { ...DEFAULT_INDICATOR_PARAMS, ...data.indicatorParams } as IndicatorParams;
      if (data.instances !== undefined) updates.instances = sanitizeInstances(data.instances);
      if (Object.keys(updates).length > 0) set(updates);
    },

    toggleIndicator: (id) =>
      set((state) => {
        const isActive = state.activeIndicators.includes(id);
        const activeIndicators = isActive
          ? state.activeIndicators.filter((i) => i !== id)
          : [...state.activeIndicators, id];
        syncToPreferences(activeIndicators, state.indicatorParams);
        return { activeIndicators };
      }),

    setIndicatorActive: (id, active) =>
      set((state) => {
        const isActive = state.activeIndicators.includes(id);
        if (active && !isActive) {
          const activeIndicators = [...state.activeIndicators, id];
          syncToPreferences(activeIndicators, state.indicatorParams);
          return { activeIndicators };
        }
        if (!active && isActive) {
          const activeIndicators = state.activeIndicators.filter((i) => i !== id);
          syncToPreferences(activeIndicators, state.indicatorParams);
          return { activeIndicators };
        }
        return state;
      }),

    isActive: (id) => get().activeIndicators.includes(id),

    setIndicatorParams: (indicator, params) =>
      set((state) => {
        const indicatorParams = {
          ...state.indicatorParams,
          [indicator]: {
            ...state.indicatorParams[indicator],
            ...params,
          },
        };
        syncToPreferences(state.activeIndicators, indicatorParams);
        return { indicatorParams };
      }),

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
      set((state) => {
        const indicatorParams = {
          ...state.indicatorParams,
          [indicator]: DEFAULT_INDICATOR_PARAMS[indicator],
        };
        syncToPreferences(state.activeIndicators, indicatorParams);
        return { indicatorParams };
      }),

    clearLegacyState: () => {
      syncToPreferences([], {} as IndicatorParams);
      set({ activeIndicators: [], indicatorParams: {} as IndicatorParams });
    },

    addInstance: (input) => {
      const id = generateInstanceId();
      const next: IndicatorInstance = {
        id,
        userIndicatorId: input.userIndicatorId,
        catalogType: input.catalogType,
        params: { ...input.params },
        visible: input.visible !== false,
        paneId: input.paneId,
        zIndex: input.zIndex,
      };
      set((state) => {
        const instances = [...state.instances, next];
        syncInstancesToPreferences(instances);
        return { instances };
      });
      return id;
    },

    removeInstance: (id) =>
      set((state) => {
        const instances = state.instances.filter((inst) => inst.id !== id);
        if (instances.length === state.instances.length) return state;
        syncInstancesToPreferences(instances);
        return { instances };
      }),

    removeInstancesByUserIndicatorId: (userIndicatorId) =>
      set((state) => {
        const instances = state.instances.filter((inst) => inst.userIndicatorId !== userIndicatorId);
        if (instances.length === state.instances.length) return state;
        syncInstancesToPreferences(instances);
        return { instances };
      }),

    updateInstance: (id, patch) =>
      set((state) => {
        let mutated = false;
        const instances = state.instances.map((inst) => {
          if (inst.id !== id) return inst;
          mutated = true;
          return {
            ...inst,
            ...patch,
            id: inst.id,
            params: patch.params ? { ...inst.params, ...patch.params } : inst.params,
          };
        });
        if (!mutated) return state;
        syncInstancesToPreferences(instances);
        return { instances };
      }),

    toggleInstanceVisible: (id) =>
      set((state) => {
        let mutated = false;
        const instances = state.instances.map((inst) => {
          if (inst.id !== id) return inst;
          mutated = true;
          return { ...inst, visible: !inst.visible };
        });
        if (!mutated) return state;
        syncInstancesToPreferences(instances);
        return { instances };
      }),

    reorderInstances: (ids) =>
      set((state) => {
        const order = new Map(ids.map((id, idx) => [id, idx]));
        const instances = [...state.instances].sort((a, b) => {
          const ai = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER;
          const bi = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER;
          return ai - bi;
        });
        syncInstancesToPreferences(instances);
        return { instances };
      }),

    getVisibleInstances: () => get().instances.filter((inst) => inst.visible),

    getInstancesByPaneId: (paneId) => get().instances.filter((inst) => inst.paneId === paneId),
  })
);
