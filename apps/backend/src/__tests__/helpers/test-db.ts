import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { resetDatabase, setTestDatabase, type DatabaseType } from '../../db/client';
import * as schema from '../../db/schema';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

let testDb: TestDatabase | null = null;
let tablesCreated = false;

export const setupTestDatabase = async (): Promise<TestDatabase> => {
  if (testDb) return testDb;

  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL not set. Make sure globalSetup is configured in vitest.config.ts'
    );
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
  });

  testDb = drizzle(pool, { schema });

  setTestDatabase(testDb as unknown as DatabaseType);

  if (!tablesCreated) {
    const lockKey = 8273451926;
    await testDb.execute(sql.raw(`SELECT pg_advisory_lock(${lockKey});`));
    try {
      const alreadyReady = await testDb.execute(
        sql.raw(`SELECT to_regclass('public.income_events') IS NOT NULL AS ready;`),
      );
      const ready = (alreadyReady as unknown as { rows?: Array<{ ready: boolean }> }).rows?.[0]?.ready;
      if (!ready) {
        await testDb.execute(sql.raw('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'));
        await migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER });
      }
    } finally {
      await testDb.execute(sql.raw(`SELECT pg_advisory_unlock(${lockKey});`));
    }
    tablesCreated = true;
  }

  return testDb;
};

export const teardownTestDatabase = async (): Promise<void> => {
  resetDatabase();

  if (pool) {
    await pool.end();
    pool = null;
  }
  testDb = null;
};

export const getTestDatabase = (): TestDatabase => {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
};

export const cleanupTables = async (): Promise<void> => {
  const db = getTestDatabase();
  await db.execute(sql`SET session_replication_role = 'replica'`);
  await db.delete(schema.incomeEvents);
  await db.delete(schema.customSymbolComponents);
  await db.delete(schema.customSymbols);
  await db.delete(schema.priceCache);
  await db.delete(schema.klines);
  await db.delete(schema.tradeCooldowns);
  await db.delete(schema.signalSuggestions);
  await db.delete(schema.strategyPerformance);
  await db.delete(schema.tradeExecutions);
  await db.delete(schema.setupDetections);
  await db.delete(schema.tradingSetups);
  await db.delete(schema.positions);
  await db.delete(schema.orders);
  await db.delete(schema.symbolTrailingStopOverrides);
  await db.delete(schema.autoTradingConfig);
  await db.delete(schema.activeWatchers);
  await db.delete(schema.apiKeys);
  await db.delete(schema.mcpTradingAudit);
  await db.delete(schema.userIndicators);
  await db.delete(schema.userPatterns);
  await db.delete(schema.userLayoutsAudit);
  await db.delete(schema.userLayoutsHistory);
  await db.delete(schema.userLayouts);
  await db.delete(schema.backtestRuns);
  await db.delete(schema.userPreferences);
  await db.delete(schema.tradingProfiles);
  await db.delete(schema.twoFactorCodes);
  await db.delete(schema.emailVerificationTokens);
  await db.delete(schema.passwordResetTokens);
  await db.delete(schema.sessions);
  await db.delete(schema.wallets);
  await db.delete(schema.users);
  await db.execute(sql`SET session_replication_role = 'origin'`);
};
