import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { backendEnvironment, embeddedDataLayout } from '../bootstrap';
import type { EmbeddedResources } from '../resources';

const resources: EmbeddedResources = {
  backendEntry: '/res/backend/index.js',
  backendModulesDir: '/res/backend/node_modules',
  migrationsDir: '/res/backend/migrations',
  builtinStrategiesDir: '/res/backend/strategies/builtin',
  rendererDir: '/res/renderer',
  postgresBinDir: '/res/postgres/bin',
};

describe('embedded data layout', () => {
  it('keeps everything under the user data folder', () => {
    const layout = embeddedDataLayout('/Users/me/Library/Application Support/MarketMind');
    expect(layout.dataDir).toBe(path.join('/Users/me/Library/Application Support/MarketMind', 'data'));
    expect(layout.postgresDir).toBe(path.join(layout.dataDir, 'postgres'));
    expect(layout.logsDir).toBe(path.join(layout.dataDir, 'logs'));
    expect(layout.userStrategiesDir).toBe(path.join(layout.dataDir, 'strategies', 'user'));
    expect(layout.secretsFile).toBe(path.join('/Users/me/Library/Application Support/MarketMind', 'secrets.json'));
  });
});

describe('backendEnvironment', () => {
  it('binds the backend to the loopback interface with migrations, renderer and paths configured', () => {
    const env = backendEnvironment({
      resources,
      layout: embeddedDataLayout('/userData'),
      databaseUrl: 'postgresql://marketmind:pw@127.0.0.1:54329/marketmind',
      port: 43111,
      appVersion: '1.28.0',
      encryptionKey: 'k'.repeat(64),
      sessionSecret: 's'.repeat(32),
    });
    expect(env).toMatchObject({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '43111',
      CORS_ORIGIN: 'http://127.0.0.1:43111',
      APP_URL: 'http://127.0.0.1:43111',
      COOKIE_SECURE: 'false',
      MM_EMBEDDED: 'true',
      MM_RUN_MIGRATIONS: 'true',
      MM_RENDERER_DIR: '/res/renderer',
      MM_MIGRATIONS_DIR: '/res/backend/migrations',
      MM_STRATEGIES_DIR: '/res/backend/strategies/builtin',
      MM_USER_STRATEGIES_DIR: path.join('/userData', 'data', 'strategies', 'user'),
      MM_DATA_DIR: path.join('/userData', 'data'),
      npm_package_version: '1.28.0',
    });
    expect(env['DATABASE_URL']).toBe('postgresql://marketmind:pw@127.0.0.1:54329/marketmind');
    expect(Object.keys(env)).not.toContain('VITE_DEV_SERVER_URL');
  });
});
