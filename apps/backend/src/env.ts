import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().length(64),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default('http://localhost:5174'),
  ENABLE_LIVE_TRADING: z.string().default('false').transform(v => v === 'true'),
  RESEND_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:5174'),
  DEMO_MODE: z.string().default('false').transform(v => v === 'true'),
  HOST: z.string().default('0.0.0.0'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  MM_EMBEDDED: z.string().default('false').transform(v => v === 'true'),
  MM_RUN_MIGRATIONS: z.string().default('false').transform(v => v === 'true'),
  MM_DATA_DIR: z.string().optional(),
  MM_STRATEGIES_DIR: z.string().optional(),
  MM_USER_STRATEGIES_DIR: z.string().optional(),
  MM_MIGRATIONS_DIR: z.string().optional(),
  MM_RENDERER_DIR: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE === undefined ? parsed.NODE_ENV === 'production' : parsed.COOKIE_SECURE === 'true',
};
