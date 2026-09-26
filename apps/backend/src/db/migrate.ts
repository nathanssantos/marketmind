import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { MIGRATIONS_DIR } from '../utils/runtime-dirs';
import { db } from './client';

export const runMigrations = async (migrationsFolder: string = MIGRATIONS_DIR): Promise<void> => {
  await migrate(db, { migrationsFolder });
};
