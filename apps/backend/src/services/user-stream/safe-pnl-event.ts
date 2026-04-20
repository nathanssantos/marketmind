import type { db as DbType } from '../../db';
import { realizedPnlEvents } from '../../db/schema';
import { logger } from '../logger';

type RealizedPnlEventInsert = typeof realizedPnlEvents.$inferInsert;

export const safeInsertRealizedPnlEvent = async (
  db: typeof DbType,
  values: RealizedPnlEventInsert
): Promise<void> => {
  try {
    await db.insert(realizedPnlEvents).values(values);
  } catch (error) {
    logger.error(
      {
        err: error instanceof Error ? { message: error.message, name: error.name } : error,
        walletId: values.walletId,
        executionId: values.executionId,
        symbol: values.symbol,
        eventType: values.eventType,
        pnl: values.pnl,
      },
      '[realizedPnlEvents] INSERT failed — downstream PnL analytics will miss this event. Continuing so position close flow completes.'
    );
  }
};
