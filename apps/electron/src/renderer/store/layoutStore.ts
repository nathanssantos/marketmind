import { create } from 'zustand';
import type {
  SymbolTab,
  LayoutPreset,
  GridPanelConfig,
  ChartPanelConfig,
  NamedPanelConfig,
  LayoutState,
  GridPosition,
  PanelWindowState,
  ChartType,
  PanelKind,
} from '@shared/types/layout';
import { GRID_VERSION } from '@shared/types/layout';
import type { MarketType } from '@marketmind/types';
import { getPanelDef } from '@renderer/grid/panel-registry';
import { usePreferencesStore } from './preferencesStore';
import { trpc } from '@renderer/services/trpc';

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultPanel = (
  timeframe: string,
  gridPosition: GridPosition,
): ChartPanelConfig => ({
  id: generateId(),
  kind: 'chart',
  timeframe,
  chartType: 'kline',
  gridPosition,
  windowState: 'normal',
});

/**
 * v1.10 Track 1 — find a free vertical slot for a new panel (default-layout
 * dropped via the `+ Add panel` menu). Stacks below the lowest existing
 * panel by default; consumers can drag elsewhere afterwards.
 */
const findEmptySlot = (
  grid: GridPanelConfig[],
  size: { w: number; h: number },
  cols = 192,
): GridPosition => {
  const lowestY = grid.reduce(
    (max, p) => Math.max(max, p.gridPosition.y + p.gridPosition.h),
    0,
  );
  const x = Math.max(0, Math.min(cols - size.w, 0));
  return { x, y: lowestY, w: size.w, h: size.h };
};

const createNamedPanel = (
  kind: Exclude<PanelKind, 'chart'>,
  gridPosition: GridPosition,
): NamedPanelConfig => ({
  id: generateId(),
  kind,
  gridPosition,
  windowState: 'normal',
});

/**
 * Starter layout templates surfaced both as the seed layouts for new users
 * and as choices in the "New layout" dialog (LayoutTabBar). Each template
 * builds its grid lazily so each call generates fresh panel ids — needed
 * when the same template is instantiated more than once (e.g. user creates
 * "Trading 2" from the Trading template).
 */
export type LayoutTemplateKey = 'empty' | 'trading' | 'autoTrading' | 'scalping';

interface LayoutTemplate {
  key: LayoutTemplateKey;
  /** i18n key for the menu/select label. */
  labelKey: string;
  /** Default name when seeding the user's library (and prefill in the dialog). */
  defaultName: string;
  buildGrid: () => GridPanelConfig[];
}

// Trading template uses the exact proportions from the user's hand-built
// layout (2026-05). Auto-Trading and Scalping mirror its anatomy: big
// chart top-left, narrow right rail with auxiliary panels, full-width
// bottom row split between two list panels.
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    key: 'empty',
    labelKey: 'layout.template.empty',
    defaultName: 'Empty',
    buildGrid: () => [createDefaultPanel('1h', { x: 0, y: 0, w: 192, h: 80 })],
  },
  {
    key: 'trading',
    labelKey: 'layout.template.trading',
    defaultName: 'Trading',
    buildGrid: () => [
      createDefaultPanel('1h', { x: 0, y: 0, w: 159, h: 78 }),
      createNamedPanel('portfolio', { x: 159, y: 0, w: 33, h: 35 }),
      createNamedPanel('ticket', { x: 159, y: 35, w: 33, h: 9 }),
      createNamedPanel('checklist', { x: 159, y: 44, w: 33, h: 34 }),
      createNamedPanel('positions', { x: 0, y: 78, w: 96, h: 32 }),
      createNamedPanel('orders', { x: 96, y: 78, w: 96, h: 32 }),
    ],
  },
  {
    key: 'autoTrading',
    labelKey: 'layout.template.autoTrading',
    defaultName: 'Auto-Trading',
    buildGrid: () => [
      createDefaultPanel('1h', { x: 0, y: 0, w: 159, h: 78 }),
      createNamedPanel('watchers', { x: 159, y: 0, w: 33, h: 44 }),
      createNamedPanel('autoTradingSetup', { x: 159, y: 44, w: 33, h: 34 }),
      createNamedPanel('autoTradingActivity', { x: 0, y: 78, w: 96, h: 32 }),
      createNamedPanel('positions', { x: 96, y: 78, w: 96, h: 32 }),
    ],
  },
  {
    key: 'scalping',
    labelKey: 'layout.template.scalping',
    defaultName: 'Scalping',
    buildGrid: () => [
      createDefaultPanel('5m', { x: 0, y: 0, w: 80, h: 78 }),
      createDefaultPanel('1m', { x: 80, y: 0, w: 79, h: 78 }),
      createNamedPanel('ticket', { x: 159, y: 0, w: 33, h: 20 }),
      createNamedPanel('orderFlowMetrics', { x: 159, y: 20, w: 33, h: 58 }),
      createNamedPanel('positions', { x: 0, y: 78, w: 192, h: 32 }),
    ],
  },
];

