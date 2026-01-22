import { and, eq, lt, sql } from 'drizzle-orm';
import { createLogger } from '@marketmind/logger';
import { db } from '../db';
import { orders } from '../db/schema';

const log = createLogger('OrderArchiver');

const DEFAULT_ARCHIVE_THRESHOLD_DAYS = 365;
const DEFAULT_BATCH_SIZE = 1000;

export interface ArchiveResult {
  archived: number;
  deleted: number;
  errors: number;
  duration: number;
}

export interface ArchiveOptions {
  thresholdDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}

export const archiveOldOrders = async (options: ArchiveOptions = {}): Promise<ArchiveResult> => {
  const {
    thresholdDays = DEFAULT_ARCHIVE_THRESHOLD_DAYS,
    batchSize = DEFAULT_BATCH_SIZE,
    dryRun = false,
  } = options;

  const startTime = Date.now();
  const threshold = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  log.info('Starting order archive process', { thresholdDays, threshold, dryRun });

  let totalArchived = 0;
  let totalDeleted = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const ordersToArchive = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, 'FILLED'),
            lt(orders.createdAt, threshold)
          )
        )
        .limit(batchSize);

      if (ordersToArchive.length === 0) {
        hasMore = false;
        break;
      }

      if (!dryRun) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            INSERT INTO orders_archive
            SELECT * FROM orders
            WHERE status = 'FILLED'
            AND created_at < ${threshold}
            AND order_id IN (${sql.raw(ordersToArchive.map((o) => o.orderId).join(','))})
            ON CONFLICT (order_id) DO NOTHING
          `);

          await tx
            .delete(orders)
            .where(
              and(
                eq(orders.status, 'FILLED'),
                lt(orders.createdAt, threshold),
                sql`order_id IN (${sql.raw(ordersToArchive.map((o) => o.orderId).join(','))})`
              )
            );

          totalArchived += ordersToArchive.length;
          totalDeleted += ordersToArchive.length;
        });
      } else {
        totalArchived += ordersToArchive.length;
        totalDeleted += ordersToArchive.length;
      }

      log.debug('Archived batch', {
        batchSize: ordersToArchive.length,
        totalArchived,
        dryRun,
      });

      if (ordersToArchive.length < batchSize) {
        hasMore = false;
      }
    } catch (error) {
      totalErrors++;
      log.error('Error archiving batch', { error });

      if (totalErrors >= 3) {
        log.error('Too many errors, stopping archive process');
        break;
      }
    }
  }

  const duration = Date.now() - startTime;

  log.info('Order archive process complete', {
    archived: totalArchived,
    deleted: totalDeleted,
    errors: totalErrors,
    duration,
    dryRun,
  });

  return {
    archived: totalArchived,
    deleted: totalDeleted,
    errors: totalErrors,
    duration,
  };
};

export interface ArchiveStats {
  mainTableCount: number;
  archiveTableCount: number;
  oldestInMain: Date | null;
  newestInArchive: Date | null;
}

export const getArchiveStats = async (): Promise<ArchiveStats> => {
  const [mainCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders);

  const archiveCountResult = await db.execute(sql`
    SELECT count(*)::int as count FROM orders_archive
  `);
  const archiveCountRows = archiveCountResult.rows as { count: number }[];

  const [oldestMain] = await db
    .select({ oldest: sql<Date>`min(created_at)` })
    .from(orders);

  const newestArchiveResult = await db.execute(sql`
    SELECT max(created_at) as newest FROM orders_archive
  `);
  const newestArchiveRows = newestArchiveResult.rows as { newest: Date | null }[];

  return {
    mainTableCount: mainCount?.count ?? 0,
    archiveTableCount: Number(archiveCountRows[0]?.count ?? 0),
    oldestInMain: oldestMain?.oldest ?? null,
    newestInArchive: newestArchiveRows[0]?.newest ?? null,
  };
};

export const getArchivedOrdersCount = async (
  userId?: string,
  walletId?: string
): Promise<number> => {
  let query = sql`SELECT count(*)::int as count FROM orders_archive WHERE 1=1`;

  if (userId) query = sql`${query} AND user_id = ${userId}`;
  if (walletId) query = sql`${query} AND wallet_id = ${walletId}`;

  const result = await db.execute(query);
  const rows = result.rows as { count: number }[];
  return Number(rows[0]?.count ?? 0);
};

export const cleanupOldArchives = async (
  retentionYears: number = 5
): Promise<number> => {
  const threshold = new Date(Date.now() - retentionYears * 365 * 24 * 60 * 60 * 1000);

  log.info('Cleaning up old archives', { retentionYears, threshold });

  const result = await db.execute(sql`
    DELETE FROM orders_archive
    WHERE created_at < ${threshold}
  `);

  const deleted = Number((result as { rowCount?: number }).rowCount ?? 0);

  log.info('Archive cleanup complete', { deleted });

  return deleted;
};

export const refreshDailyPnlView = async (): Promise<void> => {
  log.info('Refreshing daily_pnl materialized view');
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_pnl`);
  log.info('daily_pnl materialized view refreshed');
};

export const orderArchiver = {
  archiveOldOrders,
  getArchiveStats,
  getArchivedOrdersCount,
  cleanupOldArchives,
  refreshDailyPnlView,
};
