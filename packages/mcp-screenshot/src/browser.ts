import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { installVisualFixtures } from './trpcMock.js';

const DEFAULT_BASE_URL = process.env.MM_MCP_BASE_URL ?? 'http://localhost:5174';
const RESTART_AFTER_CAPTURES = 50;
const IDLE_RESTART_MS = 30 * 60 * 1000;
const FIXTURES_ENABLED = process.env.MM_MCP_FIXTURES !== 'false';

// Default to 1920×1080 with DPR 2 → 3840×2160 (4K) screenshots, suitable for
// marketing / docs use. Override via MM_MCP_VIEWPORT (e.g. "2560x1440") and
// MM_MCP_SCALE (DPR). For visual-diff tests, set MM_MCP_VIEWPORT=1440x900
// MM_MCP_SCALE=1 to keep file sizes/test deltas stable.
const DEVICE_SCALE_FACTOR = Number.parseFloat(process.env.MM_MCP_SCALE ?? '2');
const parseViewport = (raw: string | undefined): { width: number; height: number } => {
  if (!raw) return { width: 1920, height: 1080 };
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 1920, height: 1080 };
  return { width: Number(m[1]), height: Number(m[2]) };
};
const VIEWPORT = parseViewport(process.env.MM_MCP_VIEWPORT);

interface BrowserHandle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  capturesSinceRestart: number;
  lastUsedAt: number;
}

let handle: BrowserHandle | null = null;

const shouldRestart = (h: BrowserHandle): boolean =>
  h.capturesSinceRestart >= RESTART_AFTER_CAPTURES ||
  Date.now() - h.lastUsedAt > IDLE_RESTART_MS;

const launch = async (): Promise<BrowserHandle> => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  if (FIXTURES_ENABLED) {
    await installVisualFixtures(context);
  }
  // Disable CSS animations + transitions globally so dialog enter/exit
  // animations don't end up captured mid-frame (transparent backdrop,
  // half-slid sheet, etc.) — sources of false-positive visual diffs.
  // addInitScript runs before any page script, so the rule beats Chakra's
  // own keyframes the first time they'd play.
  await context.addInitScript(() => {
    const apply = () => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    };
    if (document.head) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  });
  const page = await context.newPage();
  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof (window as { __globalActions?: unknown }).__globalActions !== 'undefined', { timeout: 30_000 });
  return {
    browser,
    context,
    page,
    capturesSinceRestart: 0,
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
  handle.capturesSinceRestart += 1;
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
  await page.waitForFunction(
    (t) => document.documentElement.classList.contains(t),
    theme,
    { timeout: 5000 },
  );
  await page.waitForTimeout(400);
};
