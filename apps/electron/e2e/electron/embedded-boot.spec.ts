import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_ENTRY = resolve(HERE, '../../dist-electron/main/index.js');
const BOOT_TIMEOUT_MS = 120_000;

const environmentWithoutDevServer = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env['VITE_DEV_SERVER_URL'];
  delete env['MM_BACKEND_URL'];
  return env;
};

const waitForRendererWindow = async (app: ElectronApplication): Promise<Page> => {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const page = app.windows().find((candidate) => candidate.url().startsWith('http://127.0.0.1:'));
    if (page) return page;
    await app.waitForEvent('window', { timeout: deadline - Date.now() });
  }
  throw new Error('The renderer window served by the embedded backend never appeared');
};

test.describe('embedded stack', () => {
  let userDataDir: string;
  let app: ElectronApplication;

  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'marketmind e2e-'));
    app = await _electron.launch({
      args: [MAIN_ENTRY],
      env: { ...environmentWithoutDevServer(), MM_USER_DATA_DIR: userDataDir },
      timeout: BOOT_TIMEOUT_MS,
    });
  });

  test.afterAll(async () => {
    await app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  test('boots PostgreSQL and the backend, then serves the login page from the backend origin', async () => {
    test.setTimeout(BOOT_TIMEOUT_MS + 30_000);
    const page = await waitForRendererWindow(app);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 60_000 });
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);

    const health = await page.evaluate(async () => (await fetch('/health')).json() as Promise<{ status: string }>);
    expect(health.status).toBe('ok');

    expect(existsSync(join(userDataDir, 'data', 'postgres', 'PG_VERSION'))).toBe(true);
    expect(existsSync(join(userDataDir, 'secrets.json'))).toBe(true);
  });

  test('stops PostgreSQL when the app closes', async () => {
    await app.close();
    const pidFile = join(userDataDir, 'data', 'postgres', 'postmaster.pid');
    await expect.poll(() => existsSync(pidFile), { timeout: 30_000 }).toBe(false);
    app = await _electron.launch({
      args: [MAIN_ENTRY],
      env: { ...environmentWithoutDevServer(), MM_USER_DATA_DIR: userDataDir },
      timeout: BOOT_TIMEOUT_MS,
    });
    const page = await waitForRendererWindow(app);
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 60_000 });
  });
});
