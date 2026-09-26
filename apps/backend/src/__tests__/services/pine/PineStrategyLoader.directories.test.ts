import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PineStrategyLoader } from '../../../services/pine/PineStrategyLoader';

const STRATEGY_SOURCE = `//@version=5
// @id user-breakout
// @name User breakout
indicator("User breakout")
plot(close, "signal")
`;

describe('PineStrategyLoader with several directories', () => {
  let userDir: string;

  beforeAll(() => {
    userDir = mkdtempSync(path.join(tmpdir(), 'mm-user-strategies-'));
    writeFileSync(path.join(userDir, 'user-breakout.pine'), STRATEGY_SOURCE);
  });

  afterAll(() => {
    rmSync(userDir, { recursive: true, force: true });
  });

  it('skips a directory that does not exist and loads the others', async () => {
    const loader = new PineStrategyLoader([path.join(userDir, 'missing'), userDir]);

    const strategies = await loader.loadAll();

    expect(strategies.map((strategy) => strategy.metadata.id)).toEqual(['user-breakout']);
  });

  it('still fails on directories that cannot be read for other reasons', async () => {
    const notADirectory = path.join(userDir, 'user-breakout.pine');
    const loader = new PineStrategyLoader([notADirectory]);

    await expect(loader.loadAll()).rejects.toThrow();
  });
});
