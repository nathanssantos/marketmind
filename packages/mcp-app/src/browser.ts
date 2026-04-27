import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const DEFAULT_BASE_URL = process.env.MM_MCP_BASE_URL ?? 'http://localhost:5174';
const RESTART_AFTER_DISPATCHES = 200;
const IDLE_RESTART_MS = 30 * 60 * 1000;

interface BrowserHandle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  dispatchesSinceRestart: number;
  lastUsedAt: number;
}

let handle: BrowserHandle | null = null;

const shouldRestart = (h: BrowserHandle): boolean =>
  h.dispatchesSinceRestart >= RESTART_AFTER_DISPATCHES ||
  Date.now() - h.lastUsedAt > IDLE_RESTART_MS;

const launch = async (): Promise<BrowserHandle> => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => typeof (window as { __globalActions?: unknown }).__globalActions !== 'undefined',
    { timeout: 30_000 },
  );
  return {
    browser,
    context,
    page,
    dispatchesSinceRestart: 0,
    lastUsedAt: Date.now(),
  };
};

const teardown = async (h: BrowserHandle): Promise<void> => {
  try { await h.context.close(); } catch { /* swallow */ }
  try { await h.browser.close(); } catch { /* swallow */ }
};

export const getPage = async (): Promise<Page> => {
  if (handle && shouldRestart(handle)) {
    const old = handle;
    handle = null;
    await teardown(old);
  }
  if (!handle) {
    handle = await launch();
  }
  handle.lastUsedAt = Date.now();
  handle.dispatchesSinceRestart += 1;
  return handle.page;
};

export const closeBrowser = async (): Promise<void> => {
  if (handle) {
    await teardown(handle);
    handle = null;
  }
};

export const setTheme = async (theme: 'light' | 'dark'): Promise<void> => {
  const page = await getPage();
  await page.evaluate((t) => {
    const w = window as Window & { __setColorMode?: (mode: 'light' | 'dark') => void };
    if (w.__setColorMode) {
      w.__setColorMode(t);
      return;
    }
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(t);
    html.dataset.theme = t;
  }, theme);
  await page.waitForTimeout(150);
};

export const getBaseUrl = (): string => DEFAULT_BASE_URL;
