import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { adminDatabaseUrl, databaseNameFromUrl, ensureDatabaseExists, quoteIdentifier } from '../../db/bootstrap';

const DATABASE_URL = 'postgresql://marketmind:s3cret%2F@127.0.0.1:54329/marketmind';

const fakeClient = (rowCount: number): pg.Client & { queries: string[] } => {
  const queries: string[] = [];
  return {
    queries,
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(async (text: string) => {
      queries.push(text);
      return { rowCount: text.startsWith('SELECT') ? rowCount : 0, rows: [] };
    }),
  } as unknown as pg.Client & { queries: string[] };
};

describe('database bootstrap', () => {
  it('reads the database name and derives the admin connection', () => {
    expect(databaseNameFromUrl(DATABASE_URL)).toBe('marketmind');
    expect(adminDatabaseUrl(DATABASE_URL)).toBe('postgresql://marketmind:s3cret%2F@127.0.0.1:54329/postgres');
  });

  it('quotes identifiers so a database name cannot inject SQL', () => {
    expect(quoteIdentifier('market"mind')).toBe('"market""mind"');
  });

  it('creates the database when it is missing', async () => {
    const client = fakeClient(0);

    await expect(ensureDatabaseExists(DATABASE_URL, () => client)).resolves.toBe(true);

    expect(client.queries).toEqual(['SELECT 1 FROM pg_database WHERE datname = $1', 'CREATE DATABASE "marketmind"']);
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('leaves an existing database alone', async () => {
    const client = fakeClient(1);

    await expect(ensureDatabaseExists(DATABASE_URL, () => client)).resolves.toBe(false);

    expect(client.queries).toEqual(['SELECT 1 FROM pg_database WHERE datname = $1']);
  });
});
