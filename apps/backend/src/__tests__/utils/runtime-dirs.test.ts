import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/marketmind_test',
  ENCRYPTION_KEY: 'a'.repeat(64),
  SESSION_SECRET: 'b'.repeat(32),
};

const loadRuntimeDirs = async (): Promise<typeof import('../../utils/runtime-dirs')> => {
  vi.resetModules();
  return import('../../utils/runtime-dirs');
};

describe('runtime dirs', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(REQUIRED_ENV)) vi.stubEnv(key, value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps every directory under the backend root when no override is set', async () => {
    const dirs = await loadRuntimeDirs();

    expect(dirs.LOGS_DIR.endsWith(path.join('apps', 'backend', 'logs'))).toBe(true);
    expect(dirs.OUTPUT_DIR.endsWith(path.join('apps', 'backend', 'output'))).toBe(true);
    expect(dirs.BUILTIN_STRATEGIES_DIR.endsWith(path.join('strategies', 'builtin'))).toBe(true);
    expect(dirs.USER_STRATEGIES_DIR.endsWith(path.join('strategies', 'user'))).toBe(true);
    expect(dirs.MIGRATIONS_DIR.endsWith(path.join('src', 'db', 'migrations'))).toBe(true);
    expect(dirs.STRATEGY_DIRS).toEqual([dirs.BUILTIN_STRATEGIES_DIR, dirs.USER_STRATEGIES_DIR]);
  });

  it('moves logs and output under MM_DATA_DIR', async () => {
    vi.stubEnv('MM_DATA_DIR', '/var/marketmind');

    const dirs = await loadRuntimeDirs();

    expect(dirs.LOGS_DIR).toBe(path.join('/var/marketmind', 'logs'));
    expect(dirs.OUTPUT_DIR).toBe(path.join('/var/marketmind', 'output'));
  });

  it('takes the strategies and migrations folders from the MM_* overrides', async () => {
    vi.stubEnv('MM_STRATEGIES_DIR', '/bundle/strategies/builtin');
    vi.stubEnv('MM_USER_STRATEGIES_DIR', '/data/strategies/user');
    vi.stubEnv('MM_MIGRATIONS_DIR', '/bundle/migrations');

    const dirs = await loadRuntimeDirs();

    expect(dirs.STRATEGY_DIRS).toEqual(['/bundle/strategies/builtin', '/data/strategies/user']);
    expect(dirs.MIGRATIONS_DIR).toBe('/bundle/migrations');
  });
});
