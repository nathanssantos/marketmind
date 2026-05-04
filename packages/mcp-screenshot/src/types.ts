/**
 * Known surfaces the screenshot server can capture.
 *
 * MUST mirror the actual MarketMind app structure. Drift is enforced at
 * runtime by the gallery's contract verification — every id below has
 * to map to a valid app target or the gallery exits 1 before screen-
 * shotting. See `docs/BROWSER_TESTING.md` and the contract test in
 * `apps/electron/src/renderer/services/__tests__/galleryContract.test.ts`.
 */

export type SettingsTabId =
  | 'account'
  | 'security'
  | 'notifications'
  | 'general'
  | 'chart'
  | 'autoTrading'
  | 'indicators'
  | 'data'
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

// Match Settings/constants.ts SETTINGS_TABS exactly.
export const SETTINGS_TABS: SettingsTabId[] = [
  'account', 'security', 'notifications',
  'general', 'chart',
  'autoTrading', 'indicators',
  'data', 'about',
];

export const MODALS: ModalId[] = [
  'settings', 'orders', 'backtest', 'screener', 'analytics',
  // Standalone dialogs (graduated out of Settings per the v1.6 "Settings
  // is for prefs, not records" rule). Opened via store flags exposed in
  // useUIStore — no dependency on header/sidebar UI structure.
  'createWallet', 'tradingProfiles', 'importProfile',
  // Flow modals driven by data-testid clicks (still inside an existing
  // panel/tab, so a click via the store flag isn't enough).
  'addWatcher', 'startWatchers',
];

export const FLOW_MODALS: ModalId[] = [];

export const SIDEBARS: SidebarId[] = ['trading', 'autoTrading', 'market', 'orderFlow'];
