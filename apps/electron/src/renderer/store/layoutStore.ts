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
import { useChartLayersStore } from './chartLayersStore';

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
 *
 * The trading variants share an identical panel anatomy (1 primary chart,
 * 2 secondary timeframe charts on the right, ticket / checklist / positions
 * / orders / portfolio rail) — only the chart timeframes differ. The user
 * built and validated this set hand-tuned to the 192-col / 8-row grid.
 */
export type LayoutTemplateKey =
  | 'empty'
  | 'tradingScalp'
  | 'tradingDay'
  | 'tradingSwing'
  | 'tradingMidterm'
  | 'tradingPosition'
  | 'tradingLong'
  | 'autoTrading'
  | 'autoScalping'
  | 'marketIndicators';

interface LayoutTemplate {
  key: LayoutTemplateKey;
  /** Default name when seeding the user's library (and prefill in the dialog). */
  defaultName: string;
  buildGrid: () => GridPanelConfig[];
}

/** Standard trading layout — 3 chart timeframes + ticket / checklist / positions / orders / portfolio rail. */
const buildTradingGrid = (
  primary: string,
  secondary: string,
  tertiary: string,
): GridPanelConfig[] => [
  createDefaultPanel(primary, { x: 0, y: 0, w: 122, h: 82 }),
  createDefaultPanel(secondary, { x: 122, y: 0, w: 37, h: 44 }),
  createDefaultPanel(tertiary, { x: 122, y: 44, w: 37, h: 38 }),
  createNamedPanel('portfolio', { x: 159, y: 0, w: 33, h: 35 }),
  createNamedPanel('ticket', { x: 159, y: 35, w: 33, h: 9 }),
  createNamedPanel('checklist', { x: 159, y: 44, w: 33, h: 38 }),
  createNamedPanel('positions', { x: 0, y: 82, w: 96, h: 32 }),
  createNamedPanel('orders', { x: 96, y: 82, w: 96, h: 32 }),
];

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    key: 'empty',
    defaultName: 'Empty',
    buildGrid: () => [createDefaultPanel('1h', { x: 0, y: 0, w: 192, h: 80 })],
  },
  {
    key: 'tradingScalp',
    defaultName: '1m / 5m / 15m',
    buildGrid: () => buildTradingGrid('1m', '5m', '15m'),
  },
  {
    key: 'tradingDay',
    defaultName: '5m / 15m / 1h',
    buildGrid: () => buildTradingGrid('5m', '15m', '1h'),
  },
  {
    key: 'tradingSwing',
    defaultName: '15m / 1h / 4h',
    buildGrid: () => buildTradingGrid('15m', '1h', '4h'),
  },
  {
    key: 'tradingMidterm',
    defaultName: '1h / 4h / 1d',
    buildGrid: () => buildTradingGrid('1h', '4h', '1d'),
  },
  {
    key: 'tradingPosition',
    defaultName: '4h / 1d / 1w',
    buildGrid: () => buildTradingGrid('4h', '1d', '1w'),
  },
  {
    key: 'tradingLong',
    defaultName: '1d / 1w / 1M',
    buildGrid: () => buildTradingGrid('1d', '1w', '1M'),
  },
  {
    key: 'autoTrading',
    defaultName: 'Auto-Trading',
    buildGrid: () => [
      createDefaultPanel('15m', { x: 0, y: 0, w: 122, h: 82 }),
      createDefaultPanel('1h', { x: 122, y: 0, w: 37, h: 44 }),
      createDefaultPanel('4h', { x: 122, y: 44, w: 37, h: 38 }),
      createNamedPanel('portfolio', { x: 159, y: 0, w: 33, h: 35 }),
      createNamedPanel('watchers', { x: 159, y: 35, w: 33, h: 47 }),
      createNamedPanel('positions', { x: 0, y: 82, w: 96, h: 32 }),
      createNamedPanel('orders', { x: 96, y: 82, w: 96, h: 32 }),
    ],
  },
  {
    key: 'autoScalping',
    defaultName: 'Auto-Scalping',
    buildGrid: () => [
      createDefaultPanel('1m', { x: 0, y: 0, w: 133, h: 81 }),
      createNamedPanel('orderBook', { x: 133, y: 0, w: 26, h: 81 }),
      createNamedPanel('portfolio', { x: 159, y: 0, w: 33, h: 35 }),
      createNamedPanel('orderFlowMetrics', { x: 159, y: 35, w: 33, h: 16 }),
      createNamedPanel('autoTradingSetup', { x: 159, y: 51, w: 33, h: 30 }),
      createNamedPanel('positions', { x: 0, y: 81, w: 96, h: 32 }),
      createNamedPanel('orders', { x: 96, y: 81, w: 96, h: 32 }),
    ],
  },
  {
    key: 'marketIndicators',
    defaultName: 'Market Indicators',
    buildGrid: () => [
      createNamedPanel('marketIndicators', { x: 0, y: 0, w: 192, h: 63 }),
      createNamedPanel('marketFearGreed', { x: 0, y: 63, w: 64, h: 41 }),
      createNamedPanel('marketBtcDominance', { x: 64, y: 63, w: 64, h: 41 }),
      createNamedPanel('marketMvrv', { x: 128, y: 63, w: 64, h: 41 }),
      createNamedPanel('marketProductionCost', { x: 0, y: 104, w: 64, h: 41 }),
      createNamedPanel('marketOpenInterest', { x: 64, y: 104, w: 64, h: 41 }),
      createNamedPanel('marketLongShort', { x: 128, y: 104, w: 64, h: 41 }),
    ],
  },
];

const getTemplate = (key: LayoutTemplateKey): LayoutTemplate => {
  const t = LAYOUT_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`Unknown layout template: ${key}`);
  return t;
};

// Three layouts seeded for new users. Stable IDs (`trading` /
// `autotrading` / `scalping`) match the backend `isDefaultLayoutData`
// guard so the overwrite-protection still detects untouched-default
// state — adding a 4th seed here would trip the guard and treat the
// new defaults as user-customized. The "Trading" seed uses the swing
// variant (15m / 1h / 4h) as the most generally useful timeframe set;
// the other 5 trading variants + Market Indicators are available via
// the New Layout dialog.
const DEFAULT_LAYOUTS: LayoutPreset[] = [
  {
    id: 'trading',
    name: '15m / 1h / 4h',
    grid: getTemplate('tradingSwing').buildGrid(),
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
    name: 'Auto-Scalping',
    grid: getTemplate('autoScalping').buildGrid(),
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
  /**
   * v1.5 — global layout state. Switching a layout applies to every
   * symbol tab (decoupled from `SymbolTab.activeLayoutId`). Old
   * `(tabId, layoutId)` callsites updated.
   */
  setActiveLayout: (layoutId: string) => void;
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

  setGridEditMode: (enabled: boolean) => void;
  toggleGridEditMode: () => void;

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
    order: 0,
  }],
  activeSymbolTabId: 'default',
  activeLayoutId: 'trading',
  layoutPresets: DEFAULT_LAYOUTS,
  focusedPanelId: null,
  gridEditMode: false,

  setGridEditMode: (enabled) => set({ gridEditMode: enabled }),
  toggleGridEditMode: () => set(state => ({ gridEditMode: !state.gridEditMode })),

  addSymbolTab: (symbol, marketType) => set(state => {
    const id = generateId();
    const newTab: SymbolTab = {
      id,
      symbol,
      marketType,
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
    const remainingPresets = state.layoutPresets.filter(l => l.id !== layoutId);
    return {
      layoutPresets: remainingPresets,
      activeLayoutId: state.activeLayoutId === layoutId
        ? remainingPresets[0]?.id ?? ''
        : state.activeLayoutId,
    };
  }),

  setActiveLayout: (layoutId) => set({ activeLayoutId: layoutId }),

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
    return state.layoutPresets.find(l => l.id === state.activeLayoutId);
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
    const { symbolTabs, activeSymbolTabId, activeLayoutId, layoutPresets } = useLayoutStore.getState();
    const chartLayers = useChartLayersStore.getState().flagsByPanelId;
    const data = JSON.stringify({ symbolTabs, activeSymbolTabId, activeLayoutId, layoutPresets, chartLayers, gridVersion: GRID_VERSION });
    trpc.layout.save.mutate({ data }).catch(() => {});
  }, 500);
};

useLayoutStore.subscribe(persistLayout);
useChartLayersStore.subscribe(persistLayout);

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

      // v1.5 — `activeLayoutId` lifted from per-tab to top-level. If
      // the persisted state is from before the lift, fall back to the
      // active tab's old `activeLayoutId` so the user's last-seen
      // layout survives the upgrade.
      const persistedActiveLayoutId =
        (saved as { activeLayoutId?: string }).activeLayoutId
        ?? saved.symbolTabs?.find(
          (t: SymbolTab) => t.id === saved.activeSymbolTabId,
        )?.activeLayoutId;

      useLayoutStore.getState().hydrate({
        ...(saved.symbolTabs && { symbolTabs: saved.symbolTabs }),
        ...(saved.activeSymbolTabId && { activeSymbolTabId: saved.activeSymbolTabId }),
        ...(persistedActiveLayoutId && { activeLayoutId: persistedActiveLayoutId }),
        ...(migratedPresets && { layoutPresets: migratedPresets }),
      });

      // Persisted chart-layer flags. Older snapshots used a
      // `(symbol, interval)` composite key; the current schema is
      // per-panelId. Drop any old-shape entries (keys that contain ':'
      // are the legacy composite). Existing per-panelId entries
      // (UUIDs, no colon) survive untouched.
      const persistedChartLayers = (saved as { chartLayers?: Record<string, unknown> }).chartLayers;
      if (persistedChartLayers && typeof persistedChartLayers === 'object') {
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(persistedChartLayers)) {
          if (!key.includes(':')) filtered[key] = value;
        }
        useChartLayersStore.setState({ flagsByPanelId: filtered as ReturnType<typeof useChartLayersStore.getState>['flagsByPanelId'] });
      }

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
