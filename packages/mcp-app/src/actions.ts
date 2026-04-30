import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPage, setTheme as applyThemeBrowser } from './browser.js';
import {
  STORE_DISPATCH_ALLOWLIST,
  type ModalId,
  type SettingsTabId,
  type SidebarId,
  type StoreId,
  type Theme,
  type ToolbarAction,
} from './types.js';

const SCREENSHOT_DIR = process.env.MM_MCP_APP_SCREENSHOT_DIR ?? path.resolve('apps/electron/screenshots');

interface BridgeActions {
  openSettings: (tab?: string) => void;
  closeAll: () => void;
  navigateToSymbol: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
  setTimeframe: (tf: string) => void;
  setChartType: (type: string) => void;
  setMarketType: (marketType: 'SPOT' | 'FUTURES') => void;
}

export const openSettings = async (tab?: SettingsTabId): Promise<{ ok: true }> => {
  const page = await getPage();
  await page.evaluate((t) => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.openSettings(t);
  }, tab);
  await page.waitForTimeout(200);
  return { ok: true };
};

export const closeSettings = async (): Promise<{ ok: true }> => {
  const page = await getPage();
  await page.evaluate(() => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.closeAll();
  });
  await page.waitForTimeout(150);
  return { ok: true };
};

export const closeAll = async (): Promise<{ ok: true }> => {
  const page = await getPage();
  await page.evaluate(() => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.closeAll();
  });
  await page.waitForTimeout(150);
  return { ok: true };
};

const clickTrigger = async (testid: string, settleMs = 400): Promise<void> => {
  const page = await getPage();
  await page.locator(`[data-testid="${testid}"]`).first().click({ timeout: 5000 });
  await page.waitForTimeout(settleMs);
};

export const openModal = async (modalId: ModalId): Promise<{ ok: true; modalId: ModalId }> => {
  const page = await getPage();
  if (modalId === 'settings') {
    await openSettings();
    return { ok: true, modalId };
  }
  // Flow modals — driven by data-testid clicks on real UI affordances
  if (modalId === 'createWallet') {
    await openSettings('wallets');
    await clickTrigger('trigger-create-wallet');
    return { ok: true, modalId };
  }
  if (modalId === 'importProfile') {
    await openSettings('tradingProfiles');
    await clickTrigger('trigger-import-profile');
    return { ok: true, modalId };
  }
  if (modalId === 'addWatcher') {
    await openSettings('autoTrading');
    await clickTrigger('trigger-add-watcher');
    return { ok: true, modalId };
  }
  if (modalId === 'startWatchers') {
    await page.evaluate(() => {
      const w = window as unknown as {
        __preferencesStore?: { getState: () => { set: (cat: string, key: string, v: unknown) => void } };
      };
      w.__preferencesStore?.getState().set('ui', 'autoTradingSidebarOpen', true);
    });
    await page.waitForTimeout(200);
    await clickTrigger('trigger-start-watchers');
    return { ok: true, modalId };
  }
  await page.evaluate((id) => {
    const w = window as unknown as {
      __uiStore?: { getState: () => Record<string, (v?: unknown) => void> };
      __backtestModalStore?: { getState: () => { openBacktest: () => void } };
      __screenerStore?: { getState: () => { setScreenerOpen: (v: boolean) => void } };
    };
    const ui = w.__uiStore?.getState();
    switch (id) {
      case 'orders': ui?.setOrdersDialogOpen?.(true); break;
      case 'backtest': w.__backtestModalStore?.getState().openBacktest(); break;
      case 'screener': w.__screenerStore?.getState().setScreenerOpen(true); break;
      case 'analytics': ui?.setAnalyticsOpen?.(true); break;
    }
  }, modalId);
  await page.waitForTimeout(250);
  return { ok: true, modalId };
};

export const navigateToSymbol = async (
  symbol: string,
  marketType?: 'SPOT' | 'FUTURES',
): Promise<{ ok: true; symbol: string; marketType?: string }> => {
  const page = await getPage();
  await page.evaluate(({ s, mt }) => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.navigateToSymbol(s, mt);
  }, { s: symbol, mt: marketType });
  await page.waitForTimeout(400);
  return { ok: true, symbol, marketType };
};

export const setTimeframe = async (tf: string): Promise<{ ok: true; timeframe: string }> => {
  const page = await getPage();
  await page.evaluate((t) => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.setTimeframe(t);
  }, tf);
  return { ok: true, timeframe: tf };
};

