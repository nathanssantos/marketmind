import pg from 'pg';

const ADMIN_DATABASE = 'postgres';

export const quoteIdentifier = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

export const databaseNameFromUrl = (databaseUrl: string): string => {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!name) throw new Error('DATABASE_URL has no database name');
  return name;
};

export const adminDatabaseUrl = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  url.pathname = `/${ADMIN_DATABASE}`;
  return url.toString();
};

export const ensureDatabaseExists = async (databaseUrl: string, clientFactory: (connectionString: string) => pg.Client = (connectionString) => new pg.Client({ connectionString })): Promise<boolean> => {
  const database = databaseNameFromUrl(databaseUrl);
  const client = clientFactory(adminDatabaseUrl(databaseUrl));
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if ((existing.rowCount ?? 0) > 0) return false;
    await client.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
    return true;
  } finally {
    await client.end();
  }
};
