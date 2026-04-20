import { _electron, type ElectronApplication, type Page } from '@playwright/test';
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
}

export const launchApp = async (): Promise<LaunchedApp> => {
  const app = await _electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      VITE_E2E_BYPASS_AUTH: 'true',
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
      NODE_ENV: 'test',
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
};

export const closeApp = async ({ app }: LaunchedApp): Promise<void> => {
  await app.close();
};
