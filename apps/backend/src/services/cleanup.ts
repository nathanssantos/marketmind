import { createLogger } from '@marketmind/logger';
import { cleanupExpiredTokensAndSessions } from './auth';

const logger = createLogger('cleanup-service');

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const startCleanupScheduler = () => {
  const interval = setInterval(() => {
    void (async () => {
      try {
        await cleanupExpiredTokensAndSessions();
        logger.debug('Expired tokens and sessions cleaned up');
      } catch (err) {
        logger.error('Failed to cleanup expired tokens', { err: String(err) });
      }
    })();
  }, CLEANUP_INTERVAL_MS);

  interval.unref();
  return interval;
};
