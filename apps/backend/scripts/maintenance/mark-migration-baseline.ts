import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';
import { env } from '../../src/env';
import { MIGRATIONS_DIR } from '../../src/utils/runtime-dirs';

const MIGRATIONS_TABLE = '"drizzle"."__drizzle_migrations"';

const main = async (): Promise<void> => {
  const [baseline] = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR });
  if (!baseline) throw new Error(`No migration found in ${MIGRATIONS_DIR}`);

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    const existing = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${MIGRATIONS_TABLE} WHERE hash = $1`,
      [baseline.hash],
    );
    if (existing.rows[0]?.count !== '0') {
      console.log(`Baseline ${baseline.folderMillis} is already recorded as applied.`);
      return;
    }
    await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ($1, $2)`, [
      baseline.hash,
      baseline.folderMillis,
    ]);
    console.log(`Recorded baseline ${baseline.folderMillis} as applied. Future migrations run with pnpm db:migrate.`);
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
