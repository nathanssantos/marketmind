import type { PanelKind } from '@shared/types/layout';
import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import {
  LuActivity,
  LuBookOpen,
  LuChartCandlestick,
  LuClipboardList,
  LuListChecks,
  LuListOrdered,
  LuPackage,
  LuRadar,
  LuTarget,
  LuTicket,
  LuWallet,
} from 'react-icons/lu';

export type PanelGroup = 'charts' | 'trading' | 'market' | 'autoTrading' | 'orderFlow';
export type PanelCardinality = 'multi' | 'single';

export interface PanelDef {
  /** PanelKind discriminator from layout types. */
  kind: PanelKind;
  /** Display group in the `+ Add panel` dropdown. */
  group: PanelGroup;
  /** i18n key for the menu label and (chart-mode) panel title. */
  titleKey: string;
  /** Icon shown in the menu. */
  icon: IconType;
  /** Charts are unlimited; every other panel is single-instance. */
  cardinality: PanelCardinality;
  /**
   * `chart` panels render with a header (title + close X). Every other panel
   * renders headerless and closes via right-click context menu.
   */
  shellMode: 'chart' | 'bare';
  /** Default size when added to the grid via the `+` menu. */
  defaultLayout: { w: number; h: number };
  /**
   * Lazy-loaded panel body component. Receives `panelId` so panels that
   * need to update their own grid entry can pass it back to store
   * actions; most panel bodies just ignore it and read from a store
   * directly.
   */
  load: () => Promise<{ default: ComponentType<PanelBodyProps> }>;
}

export interface PanelBodyProps {
  panelId: string;
}

const TRADING_DEFAULT = { w: 64, h: 48 };
const MARKET_DEFAULT = { w: 64, h: 56 };
const AUTOTRADING_DEFAULT = { w: 80, h: 48 };
const CHART_DEFAULT = { w: 128, h: 64 };

/**
 * Chart panels never go through the registry's `load` — they render via
 * `<ChartGridPanel>` directly in `ChartGrid` since they need symbol +
 * marketType + layoutId props the generic `<NamedPanelRenderer>` doesn't
 * thread. Calling this placeholder is a programming error.
 */
const CHART_LOAD_UNUSED: PanelDef['load'] = () =>
  Promise.reject(new Error('chart panels render via <ChartGridPanel>, not the registry load'));

