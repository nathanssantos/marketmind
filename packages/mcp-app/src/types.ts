export type SettingsTabId =
  | 'account'
  | 'security'
  | 'notifications'
  | 'general'
  | 'chart'
  | 'wallets'
  | 'tradingProfiles'
  | 'autoTrading'
  | 'indicators'
  | 'customSymbols'
  | 'data'
  | 'updates'
  | 'about';

export type ModalId =
  | 'settings'
  | 'orders'
  | 'backtest'
  | 'screener'
  | 'analytics'
  | 'createWallet'
  | 'addWatcher'
  | 'startWatchers'
  | 'importProfile';

export type SidebarId = 'trading' | 'autoTrading' | 'market' | 'orderFlow';

export type Theme = 'light' | 'dark';

export type StoreId =
  | 'priceStore'
  | 'indicatorStore'
  | 'layoutStore'
  | 'drawingStore'
  | 'uiStore'
  | 'preferencesStore'
  | 'connectionStore'
  | 'screenerStore'
  | 'backtestModalStore';

export const SETTINGS_TABS: SettingsTabId[] = [
  'account', 'security', 'notifications',
  'general', 'chart',
  'wallets', 'tradingProfiles', 'autoTrading', 'indicators', 'customSymbols',
  'data', 'updates', 'about',
];

export const MODALS: ModalId[] = [
  'settings', 'orders', 'backtest', 'screener', 'analytics',
  'createWallet', 'addWatcher', 'startWatchers', 'importProfile',
];

export const SIDEBARS: SidebarId[] = ['trading', 'autoTrading', 'market', 'orderFlow'];

export const STORES: StoreId[] = [
  'priceStore', 'indicatorStore', 'layoutStore', 'drawingStore',
  'uiStore', 'preferencesStore', 'connectionStore',
  'screenerStore', 'backtestModalStore',
];

/**
 * Allowlist of {store, action} pairs the MCP can dispatch on behalf of an agent.
 * Anything not in this list is rejected — keeps agent dispatches predictable
 * and prevents accidental writes through the wrong store.
 */
export const STORE_DISPATCH_ALLOWLIST: Record<string, string[]> = {
  uiStore: [
    'setOrdersDialogOpen',
    'setAnalyticsOpen',
    'setMarketSidebarOpen',
    'setOrderFlowSidebarOpen',
  ],
  screenerStore: ['setScreenerOpen', 'toggleScreener', 'setActivePresetId'],
  backtestModalStore: ['openBacktest', 'closeBacktest', 'toggleBacktest'],
  preferencesStore: ['set'],
};

/**
 * Toolbar action ids that `app.dispatchToolbar` will accept.
 * Each maps to a CSS selector or store dispatch on the renderer side.
 */
export const TOOLBAR_ACTIONS = [
  'toggleTrading',
  'toggleAutoTrading',
  'toggleMarketSidebar',
  'toggleOrderFlowSidebar',
  'openScreener',
  'openBacktest',
  'openAnalytics',
  'openOrders',
  'openSettings',
] as const;

export type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number];
