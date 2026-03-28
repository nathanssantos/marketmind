import { create } from 'zustand';
import type {
  SymbolTab,
  LayoutPreset,
  GridPanelConfig,
  LayoutState,
  GridPosition,
  PanelWindowState,
  ChartType,
} from '@shared/types/layout';
import type { MarketType } from '@marketmind/types';
import { useIndicatorStore, type IndicatorId } from './indicatorStore';
import { usePreferencesStore } from './preferencesStore';
import { trpc } from '@renderer/services/trpc';

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getGlobalActiveIndicators = (): IndicatorId[] => {
  try {
    return [...useIndicatorStore.getState().activeIndicators];
  } catch {
    return ['volume', 'stochastic', 'rsi', 'dailyVwap'];
  }
};

const createDefaultPanel = (
  timeframe: string,
  gridPosition: GridPosition,
): GridPanelConfig => ({
  id: generateId(),
  timeframe,
  chartType: 'kline',
  activeIndicators: getGlobalActiveIndicators(),
  indicatorParams: {},
  gridPosition,
  windowState: 'normal',
});

const DEFAULT_LAYOUTS: LayoutPreset[] = [
  {
    id: 'single',
    name: 'Single Chart',
    grid: [createDefaultPanel('1h', { x: 0, y: 0, w: 12, h: 20 })],
    order: 0,
  },
  {
    id: 'dual',
    name: 'Dual',
    grid: [
      createDefaultPanel('4h', { x: 0, y: 0, w: 6, h: 20 }),
      createDefaultPanel('1h', { x: 6, y: 0, w: 6, h: 20 }),
    ],
    order: 1,
  },
  {
    id: 'quad',
    name: 'Quad',
    grid: [
      createDefaultPanel('1d', { x: 0, y: 0, w: 6, h: 10 }),
      createDefaultPanel('4h', { x: 6, y: 0, w: 6, h: 10 }),
      createDefaultPanel('1h', { x: 0, y: 10, w: 6, h: 10 }),
      createDefaultPanel('15m', { x: 6, y: 10, w: 6, h: 10 }),
    ],
    order: 2,
  },
];

interface LayoutActions {
  addSymbolTab: (symbol: string, marketType: MarketType) => void;
  removeSymbolTab: (tabId: string) => void;
  setActiveSymbolTab: (tabId: string) => void;
  updateTabSymbol: (tabId: string, symbol: string, marketType: MarketType) => void;
  reorderSymbolTabs: (tabIds: string[]) => void;

  addLayout: (name: string) => void;
  removeLayout: (layoutId: string) => void;
  setActiveLayout: (tabId: string, layoutId: string) => void;
  renameLayout: (layoutId: string, name: string) => void;
  updateGridLayout: (layoutId: string, panels: GridPanelConfig[]) => void;

  updatePanelGridPosition: (layoutId: string, panelId: string, position: GridPosition) => void;
  setPanelWindowState: (layoutId: string, panelId: string, state: PanelWindowState) => void;
  updatePanelConfig: (layoutId: string, panelId: string, updates: Partial<GridPanelConfig>) => void;
  addPanel: (layoutId: string, timeframe: string) => void;
  removePanel: (layoutId: string, panelId: string) => void;

  setFocusedPanel: (panelId: string | null) => void;

  togglePanelIndicator: (layoutId: string, panelId: string, indicator: IndicatorId) => void;
  setPanelTimeframe: (layoutId: string, panelId: string, timeframe: string) => void;
  setPanelChartType: (layoutId: string, panelId: string, chartType: ChartType) => void;

  hydrate: (state: Partial<LayoutState>) => void;
  getActiveTab: () => SymbolTab | undefined;
  getActiveLayout: () => LayoutPreset | undefined;
  getFocusedPanel: () => GridPanelConfig | undefined;
}

