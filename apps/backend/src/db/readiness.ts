import { sql } from 'drizzle-orm';
import { STARTUP_CONFIG } from '../constants';
import { env } from '../env';
import { logger } from '../services/logger';
import { db } from './client';

const DEFAULT_POSTGRES_PORT = '5432';
const DATABASE_START_HINT = 'Start it with `docker compose up -d postgres` (`pnpm dev` does this automatically).';

interface DatabaseReadinessOptions {
  attempts?: number;
  retryMs?: number;
}

export const describeDatabaseTarget = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port || DEFAULT_POSTGRES_PORT}${url.pathname}`;
};

export class DatabaseUnreachableError extends Error {
  readonly lastError: unknown;

  constructor(target: string, attempts: number, lastError: unknown) {
    super(`PostgreSQL is not reachable at ${target} after ${attempts} attempts. ${DATABASE_START_HINT}`);
    this.name = 'DatabaseUnreachableError';
    this.lastError = lastError;
  }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const assertDatabaseReachable = async (options: DatabaseReadinessOptions = {}): Promise<void> => {
  const attempts = options.attempts ?? STARTUP_CONFIG.DATABASE_READY_ATTEMPTS;
  const retryMs = options.retryMs ?? STARTUP_CONFIG.DATABASE_READY_RETRY_MS;
  const target = describeDatabaseTarget(env.DATABASE_URL);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await db.execute(sql`select 1`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      logger.warn({ target, attempt, attempts }, 'PostgreSQL not reachable yet, retrying');
      await wait(retryMs);
    }
  }

  throw new DatabaseUnreachableError(target, attempts, lastError);
};
