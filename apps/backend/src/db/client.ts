import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import { logger } from '../services/logger';
import * as schema from './schema';

const { Pool } = pg;

export type DatabaseType = ReturnType<typeof drizzle<typeof schema>>;

let pool: pg.Pool | null = null;
let dbInstance: DatabaseType | null = null;

const getPool = (): pg.Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Unexpected error on idle DB client');
    });
  }
  return pool;
};

const createDb = (): DatabaseType => {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
};

export const db: DatabaseType = new Proxy({} as DatabaseType, {
  get(_, prop) {
    const instance = dbInstance ?? createDb();
    return (instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const setTestDatabase = (testDb: DatabaseType): void => {
  dbInstance = testDb;
};

export const resetDatabase = (): void => {
  dbInstance = null;
};