const getTemplate = (key: LayoutTemplateKey): LayoutTemplate => {
  const t = LAYOUT_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`Unknown layout template: ${key}`);
  return t;
};

const DEFAULT_LAYOUTS: LayoutPreset[] = [
  {
    id: 'trading',
    name: 'Trading',
    grid: getTemplate('trading').buildGrid(),
    order: 0,
  },
  {
    id: 'autotrading',
    name: 'Auto-Trading',
    grid: getTemplate('autoTrading').buildGrid(),
    order: 1,
  },
  {
    id: 'scalping',
    name: 'Scalping',
    grid: getTemplate('scalping').buildGrid(),
    order: 2,
  },
];

interface LayoutActions {
  addSymbolTab: (symbol: string, marketType: MarketType) => void;
  removeSymbolTab: (tabId: string) => void;
  setActiveSymbolTab: (tabId: string) => void;
  updateTabSymbol: (tabId: string, symbol: string, marketType: MarketType) => void;
  reorderSymbolTabs: (tabIds: string[]) => void;

  addLayout: (name: string, templateKey?: LayoutTemplateKey) => void;
  duplicateLayout: (layoutId: string, newName?: string) => void;
  removeLayout: (layoutId: string) => void;
  setActiveLayout: (tabId: string, layoutId: string) => void;
  renameLayout: (layoutId: string, name: string) => void;
  updateGridLayout: (layoutId: string, panels: GridPanelConfig[]) => void;

  updatePanelGridPosition: (layoutId: string, panelId: string, position: GridPosition) => void;
  setPanelWindowState: (layoutId: string, panelId: string, state: PanelWindowState) => void;
  updatePanelConfig: (layoutId: string, panelId: string, updates: Partial<GridPanelConfig>) => void;
  addPanel: (layoutId: string, timeframe: string) => void;
  /** v1.10 — add a single-instance named panel (Ticket, Checklist, etc.) by kind. No-ops if the kind is already on this layout (cardinality enforcement). */
  addNamedPanel: (layoutId: string, kind: Exclude<PanelKind, 'chart'>) => void;
  removePanel: (layoutId: string, panelId: string) => void;
  /** v1.10 — does this layout already contain a panel of this kind? Used by `+ Add panel` menu to grey-out single-instance entries. */
  hasPanelKind: (layoutId: string, kind: PanelKind) => boolean;

  setFocusedPanel: (panelId: string | null) => void;

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
    marketType: 'FUTURES',
    activeLayoutId: 'trading',
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

  addLayout: (name, templateKey = 'empty') => set(state => {
    const template = getTemplate(templateKey);
    const layout: LayoutPreset = {
      id: generateId(),
      name,
      grid: template.buildGrid(),
      order: state.layoutPresets.length,
    };
    return { layoutPresets: [...state.layoutPresets, layout] };
  }),

