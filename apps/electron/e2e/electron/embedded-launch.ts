import { _electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_ENTRY = resolve(HERE, '../../dist-electron/main/index.js');
const EMBEDDED_ORIGIN_PREFIX = 'http://127.0.0.1:';

export const EMBEDDED_BOOT_TIMEOUT_MS = 120_000;

const environmentWithoutDevServer = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env['VITE_DEV_SERVER_URL'];
  delete env['MM_BACKEND_URL'];
  return env;
};

export const createUserDataDir = (): string => mkdtempSync(join(tmpdir(), 'marketmind e2e-'));

export const removeUserDataDir = (userDataDir: string): void => rmSync(userDataDir, { recursive: true, force: true });

export const launchEmbeddedApp = (userDataDir: string): Promise<ElectronApplication> =>
  _electron.launch({
    args: [MAIN_ENTRY],
    env: { ...environmentWithoutDevServer(), MM_USER_DATA_DIR: userDataDir },
    timeout: EMBEDDED_BOOT_TIMEOUT_MS,
  });

export const waitForRendererWindow = async (app: ElectronApplication): Promise<Page> => {
  const deadline = Date.now() + EMBEDDED_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const page = app.windows().find((candidate) => candidate.url().startsWith(EMBEDDED_ORIGIN_PREFIX));
    if (page) return page;
    await app.waitForEvent('window', { timeout: deadline - Date.now() });
  }
  throw new Error('The renderer window served by the embedded backend never appeared');
};