export const setChartType = async (type: string): Promise<{ ok: true; chartType: string }> => {
  const page = await getPage();
  await page.evaluate((t) => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.setChartType(t);
  }, type);
  return { ok: true, chartType: type };
};

export const setMarketType = async (mt: 'SPOT' | 'FUTURES'): Promise<{ ok: true; marketType: string }> => {
  const page = await getPage();
  await page.evaluate((m) => {
    const w = window as unknown as { __globalActions?: BridgeActions };
    w.__globalActions?.setMarketType(m);
  }, mt);
  return { ok: true, marketType: mt };
};

export const applyTheme = async (theme: Theme): Promise<{ ok: true; theme: Theme }> => {
  await applyThemeBrowser(theme);
  return { ok: true, theme };
};

export const toggleSidebar = async (
  sidebarId: SidebarId,
  open?: boolean,
): Promise<{ ok: true; sidebarId: SidebarId; open: boolean }> => {
  const page = await getPage();
  const desired = await page.evaluate(({ id, force }) => {
    const w = window as unknown as {
      __uiStore?: { getState: () => Record<string, unknown> };
      __preferencesStore?: { getState: () => { ui: Record<string, unknown>; set: (cat: string, key: string, v: unknown) => void } };
    };
    if (id === 'trading' || id === 'autoTrading') {
      const prefKey = id === 'trading' ? 'tradingSidebarOpen' : 'autoTradingSidebarOpen';
      const prefs = w.__preferencesStore?.getState();
      const current = Boolean(prefs?.ui[prefKey]);
      const next = force ?? !current;
      prefs?.set('ui', prefKey, next);
      return next;
    }
    const ui = w.__uiStore?.getState();
    if (!ui) return false;
    const stateKey = id === 'market' ? 'marketSidebarOpen' : 'orderFlowSidebarOpen';
    const setterKey = id === 'market' ? 'setMarketSidebarOpen' : 'setOrderFlowSidebarOpen';
    const current = Boolean(ui[stateKey]);
    const next = force ?? !current;
    const setter = ui[setterKey] as ((v: boolean) => void) | undefined;
    setter?.(next);
    return next;
  }, { id: sidebarId, force: open });
  await page.waitForTimeout(150);
  return { ok: true, sidebarId, open: desired };
};

export const toggleIndicator = async (
  instanceId: string,
): Promise<{ ok: true; instanceId: string }> => {
  const page = await getPage();
  await page.evaluate((id) => {
    const w = window as unknown as {
      __indicatorStore?: { getState: () => { toggleInstanceVisible: (id: string) => void } };
    };
    w.__indicatorStore?.getState().toggleInstanceVisible(id);
  }, instanceId);
  return { ok: true, instanceId };
};

export const dispatchToolbar = async (
  action: ToolbarAction,
): Promise<{ ok: true; action: ToolbarAction }> => {
  const page = await getPage();
  await page.evaluate((act) => {
    const w = window as unknown as {
      __globalActions?: BridgeActions;
      __uiStore?: { getState: () => Record<string, (v?: unknown) => void> };
      __backtestModalStore?: { getState: () => { openBacktest: () => void } };
      __screenerStore?: { getState: () => { setScreenerOpen: (v: boolean) => void } };
      __preferencesStore?: { getState: () => { ui: Record<string, unknown>; set: (cat: string, key: string, v: unknown) => void } };
    };
    const ui = w.__uiStore?.getState();
    switch (act) {
      case 'openSettings': w.__globalActions?.openSettings(); break;
      case 'openOrders': ui?.setOrdersDialogOpen?.(true); break;
      case 'openAnalytics': ui?.setAnalyticsOpen?.(true); break;
      case 'openBacktest': w.__backtestModalStore?.getState().openBacktest(); break;
      case 'openScreener': w.__screenerStore?.getState().setScreenerOpen(true); break;
      case 'toggleMarketSidebar': {
        const cur = Boolean((ui as Record<string, unknown>)?.marketSidebarOpen);
        ui?.setMarketSidebarOpen?.(!cur);
        break;
      }
      case 'toggleOrderFlowSidebar': {
        const cur = Boolean((ui as Record<string, unknown>)?.orderFlowSidebarOpen);
        ui?.setOrderFlowSidebarOpen?.(!cur);
        break;
      }
      case 'toggleTrading': {
        const prefs = w.__preferencesStore?.getState();
        const cur = Boolean(prefs?.ui['tradingSidebarOpen']);
        prefs?.set('ui', 'tradingSidebarOpen', !cur);
        break;
      }
      case 'toggleAutoTrading': {
        const prefs = w.__preferencesStore?.getState();
        const cur = Boolean(prefs?.ui['autoTradingSidebarOpen']);
        prefs?.set('ui', 'autoTradingSidebarOpen', !cur);
        break;
      }
    }
  }, action);
  await page.waitForTimeout(200);
  return { ok: true, action };
};