  duplicateLayout: (layoutId, newName) => set(state => {
    const source = state.layoutPresets.find(l => l.id === layoutId);
    if (!source) return state;
    const layout: LayoutPreset = {
      id: generateId(),
      name: newName ?? `${source.name} (copy)`,
      // Re-mint each panel id so the duplicate is independent of the source.
      grid: source.grid.map(p => ({ ...p, id: generateId() })),
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
        ? {
            ...l,
            grid: l.grid.map((p): GridPanelConfig =>
              p.id === panelId ? ({ ...p, ...updates } as GridPanelConfig) : p,
            ),
          }
        : l,
    ),
  })),

  addPanel: (layoutId, timeframe) => set(state => {
    const layout = state.layoutPresets.find(l => l.id === layoutId);
    if (!layout) return state;
    const def = getPanelDef('chart');
    const slot = findEmptySlot(layout.grid, def.defaultLayout);
    return {
      layoutPresets: state.layoutPresets.map(l =>
        l.id === layoutId ? { ...l, grid: [...l.grid, createDefaultPanel(timeframe, slot)] } : l,
      ),
    };
  }),

  addNamedPanel: (layoutId, kind) => set(state => {
    const layout = state.layoutPresets.find(l => l.id === layoutId);
    if (!layout) return state;
    if (layout.grid.some(p => p.kind === kind)) return state;
    const def = getPanelDef(kind);
    const slot = findEmptySlot(layout.grid, def.defaultLayout);
    return {
      layoutPresets: state.layoutPresets.map(l =>
        l.id === layoutId ? { ...l, grid: [...l.grid, createNamedPanel(kind, slot)] } : l,
      ),
    };
  }),

  removePanel: (layoutId, panelId) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? { ...l, grid: l.grid.filter(p => p.id !== panelId) }
        : l
    ),
  })),

  hasPanelKind: (layoutId, kind) => {
    const layout = get().layoutPresets.find(l => l.id === layoutId);
    return !!layout?.grid.some(p => p.kind === kind);
  },

  setFocusedPanel: (panelId) => set({ focusedPanelId: panelId }),

  setPanelTimeframe: (layoutId, panelId, timeframe) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? {
            ...l,
            grid: l.grid.map((p): GridPanelConfig =>
              p.id === panelId && p.kind === 'chart' ? { ...p, timeframe } : p,
            ),
          }
        : l,
    ),
  })),

  setPanelChartType: (layoutId, panelId, chartType) => set(state => ({
    layoutPresets: state.layoutPresets.map(l =>
      l.id === layoutId
        ? {
            ...l,
            grid: l.grid.map((p): GridPanelConfig =>
              p.id === panelId && p.kind === 'chart' ? { ...p, chartType } : p,
            ),
          }
        : l,
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
let isHydrated = false;

const persistLayout = (): void => {
  if (!isHydrated) return;
  if (persistDebounce) clearTimeout(persistDebounce);
  persistDebounce = setTimeout(() => {
    const { symbolTabs, activeSymbolTabId, layoutPresets } = useLayoutStore.getState();
    const data = JSON.stringify({ symbolTabs, activeSymbolTabId, layoutPresets, gridVersion: GRID_VERSION });
    trpc.layout.save.mutate({ data }).catch(() => {});
  }, 500);
};

useLayoutStore.subscribe(persistLayout);

export const scalePosition = (pos: GridPosition, fx: number, fy: number): GridPosition => ({
  x: Math.round(pos.x * fx),
  y: Math.round(pos.y * fy),
  w: Math.round(pos.w * fx),
  h: Math.round(pos.h * fy),
});

export const migrateGridGranularity = (
  presets: LayoutPreset[],
  fromVersion: number,
): LayoutPreset[] => {
  if (fromVersion >= GRID_VERSION) return presets;
  // v1 → v2: cols 12 → 192 (×16 horizontal so column granularity matches
  // rowHeight 8 visually), rowHeight 30 → 8 (×4 vertical gives close visual
  // match — panels end up ~7% taller, imperceptible).
  const fx = 16;
  const fy = 4;
  return presets.map((preset) => ({
    ...preset,
    grid: preset.grid.map((panel) => ({
      ...panel,
      gridPosition: scalePosition(panel.gridPosition, fx, fy),
      ...(panel.savedGridPosition && {
        savedGridPosition: scalePosition(panel.savedGridPosition, fx, fy),
      }),
    })),
  }));
};

export const hydrateLayoutStore = async (): Promise<void> => {
  try {
    const saved = await trpc.layout.get.query();

    if (saved?.symbolTabs || saved?.activeSymbolTabId || saved?.layoutPresets) {
      const savedVersion =
        typeof (saved as { gridVersion?: number }).gridVersion === 'number'
          ? (saved as { gridVersion: number }).gridVersion
          : 1;
      const migratedPresets = saved.layoutPresets
        ? migrateGridGranularity(saved.layoutPresets, savedVersion)
        : undefined;

      useLayoutStore.getState().hydrate({
        ...(saved.symbolTabs && { symbolTabs: saved.symbolTabs }),
        ...(saved.activeSymbolTabId && { activeSymbolTabId: saved.activeSymbolTabId }),
        ...(migratedPresets && { layoutPresets: migratedPresets }),
      });
      isHydrated = true;
      return;
    }

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
    isHydrated = true;
  } catch (e) {
    // Don't unlock persistence — if the layout query failed (backend down,
    // session not yet established, etc.), allowing writes would let the
    // default in-memory state overwrite the user's saved layouts on the
    // next state change. Stay locked; user changes are lost in this session
    // but the persisted layout is protected.
    console.warn('layoutStore hydrate failed; persistence remains locked', e);
  }
};
