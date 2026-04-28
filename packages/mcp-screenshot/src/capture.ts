import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { getPage, setTheme } from './browser.js';
import type { ModalId, SettingsTabId, SidebarId, Theme } from './types.js';
import { MODALS, SETTINGS_TABS, SIDEBARS } from './types.js';

const SCREENSHOT_DIR = process.env.MM_MCP_SCREENSHOT_DIR ?? path.resolve('apps/electron/screenshots');

const sessionTimestamp = (): string => {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
};

const sessionDir = `${SCREENSHOT_DIR}/${sessionTimestamp()}`;

interface CaptureResult {
  label: string;
  path: string;
  theme: Theme;
}

const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
};

const closeAll = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const actions = (window as { __globalActions?: { closeAll?: () => void } }).__globalActions;
    actions?.closeAll?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await page.waitForTimeout(150);
};

const openSettingsTab = async (page: Page, tabId: SettingsTabId): Promise<void> => {
  await page.evaluate((id) => {
    const actions = (window as { __globalActions?: { openSettings?: (tab?: string) => void } }).__globalActions;
    actions?.openSettings?.(id);
  }, tabId);
  await page.waitForTimeout(300);
};

const clickTrigger = async (page: Page, testid: string, settleMs = 400): Promise<void> => {
  await page.locator(`[data-testid="${testid}"]`).first().click({ timeout: 5000 });
  await page.waitForTimeout(settleMs);
};

const openModalById = async (page: Page, modalId: ModalId): Promise<void> => {
  if (modalId === 'settings') {
    await openSettingsTab(page, 'account');
    return;
  }
  if (modalId === 'orders') {
    await toggleSidebar(page, 'trading', true);
  }
  // Flow modals — click triggers from real UI affordances (data-testid)
  if (modalId === 'createWallet') {
    await openSettingsTab(page, 'wallets');
    await clickTrigger(page, 'trigger-create-wallet');
    return;
  }
  if (modalId === 'tradingProfiles' || modalId === 'importProfile') {
    await openSettingsTab(page, 'tradingProfiles');
    if (modalId === 'importProfile') {
      await clickTrigger(page, 'trigger-import-profile');
    }
    return;
  }
  if (modalId === 'addWatcher') {
    await openSettingsTab(page, 'autoTrading');
    await clickTrigger(page, 'trigger-add-watcher');
    return;
  }
  if (modalId === 'startWatchers') {
    await toggleSidebar(page, 'autoTrading', true);
    await clickTrigger(page, 'trigger-start-watchers');
    return;
  }
  await page.evaluate((id) => {
    const w = window as Window & {
      __uiStore?: { getState: () => Record<string, (v?: unknown) => void> };
      __backtestModalStore?: { getState: () => { openBacktest: () => void } };
      __screenerStore?: { getState: () => { setScreenerOpen: (v: boolean) => void } };
    };
    const ui = w.__uiStore?.getState();
    switch (id) {
      case 'orders':
        ui?.setOrdersDialogOpen?.(true);
        break;
      case 'backtest':
        w.__backtestModalStore?.getState().openBacktest();
        break;
      case 'screener':
        w.__screenerStore?.getState().setScreenerOpen(true);
        break;
      case 'analytics':
        ui?.setAnalyticsOpen?.(true);
        break;
    }
  }, modalId);
  await page.waitForTimeout(300);
};

const toggleSidebar = async (page: Page, sidebarId: SidebarId, open: boolean): Promise<void> => {
  await page.evaluate(({ id, value }) => {
    const w = window as Window & {
      __uiStore?: { getState: () => Record<string, unknown> };
      __preferencesStore?: { getState: () => { set: (cat: string, key: string, v: unknown) => void } };
    };
    if (id === 'trading' || id === 'autoTrading') {
      const prefKey = id === 'trading' ? 'tradingSidebarOpen' : 'autoTradingSidebarOpen';
      w.__preferencesStore?.getState().set('ui', prefKey, value);
      return;
    }
    const ui = w.__uiStore?.getState();
    if (!ui) return;
    const setterKey = id === 'market' ? 'setMarketSidebarOpen' : 'setOrderFlowSidebarOpen';
    const setter = ui[setterKey] as ((v: boolean) => void) | undefined;
    setter?.(value);
  }, { id: sidebarId, value: open });
  await page.waitForTimeout(200);
};

