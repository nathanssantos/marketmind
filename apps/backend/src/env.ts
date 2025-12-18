import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().length(64),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default('http://localhost:5174'),
  ENABLE_LIVE_TRADING: z.string().default('false').transform(v => v === 'true'),
  MARKET_CONTEXT_FILTER_ENABLED: z.string().default('false').transform(v => v === 'true'),
});

export const env = envSchema.parse(process.env);