export const PANEL_REGISTRY: Record<PanelKind, PanelDef> = {
  chart: {
    kind: 'chart',
    group: 'charts',
    titleKey: 'panels.chart.title',
    icon: LuChartCandlestick,
    cardinality: 'multi',
    shellMode: 'chart',
    defaultLayout: CHART_DEFAULT,
    load: CHART_LOAD_UNUSED,
  },
  ticket: {
    kind: 'ticket',
    group: 'trading',
    titleKey: 'panels.ticket.title',
    icon: LuTicket,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: TRADING_DEFAULT,
    load: () =>
      import('@renderer/components/Trading/panels/TicketPanel').then((m) => ({
        default: m.TicketPanel,
      })),
  },
  checklist: {
    kind: 'checklist',
    group: 'trading',
    titleKey: 'panels.checklist.title',
    icon: LuListChecks,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: TRADING_DEFAULT,
    load: () =>
      import('@renderer/components/Trading/panels/ChecklistPanel').then((m) => ({
        default: m.ChecklistPanel,
      })),
  },
  orders: {
    kind: 'orders',
    group: 'trading',
    titleKey: 'panels.orders.title',
    icon: LuListOrdered,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: TRADING_DEFAULT,
    load: () =>
      import('@renderer/components/Trading/panels/OrdersPanel').then((m) => ({
        default: m.OrdersPanel,
      })),
  },
  portfolio: {
    kind: 'portfolio',
    group: 'trading',
    titleKey: 'panels.portfolio.title',
    icon: LuWallet,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: TRADING_DEFAULT,
    load: () =>
      import('@renderer/components/Trading/panels/PortfolioPanel').then((m) => ({
        default: m.PortfolioPanel,
      })),
  },
  positions: {
    kind: 'positions',
    group: 'trading',
    titleKey: 'panels.positions.title',
    icon: LuPackage,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: TRADING_DEFAULT,
    load: () =>
      import('@renderer/components/Trading/panels/PositionsPanel').then((m) => ({
        default: m.PositionsPanel,
      })),
  },
  marketIndicators: {
    kind: 'marketIndicators',
    group: 'market',
    titleKey: 'panels.marketIndicators.title',
    icon: LuActivity,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: MARKET_DEFAULT,
    load: () =>
      import('@renderer/components/MarketSidebar/panels/MarketIndicatorsPanel').then((m) => ({
        default: m.MarketIndicatorsPanel,
      })),
  },
  watchers: {
    kind: 'watchers',
    group: 'autoTrading',
    titleKey: 'panels.watchers.title',
    icon: LuRadar,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: AUTOTRADING_DEFAULT,
    load: () =>
      import('@renderer/components/AutoTrading/panels/WatchersPanel').then((m) => ({
        default: m.WatchersPanel,
      })),
  },
  autoTradingSetup: {
    kind: 'autoTradingSetup',
    group: 'autoTrading',
    titleKey: 'panels.autoTradingSetup.title',
    icon: LuTarget,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: AUTOTRADING_DEFAULT,
    load: () =>
      import('@renderer/components/AutoTrading/panels/AutoTradingSetupPanel').then((m) => ({
        default: m.AutoTradingSetupPanel,
      })),
  },
  autoTradingActivity: {
    kind: 'autoTradingActivity',
    group: 'autoTrading',
    titleKey: 'panels.autoTradingActivity.title',
    icon: LuClipboardList,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: AUTOTRADING_DEFAULT,
    load: () =>
      import('@renderer/components/AutoTrading/panels/AutoTradingActivityPanel').then((m) => ({
        default: m.AutoTradingActivityPanel,
      })),
  },
  orderBook: {
    kind: 'orderBook',
    group: 'orderFlow',
    titleKey: 'panels.orderBook.title',
    icon: LuBookOpen,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: AUTOTRADING_DEFAULT,
    load: () =>
      import('@renderer/components/OrderFlow/panels/OrderBookPanel').then((m) => ({
        default: m.OrderBookPanel,
      })),
  },
  orderFlowMetrics: {
    kind: 'orderFlowMetrics',
    group: 'orderFlow',
    titleKey: 'panels.orderFlowMetrics.title',
    icon: LuActivity,
    cardinality: 'single',
    shellMode: 'bare',
    defaultLayout: AUTOTRADING_DEFAULT,
    load: () =>
      import('@renderer/components/OrderFlow/panels/OrderFlowMetricsPanel').then((m) => ({
        default: m.OrderFlowMetricsPanel,
      })),
  },
};

export const PANEL_GROUP_ORDER: PanelGroup[] = ['charts', 'trading', 'market', 'autoTrading', 'orderFlow'];

export const PANEL_GROUP_LABEL_KEYS: Record<PanelGroup, string> = {
  charts: 'panels.groups.charts',
  trading: 'panels.groups.trading',
  market: 'panels.groups.market',
  autoTrading: 'panels.groups.autoTrading',
  orderFlow: 'panels.groups.orderFlow',
};

export const getPanelDef = (kind: PanelKind): PanelDef => {
  const def = PANEL_REGISTRY[kind];
  if (!def) throw new Error(`Unknown panel kind: ${kind}`);
  return def;
};

export const groupedPanelDefs = (): Array<{ group: PanelGroup; defs: PanelDef[] }> =>
  PANEL_GROUP_ORDER.map((group) => ({
    group,
    defs: Object.values(PANEL_REGISTRY).filter((def) => def.group === group),
  }));