export const useLayoutStore = create<LayoutState & LayoutActions>((set, get) => ({
  symbolTabs: [{
    id: 'default',
    symbol: 'BTCUSDT',
    marketType: 'FUTURES' as MarketType,
    activeLayoutId: 'single',
    order: 0,
  }],
  activeSymbolTabId: 'default',
  layoutPresets: DEFAULT_LAYOUTS,
  focusedPanelId: null,

  addSymbolTab: (symbol, marketType) => set(state => {
    const id = generateId();
    const newTab: SymbolTab = {
      id,
      symbol,
      marketType,
      activeLayoutId: state.layoutPresets[0]?.id ?? 'single',
      order: state.symbolTabs.length,
    };
    return { symbolTabs: [...state.symbolTabs, newTab], activeSymbolTabId: id };
  }),

  removeSymbolTab: (tabId) => set(state => {
    if (state.symbolTabs.length <= 1) return state;
    const filtered = state.symbolTabs.filter(t => t.id !== tabId);
    const activeId = state.activeSymbolTabId === tabId
      ? (filtered[0]?.id ?? '')
      : state.activeSymbolTabId;
    return { symbolTabs: filtered, activeSymbolTabId: activeId };
  }),

  setActiveSymbolTab: (tabId) => set({ activeSymbolTabId: tabId }),

  updateTabSymbol: (tabId, symbol, marketType) => set(state => ({
    symbolTabs: state.symbolTabs.map(t =>
      t.id === tabId ? { ...t, symbol, marketType } : t
    ),
  })),

  reorderSymbolTabs: (tabIds) => set(state => ({
    symbolTabs: tabIds
      .map((id, i) => {
        const tab = state.symbolTabs.find(t => t.id === id);
        return tab ? { ...tab, order: i } : null;
      })
      .filter((t): t is SymbolTab => t !== null),
  })),

  addLayout: (name) => set(state => {
    const id = generateId();
    const layout: LayoutPreset = {
      id,
      name,
      grid: [createDefaultPanel('1h', { x: 0, y: 0, w: 12, h: 20 })],
      order: state.layoutPresets.length,
    };
    return { layoutPresets: [...state.layoutPresets, layout] };
  }),

  removeLayout: (layoutId) => set(state => {
    if (state.layoutPresets.length <= 1) return state;
    return {
      layoutPresets: state.layoutPresets.filter(l => l.id !== layoutId),
      symbolTabs: state.symbolTabs.map(t =>
        t.activeLayoutId === layoutId
          ? { ...t, activeLayoutId: state.layoutPresets.find(l => l.id !== layoutId)?.id ?? '' }
          : t
      ),
    };
  }),

  setActiveLayout: (tabId, layoutId) => set(state => ({
    symbolTabs: state.symbolTabs.map(t =>
      t.id === tabId ? { ...t, activeLayoutId: layoutId } : t
    ),
  })),

  renameLayout: (layoutId, name) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId ? { ...l, name } : l
    ),
  })),

  updateGridLayout: (layoutId, panels) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId ? { ...l, grid: panels } : l
    ),
  })),

  updatePanelGridPosition: (layoutId, panelId, position) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.map(p => p.id === panelId ? { ...p, gridPosition: position } : p) }
        : l
    ),
  })),

  setPanelWindowState: (layoutId, panelId, windowState) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? {
            ...l,
            grid: l.grid.map(p => {
              if (p.id !== panelId) return windowState === 'maximized' ? { ...p, windowState: 'normal' as const } : p;
              const savedGridPosition = windowState !== 'normal' && p.windowState === 'normal' ? p.gridPosition : p.savedGridPosition;
              return { ...p, windowState, savedGridPosition };
            }),
          }
        : l
    ),
  })),

  updatePanelConfig: (layoutId, panelId, updates) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.map(p => p.id === panelId ? { ...p, ...updates } : p) }
        : l
    ),
  })),

  addPanel: (layoutId, timeframe) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: [...l.grid, createDefaultPanel(timeframe, { x: 0, y: 0, w: 6, h: 10 })] }
        : l
    ),
  })),

  removePanel: (layoutId, panelId) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.filter(p => p.id !== panelId) }
        : l
    ),
  })),

  setFocusedPanel: (panelId) => set({ focusedPanelId: panelId }),

  togglePanelIndicator: (layoutId, panelId, indicator) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? {
            ...l,
            grid: l.grid.map(p => {
              if (p.id !== panelId) return p;
              const has = p.activeIndicators.includes(indicator);
              return {
                ...p,
                activeIndicators: has
                  ? p.activeIndicators.filter(i => i !== indicator)
                  : [...p.activeIndicators, indicator],
              };
            }),
          }
        : l
    ),
  })),

  setPanelTimeframe: (layoutId, panelId, timeframe) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.map(p => p.id === panelId ? { ...p, timeframe } : p) }
        : l
    ),
  })),

  setPanelChartType: (layoutId, panelId, chartType) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.map(p => p.id === panelId ? { ...p, chartType } : p) }
        : l
    ),
  })),

  hydrate: (incoming) => set(state => ({ ...state, ...incoming })),

  getActiveTab: () => {
    const state = get();
    return state.symbolTabs.find(t => t.id === state.activeSymbolTabId);
  },

  getActiveLayout: () => {
    const state = get();
    const tab = state.symbolTabs.find(t => t.id === state.activeSymbolTabId);
    if (!tab) return undefined;
    return state.layoutPresets.find(l => l.id === tab.activeLayoutId);
  },

  getFocusedPanel: () => {
    const state = get();
    const layout = get().getActiveLayout();
    if (!layout || !state.focusedPanelId) return undefined;
    return layout.grid.find(p => p.id === state.focusedPanelId);
  },
}));

let persistDebounce: ReturnType<typeof setTimeout> | null = null;

const persistLayout = (): void => {
  if (persistDebounce) clearTimeout(persistDebounce);
  persistDebounce = setTimeout(() => {
    const { symbolTabs, activeSymbolTabId, layoutPresets } = useLayoutStore.getState();
    const data = JSON.stringify({ symbolTabs, activeSymbolTabId, layoutPresets });
    trpc.layout.save.mutate({ data }).catch(() => {});
  }, 500);
};

useLayoutStore.subscribe(persistLayout);

export const hydrateLayoutStore = async (): Promise<void> => {
  try {
    const saved = await trpc.layout.get.query();

    if (saved?.symbolTabs || saved?.activeSymbolTabId || saved?.layoutPresets) {
      useLayoutStore.getState().hydrate({
        ...(saved.symbolTabs && { symbolTabs: saved.symbolTabs }),
        ...(saved.activeSymbolTabId && { activeSymbolTabId: saved.activeSymbolTabId }),
        ...(saved.layoutPresets && { layoutPresets: saved.layoutPresets }),
      });
      return;
    }
  } catch {}

  const chartPrefs = usePreferencesStore.getState().chart;
  const savedSymbol = chartPrefs['symbol'] as string | undefined;
  const savedMarketType = chartPrefs['marketType'] as MarketType | undefined;

  if (savedSymbol) {
    useLayoutStore.getState().updateTabSymbol(
      'default',
      savedSymbol,
      savedMarketType ?? 'FUTURES',
    );
  }
};
