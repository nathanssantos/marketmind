import { serializeError } from '../utils/errors';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db';
import type { TradeCooldown } from '../db/schema';
import { tradeCooldowns } from '../db/schema';
import { logger } from './logger';

export interface CooldownConfig {
  baseMinutes: number;
  volatilityMultiplier?: number;
  drawdownMultiplier?: number;
  lossStreakMultiplier?: number;
  maxMinutes?: number;
  minMinutes?: number;
}

export interface MarketConditions {
  volatilityLevel: 'low' | 'normal' | 'high' | 'extreme';
  drawdownPercent: number;
  consecutiveLosses: number;
  consecutiveWins: number;
}

const VOLATILITY_COOLDOWN_MULTIPLIERS: Record<string, number> = {
  low: 0.75,
  normal: 1.0,
  high: 1.5,
  extreme: 2.5,
};

const LOSS_STREAK_COOLDOWN_MULTIPLIERS: Record<number, number> = {
  0: 1.0,
  1: 1.0,
  2: 1.25,
  3: 1.5,
  4: 2.0,
  5: 3.0,
};

const DRAWDOWN_COOLDOWN_THRESHOLDS = [
  { threshold: 5, multiplier: 1.0 },
  { threshold: 10, multiplier: 1.5 },
  { threshold: 15, multiplier: 2.0 },
  { threshold: 20, multiplier: 3.0 },
  { threshold: 30, multiplier: 5.0 },
];

export class CooldownService {
  calculateAdaptiveCooldown(
    config: CooldownConfig,
    conditions: MarketConditions
  ): { minutes: number; rationale: string } {
    const {
      baseMinutes,
      volatilityMultiplier = 1.0,
      drawdownMultiplier = 1.0,
      lossStreakMultiplier = 1.0,
      maxMinutes = 1440,
      minMinutes = 5,
    } = config;

    const volMultiplier = VOLATILITY_COOLDOWN_MULTIPLIERS[conditions.volatilityLevel] ?? 1.0;
    const volAdjustment = volMultiplier * volatilityMultiplier;

    let ddMultiplier = 1.0;
    for (const threshold of DRAWDOWN_COOLDOWN_THRESHOLDS) {
      if (conditions.drawdownPercent >= threshold.threshold) {
        ddMultiplier = threshold.multiplier;
      }
    }
    const ddAdjustment = ddMultiplier * drawdownMultiplier;

    const lossKey = Math.min(conditions.consecutiveLosses, 5);
    const lossMultiplier = LOSS_STREAK_COOLDOWN_MULTIPLIERS[lossKey] ?? 1.0;
    const lossAdjustment = lossMultiplier * lossStreakMultiplier;

    let winDiscount = 1.0;
    if (conditions.consecutiveWins >= 3) {
      winDiscount = 0.9;
    } else if (conditions.consecutiveWins >= 5) {
      winDiscount = 0.8;
    }

    const totalMultiplier = volAdjustment * ddAdjustment * lossAdjustment * winDiscount;
    const calculatedMinutes = baseMinutes * totalMultiplier;
    const finalMinutes = Math.max(minMinutes, Math.min(maxMinutes, Math.round(calculatedMinutes)));

    const rationale = [
      `Base: ${baseMinutes}m`,
      `Vol: ${conditions.volatilityLevel} (×${volAdjustment.toFixed(2)})`,
      `DD: ${conditions.drawdownPercent.toFixed(1)}% (×${ddAdjustment.toFixed(2)})`,
      conditions.consecutiveLosses > 0 ? `Losses: ${conditions.consecutiveLosses} (×${lossAdjustment.toFixed(2)})` : null,
      conditions.consecutiveWins >= 3 ? `Wins: ${conditions.consecutiveWins} (×${winDiscount.toFixed(2)})` : null,
      `Final: ${finalMinutes}m`,
    ].filter(Boolean).join(' | ');

    return { minutes: finalMinutes, rationale };
  }

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
        error: serializeError(error),
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
        error: serializeError(error),
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
