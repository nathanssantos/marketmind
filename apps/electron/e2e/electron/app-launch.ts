import { _electron, type BrowserContext, type ElectronApplication, type Page } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ELECTRON_ROOT = resolve(HERE, '../..');
const MAIN_ENTRY = resolve(ELECTRON_ROOT, 'dist-electron/main/index.js');
const WEB_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173);
const DEV_SERVER_URL = `http://localhost:${WEB_PORT}`;

export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  devServerUrl: string;
}

interface LaunchAppOptions {
  /**
   * Optional callback to wire up the BrowserContext (e.g. install
   * addInitScript-based mocks) before the renderer's first reload.
   * The renderer always makes one initial pass with no mocks (since
   * Electron's main process calls `BrowserWindow.loadURL` synchronously);
   * the test should `reload()` after launch to apply the wired scripts.
   */
  setupContext?: (context: BrowserContext) => Promise<void>;
}

export const launchApp = async (options: LaunchAppOptions = {}): Promise<LaunchedApp> => {
  const app = await _electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      VITE_E2E_BYPASS_AUTH: 'true',
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
      NODE_ENV: 'test',
    },
  });

  if (options.setupContext) {
    await options.setupContext(app.context());
  }

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window, devServerUrl: DEV_SERVER_URL };
};

export const closeApp = async ({ app }: LaunchedApp): Promise<void> => {
  await app.close();
};
