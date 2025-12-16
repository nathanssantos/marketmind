import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 50,
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

pool.on('connect', (client) => {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  const waitingCount = pool.waitingCount;
  console.log(`[DB Pool] Connection acquired - Total: ${totalCount}, Idle: ${idleCount}, Waiting: ${waitingCount}`);
});

pool.on('remove', (client) => {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  console.log(`[DB Pool] Connection removed - Total: ${totalCount}, Idle: ${idleCount}`);
});

pool.on('error', (err, client) => {
  console.error('[DB Pool] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });
