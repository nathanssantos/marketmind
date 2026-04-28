/**
 * Known surfaces the screenshot server can capture.
 * Mirror the MarketMind app structure — tabs, modals, sidebars.
 */

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
  | 'startWatchers'
  | 'createWallet'
  | 'addWatcher'
  | 'importProfile'
  | 'tradingProfiles';

export type SidebarId =
  | 'trading'
  | 'autoTrading'
  | 'market'
  | 'orderFlow';

export type Theme = 'light' | 'dark';

export const SETTINGS_TABS: SettingsTabId[] = [
  'account', 'security', 'notifications',
  'general', 'chart',
  'wallets', 'tradingProfiles', 'autoTrading', 'indicators', 'customSymbols',
  'data', 'updates', 'about',
];

export const MODALS: ModalId[] = [
  'settings', 'orders', 'backtest', 'screener', 'analytics',
  // Flow modals — driven by data-testid clicks via mcp-screenshot/capture.ts
  'createWallet', 'addWatcher', 'startWatchers', 'importProfile',
  // 'tradingProfiles' — same content as settings-tradingProfiles, skipped
];

export const FLOW_MODALS: ModalId[] = [];

export const SIDEBARS: SidebarId[] = ['trading', 'autoTrading', 'market', 'orderFlow'];