const screenshotTo = async (page: Page, label: string, theme: Theme): Promise<CaptureResult> => {
  await ensureDir(sessionDir);
  const filename = `${label}__${theme}.png`;
  const filepath = path.join(sessionDir, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  return { label, path: filepath, theme };
};

export const captureTab = async (tabId: SettingsTabId, theme: Theme = 'dark'): Promise<CaptureResult> => {
  const page = await getPage();
  await setTheme(theme);
  await closeAll(page);
  await openSettingsTab(page, tabId);
  return screenshotTo(page, `settings-${tabId}`, theme);
};

export const captureModal = async (modalId: ModalId, theme: Theme = 'dark'): Promise<CaptureResult> => {
  const page = await getPage();
  await setTheme(theme);
  await closeAll(page);
  await openModalById(page, modalId);
  return screenshotTo(page, `modal-${modalId}`, theme);
};

export const captureSidebar = async (sidebarId: SidebarId, theme: Theme = 'dark'): Promise<CaptureResult> => {
  const page = await getPage();
  await setTheme(theme);
  await closeAll(page);
  await toggleSidebar(page, sidebarId, true);
  const result = await screenshotTo(page, `sidebar-${sidebarId}`, theme);
  await toggleSidebar(page, sidebarId, false);
  return result;
};

export const captureFullPage = async (label: string, theme: Theme = 'dark'): Promise<CaptureResult> => {
  const page = await getPage();
  await setTheme(theme);
  return screenshotTo(page, label, theme);
};

interface GalleryOptions {
  tabs?: 'all' | SettingsTabId[];
  modals?: 'all' | ModalId[];
  sidebars?: 'all' | SidebarId[];
  themes?: Theme[];
}

interface GalleryResult {
  sessionDir: string;
  captures: CaptureResult[];
  galleryHtmlPath: string;
}

const renderGalleryHtml = (captures: CaptureResult[]): string => {
  const byLabel = new Map<string, CaptureResult[]>();
  for (const c of captures) {
    if (!byLabel.has(c.label)) byLabel.set(c.label, []);
    byLabel.get(c.label)!.push(c);
  }
  const cards = [...byLabel.entries()]
    .map(([label, group]) => {
      const imgs = group
        .map(
          (c) =>
            `<figure><figcaption>${c.theme}</figcaption><img src="./${path.basename(c.path)}" alt="${label} ${c.theme}"/></figure>`,
        )
        .join('');
      return `<section><h2>${label}</h2><div class="row">${imgs}</div></section>`;
    })
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>MarketMind screenshot gallery</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#1a1a1a;color:#eee;margin:0;padding:24px}
h1{font-size:18px;margin:0 0 24px}
section{margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #333}
section h2{font-size:14px;margin:0 0 12px;color:#aaa;font-weight:600}
.row{display:flex;gap:16px;flex-wrap:wrap}
figure{margin:0;display:flex;flex-direction:column;gap:8px}
figcaption{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em}
img{max-width:680px;border:1px solid #333;border-radius:4px}
</style></head><body>
<h1>MarketMind screenshot gallery — ${new Date().toISOString()}</h1>
${cards}
</body></html>`;
};

export const captureGallery = async (options: GalleryOptions = {}): Promise<GalleryResult> => {
  const tabs = options.tabs === 'all' ? SETTINGS_TABS : options.tabs ?? [];
  const modals = options.modals === 'all' ? MODALS : options.modals ?? [];
  const sidebars = options.sidebars === 'all' ? SIDEBARS : options.sidebars ?? [];
  const themes = options.themes ?? ['dark', 'light'];

  const captures: CaptureResult[] = [];
  for (const theme of themes) {
    for (const t of tabs) captures.push(await captureTab(t, theme));
    for (const m of modals) captures.push(await captureModal(m, theme));
    for (const s of sidebars) captures.push(await captureSidebar(s, theme));
  }

  const galleryHtml = renderGalleryHtml(captures);
  await ensureDir(sessionDir);
  const galleryHtmlPath = path.join(sessionDir, 'gallery.html');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(galleryHtmlPath, galleryHtml, 'utf8');

  return { sessionDir, captures, galleryHtmlPath };
};
