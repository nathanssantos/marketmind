import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMock, warnMock } = vi.hoisted(() => ({ executeMock: vi.fn(), warnMock: vi.fn() }));

vi.mock('../../db/client', () => ({
  db: { execute: (...args: unknown[]) => executeMock(...args) },
}));

vi.mock('../../services/logger', () => ({
  logger: { warn: (...args: unknown[]) => warnMock(...args), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../env', () => ({
  env: { DATABASE_URL: 'postgresql://marketmind:s3cret-pw@localhost:5432/marketmind' },
}));

import { DatabaseUnreachableError, assertDatabaseReachable, describeDatabaseTarget } from '../../db/readiness';

describe('assertDatabaseReachable', () => {
  beforeEach(() => {
    executeMock.mockReset();
    warnMock.mockReset();
  });

  it('resolves on the first successful probe without warning', async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });

    await expect(assertDatabaseReachable({ retryMs: 0 })).resolves.toBeUndefined();

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('retries until the database answers', async () => {
    executeMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ rows: [] });

    await assertDatabaseReachable({ attempts: 5, retryMs: 0 });

    expect(executeMock).toHaveBeenCalledTimes(3);
    expect(warnMock).toHaveBeenCalledTimes(2);
  });

  it('fails after the last attempt naming the target and the start hint, never the password', async () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    executeMock.mockRejectedValue(refused);

    const failure = await assertDatabaseReachable({ attempts: 3, retryMs: 0 }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DatabaseUnreachableError);
    const { message, lastError } = failure as DatabaseUnreachableError;
    expect(message).toContain('localhost:5432/marketmind');
    expect(message).toContain('3 attempts');
    expect(message).toContain('docker compose up -d postgres');
    expect(message).not.toContain('s3cret-pw');
    expect(lastError).toBe(refused);
    expect(executeMock).toHaveBeenCalledTimes(3);
  });
});

describe('describeDatabaseTarget', () => {
  it('drops the credentials and defaults the port', () => {
    expect(describeDatabaseTarget('postgresql://user:pw@db.internal/marketmind')).toBe('db.internal:5432/marketmind');
  });
});
