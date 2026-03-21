import { colorize } from '@marketmind/logger';
import { logger } from '../../services/logger';

export const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Auto-Trading] ${message}`);
  } else {
    logger.info(`[Auto-Trading] ${message}`);
  }
};

export const logApiTable = (endpoint: string, rows: [string, string | number][]): void => {
  const fields = rows.map(([key, value]) => `${key}=${value}`).join(' · ');
  console.log(`  > ${colorize(endpoint, 'cyan')} · ${colorize(fields, 'dim')}`);
};
