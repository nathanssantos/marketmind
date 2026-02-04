import { desc, eq, gte, and, sql } from 'drizzle-orm';
import { TIME_MS } from '@marketmind/types';
import { INDICATOR_CACHE, INDICATOR_HISTORY } from '../constants';
import { db } from '../db';
import { indicatorHistory } from '../db/schema';
import { KeyedCache } from '../utils/cache';
import { logger } from './logger';

export type IndicatorType = 'ADX' | 'ALTCOIN_SEASON' | 'ORDER_BOOK_IMBALANCE';

export interface IndicatorDataPoint {
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface IndicatorHistoryResult {
  current: number | null;
  history: IndicatorDataPoint[];
  change24h: number | null;
}

export class IndicatorHistoryService {
  private cache = new KeyedCache<IndicatorHistoryResult>(INDICATOR_CACHE.INDICATOR_HISTORY_TTL);
  private saveInterval: NodeJS.Timeout | null = null;
  private isSaving = false;

  async saveIndicatorValue(
    indicatorType: IndicatorType,
    value: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await db.insert(indicatorHistory).values({
        indicatorType,
        value: value.toString(),
        metadata: metadata ? JSON.stringify(metadata) : null,
        recordedAt: new Date(),
      });

      this.cache.delete(indicatorType);

      logger.trace({
        indicatorType,
        value: value.toFixed(2),
      }, '[IndicatorHistory] Value saved');
    } catch (error) {
      logger.error({ error, indicatorType }, '[IndicatorHistory] Failed to save value');
    }
  }

  async getIndicatorHistory(
    indicatorType: IndicatorType,
    days: number = INDICATOR_HISTORY.DEFAULT_DAYS
  ): Promise<IndicatorHistoryResult> {
    const cached = this.cache.get(indicatorType);

    if (cached) return cached;

    const now = Date.now();

    try {
      const cutoffDate = new Date(now - days * TIME_MS.DAY);

      const records = await db
        .select({
          value: indicatorHistory.value,
          metadata: indicatorHistory.metadata,
          recordedAt: indicatorHistory.recordedAt,
        })
        .from(indicatorHistory)
        .where(
          and(
            eq(indicatorHistory.indicatorType, indicatorType),
            gte(indicatorHistory.recordedAt, cutoffDate)
          )
        )
        .orderBy(desc(indicatorHistory.recordedAt))
        .limit(INDICATOR_HISTORY.MAX_RECORDS);

      const history: IndicatorDataPoint[] = records
        .map((r) => ({
          value: parseFloat(r.value),
          timestamp: r.recordedAt.getTime(),
          metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        }))
        .reverse();

      const current = history.length > 0 ? history[history.length - 1]!.value : null;

      let change24h: number | null = null;
      if (history.length > 1) {
        const oneDayAgo = now - TIME_MS.DAY;
        const oldValue = history.find((h) => h.timestamp <= oneDayAgo);
        if (oldValue && current !== null) {
          change24h = current - oldValue.value;
        }
      }

      const result: IndicatorHistoryResult = {
        current,
        history,
        change24h,
      };

      this.cache.set(indicatorType, result);
      return result;
    } catch (error) {
      logger.error({ error, indicatorType }, '[IndicatorHistory] Failed to get history');
      return { current: null, history: [], change24h: null };
    }
  }

  async getLatestValue(indicatorType: IndicatorType): Promise<number | null> {
    try {
      const [record] = await db
        .select({ value: indicatorHistory.value })
        .from(indicatorHistory)
        .where(eq(indicatorHistory.indicatorType, indicatorType))
        .orderBy(desc(indicatorHistory.recordedAt))
        .limit(1);

      return record ? parseFloat(record.value) : null;
    } catch (error) {
      logger.error({ error, indicatorType }, '[IndicatorHistory] Failed to get latest value');
      return null;
    }
  }

  async cleanupOldRecords(retentionDays: number = INDICATOR_HISTORY.RETENTION_DAYS): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * TIME_MS.DAY);

      const result = await db.execute(
        sql`DELETE FROM indicator_history WHERE recorded_at < ${cutoffDate}`
      );

      const deletedCount = (result as { rowCount?: number }).rowCount ?? 0;

      if (deletedCount > 0) {
        logger.info({
          deletedCount,
          cutoffDate: cutoffDate.toISOString(),
        }, '[IndicatorHistory] Old records cleaned up');
      }

      return deletedCount;
    } catch (error) {
      logger.error({ error }, '[IndicatorHistory] Failed to cleanup old records');
      return 0;
    }
  }

  startPeriodicSave(
    getAdxValue: () => Promise<number | null>,
    getAltcoinSeasonValue: () => Promise<{ index: number; metadata: Record<string, unknown> } | null>,
    getOrderBookImbalance: () => Promise<number | null>,
    intervalMs: number = INDICATOR_CACHE.SNAPSHOT_INTERVAL
  ): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    const saveAll = async () => {
      if (this.isSaving) return;
      this.isSaving = true;

      try {
        const adxValue = await getAdxValue();
        if (adxValue !== null) {
          await this.saveIndicatorValue('ADX', adxValue);
        }

        const altSeason = await getAltcoinSeasonValue();
        if (altSeason !== null) {
          await this.saveIndicatorValue('ALTCOIN_SEASON', altSeason.index, altSeason.metadata);
        }

        const imbalance = await getOrderBookImbalance();
        if (imbalance !== null) {
          await this.saveIndicatorValue('ORDER_BOOK_IMBALANCE', imbalance);
        }

        logger.info('[IndicatorHistory] Periodic save completed');
      } catch (error) {
        logger.error({ error }, '[IndicatorHistory] Periodic save failed');
      } finally {
        this.isSaving = false;
      }
    };

    saveAll();

    this.saveInterval = setInterval(saveAll, intervalMs);
    logger.info({ intervalMs }, '[IndicatorHistory] Periodic save started');
  }

  stopPeriodicSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      logger.info('[IndicatorHistory] Periodic save stopped');
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

let indicatorHistoryService: IndicatorHistoryService | null = null;

export const getIndicatorHistoryService = (): IndicatorHistoryService => {
  if (!indicatorHistoryService) {
    indicatorHistoryService = new IndicatorHistoryService();
  }
  return indicatorHistoryService;
};
