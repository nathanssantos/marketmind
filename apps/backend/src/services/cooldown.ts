import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db';
import type { TradeCooldown } from '../db/schema';
import { tradeCooldowns } from '../db/schema';
import { logger } from './logger';

export class CooldownService {
  async setCooldown(
    strategyId: string,
    symbol: string,
    interval: string,
    walletId: string,
    executionId: string,
    cooldownMinutes: number,
    reason?: string
  ): Promise<TradeCooldown> {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

    const existing = await db.query.tradeCooldowns.findFirst({
      where: and(
        eq(tradeCooldowns.strategyId, strategyId),
        eq(tradeCooldowns.symbol, symbol),
        eq(tradeCooldowns.interval, interval),
        eq(tradeCooldowns.walletId, walletId)
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(tradeCooldowns)
        .set({
          lastExecutionId: executionId,
          lastExecutionAt: now,
          cooldownUntil,
          cooldownMinutes,
          reason,
        })
        .where(eq(tradeCooldowns.id, existing.id))
        .returning();

      return updated!;
    }

    const [created] = await db
      .insert(tradeCooldowns)
      .values({
        strategyId,
        symbol,
        interval,
        walletId,
        lastExecutionId: executionId,
        lastExecutionAt: now,
        cooldownUntil,
        cooldownMinutes,
        reason,
      })
      .returning();

    return created!;
  }

  async checkCooldown(
    strategyId: string,
    symbol: string,
    interval: string,
    walletId: string
  ): Promise<{ inCooldown: boolean; cooldownUntil?: Date; reason?: string }> {
    try {
      const cooldown = await db.query.tradeCooldowns.findFirst({
        where: and(
          eq(tradeCooldowns.strategyId, strategyId),
          eq(tradeCooldowns.symbol, symbol),
          eq(tradeCooldowns.interval, interval),
          eq(tradeCooldowns.walletId, walletId)
        ),
      });

      if (!cooldown) {
        return { inCooldown: false };
      }

      const now = new Date();
      if (now < cooldown.cooldownUntil) {
        return {
          inCooldown: true,
          cooldownUntil: cooldown.cooldownUntil,
          reason: cooldown.reason ?? undefined,
        };
      }

      await db
        .delete(tradeCooldowns)
        .where(eq(tradeCooldowns.id, cooldown.id));

      return { inCooldown: false };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        strategyId,
        symbol,
        interval,
        walletId,
      }, 'Failed to check cooldown');
      return { inCooldown: false };
    }
  }

  async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();
      const deleted = await db
        .delete(tradeCooldowns)
        .where(lt(tradeCooldowns.cooldownUntil, now));

      const count = deleted.rowCount ?? 0;
      
      if (count > 0) {
        logger.info({ count }, 'Cleaned up expired cooldowns');
      }

      return count;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to cleanup expired cooldowns');
      return 0;
    }
  }

  startCleanupScheduler(intervalMinutes: number = 60): ReturnType<typeof setInterval> {
    const cleanup = (): void => {
      void this.cleanupExpired();
    };

    void this.cleanupExpired();

    return setInterval(cleanup, intervalMinutes * 60 * 1000);
  }
}

export const cooldownService = new CooldownService();