export const click = async (selector: string): Promise<{ ok: true; selector: string }> => {
  const page = await getPage();
  await page.click(selector, { timeout: 5_000 });
  return { ok: true, selector };
};

export const fill = async (selector: string, value: string): Promise<{ ok: true; selector: string }> => {
  const page = await getPage();
  await page.fill(selector, value, { timeout: 5_000 });
  return { ok: true, selector };
};

interface WaitForOptions {
  selector?: string;
  text?: string;
  timeoutMs?: number;
}

export const waitFor = async (opts: WaitForOptions): Promise<{ ok: true }> => {
  const page = await getPage();
  const timeout = opts.timeoutMs ?? 10_000;
  if (opts.selector) {
    await page.waitForSelector(opts.selector, { timeout });
  } else if (opts.text) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), opts.text, { timeout });
  } else {
    throw new Error('waitFor requires selector or text');
  }
  return { ok: true };
};

export const takeScreenshot = async (
  label: string,
): Promise<{ ok: true; path: string }> => {
  const page = await getPage();
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(SCREENSHOT_DIR, `${label}__${ts}.png`);
  const buffer = await page.screenshot({ fullPage: false });
  await writeFile(filepath, buffer);
  return { ok: true, path: filepath };
};

const STORE_GLOBAL_KEYS: Record<StoreId, string> = {
  priceStore: '__priceStore',
  indicatorStore: '__indicatorStore',
  layoutStore: '__layoutStore',
  drawingStore: '__drawingStore',
  uiStore: '__uiStore',
  preferencesStore: '__preferencesStore',
  connectionStore: '__connectionStore',
  screenerStore: '__screenerStore',
  backtestModalStore: '__backtestModalStore',
};

export const inspectStore = async (storeId: StoreId): Promise<unknown> => {
  const page = await getPage();
  const key = STORE_GLOBAL_KEYS[storeId];
  return page.evaluate((globalKey) => {
    const w = window as unknown as Record<string, { getState: () => unknown } | undefined>;
    const store = w[globalKey];
    if (!store) return { error: `store '${globalKey}' not exposed (renderer must run with VITE_E2E_BYPASS_AUTH=true)` };
    const state = store.getState();
    // Strip non-serializable fields (functions, Maps, Sets)
    return JSON.parse(
      JSON.stringify(state, (_k, v) => {
        if (typeof v === 'function') return undefined;
        if (v instanceof Map) return Array.from(v.entries());
        if (v instanceof Set) return Array.from(v.values());
        return v;
      }),
    );
  }, key);
};

export const dispatchStore = async (
  storeId: StoreId,
  action: string,
  payload?: unknown,
): Promise<{ ok: boolean; reason?: string }> => {
  const allowed = STORE_DISPATCH_ALLOWLIST[storeId];
  if (!allowed || !allowed.includes(action)) {
    return { ok: false, reason: `dispatch '${storeId}.${action}' not allowed (see STORE_DISPATCH_ALLOWLIST)` };
  }
  const page = await getPage();
  const key = STORE_GLOBAL_KEYS[storeId];
  const result = await page.evaluate(
    ({ globalKey, act, args }) => {
      const w = window as unknown as Record<string, { getState: () => Record<string, (...a: unknown[]) => unknown> } | undefined>;
      const store = w[globalKey];
      if (!store) return { ok: false, reason: `store '${globalKey}' not exposed` };
      const state = store.getState();
      const fn = state[act];
      if (typeof fn !== 'function') return { ok: false, reason: `action '${act}' not found on store` };
      const argArray = Array.isArray(args) ? args : args === undefined ? [] : [args];
      fn.apply(state, argArray);
      return { ok: true };
    },
    { globalKey: key, act: action, args: payload },
  );
  return result;
};
