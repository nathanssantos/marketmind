import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import type { NewStrategyPerformance, StrategyPerformance } from '../db/schema';
import { strategyPerformance, tradeExecutions } from '../db/schema';
import { logger } from './logger';

export class StrategyPerformanceService {
  async updatePerformance(
    executionId: string
  ): Promise<StrategyPerformance | null> {
    try {
      const execution = await db.query.tradeExecutions.findFirst({
        where: eq(tradeExecutions.id, executionId),
      });

      if (!execution?.closedAt || !execution.setupType) {
        return null;
      }

      const { setupType, symbol } = execution;
      const interval = '1h';
      
      const stats = await this.calculateStats(setupType, symbol, interval);
      
      const existingPerf = await db.query.strategyPerformance.findFirst({
        where: and(
          eq(strategyPerformance.strategyId, setupType),
          eq(strategyPerformance.symbol, symbol),
          eq(strategyPerformance.interval, interval)
        ),
      });

      if (existingPerf) {
        const [updated] = await db
          .update(strategyPerformance)
          .set({
            ...stats,
            updatedAt: new Date(),
          })
          .where(eq(strategyPerformance.id, existingPerf.id))
          .returning();

        logger.info({
          strategyId: setupType,
          symbol,
          interval,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
        }, 'Strategy performance updated');

        return updated ?? null;
      }

      const [created] = await db
        .insert(strategyPerformance)
        .values({
          strategyId: setupType,
          symbol,
          interval,
          ...stats,
        })
        .returning();

      logger.info({
        strategyId: setupType,
        symbol,
        interval,
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
      }, 'Strategy performance created');

      return created ?? null;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        executionId,
      }, 'Failed to update strategy performance');
      return null;
    }
  }

  private async calculateStats(
    strategyId: string,
    symbol: string,
    interval: string
  ): Promise<Omit<NewStrategyPerformance, 'strategyId' | 'symbol' | 'interval'>> {
    const results = await db
      .select({
        totalTrades: sql<number>`COUNT(*)`,
        winningTrades: sql<number>`SUM(CASE WHEN ${tradeExecutions.pnlPercent} > 0 THEN 1 ELSE 0 END)`,
        losingTrades: sql<number>`SUM(CASE WHEN ${tradeExecutions.pnlPercent} < 0 THEN 1 ELSE 0 END)`,
        breakevenTrades: sql<number>`SUM(CASE WHEN ${tradeExecutions.pnlPercent} = 0 THEN 1 ELSE 0 END)`,
        totalPnl: sql<number>`SUM(${tradeExecutions.pnl})`,
        totalPnlPercent: sql<number>`SUM(${tradeExecutions.pnlPercent})`,
        avgWin: sql<number>`AVG(CASE WHEN ${tradeExecutions.pnlPercent} > 0 THEN ABS(${tradeExecutions.pnlPercent}) ELSE NULL END)`,
        avgLoss: sql<number>`AVG(CASE WHEN ${tradeExecutions.pnlPercent} < 0 THEN ABS(${tradeExecutions.pnlPercent}) ELSE NULL END)`,
        lastTradeAt: sql<Date>`MAX(${tradeExecutions.closedAt})`,
      })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.setupType, strategyId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'closed')
        )
      );

    const stats = results[0];
    if (!stats) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakevenTrades: 0,
        winRate: '0',
        totalPnl: '0',
        totalPnlPercent: '0',
        avgWin: '0',
        avgLoss: '0',
        avgRr: '0',
        maxDrawdown: '0',
        maxConsecutiveLosses: 0,
        currentConsecutiveLosses: 0,
        avgSlippagePercent: '0',
        avgExecutionTimeMs: 0,
        lastTradeAt: null,
      };
    }

    const totalPnl = Number(stats.totalPnl) || 0;
    const totalPnlPercent = Number(stats.totalPnlPercent) || 0;
    const avgWin = Number(stats.avgWin) || 0;
    const avgLoss = Number(stats.avgLoss) || 0;

    const winRate = stats.totalTrades > 0
      ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(2)
      : '0';

    const avgRr = avgLoss > 0
      ? (avgWin / avgLoss).toFixed(4)
      : '0';

    const consecutiveLosses = await this.calculateConsecutiveLosses(
      strategyId,
      symbol,
      interval
    );

    return {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      breakevenTrades: stats.breakevenTrades,
      winRate,
      totalPnl: totalPnl.toFixed(8),
      totalPnlPercent: totalPnlPercent.toFixed(4),
      avgWin: avgWin.toFixed(4),
      avgLoss: avgLoss.toFixed(4),
      avgRr,
      maxDrawdown: '0',
      maxConsecutiveLosses: consecutiveLosses.max,
      currentConsecutiveLosses: consecutiveLosses.current,
      avgSlippagePercent: '0',
      avgExecutionTimeMs: 0,
      lastTradeAt: stats.lastTradeAt,
    };
  }

  private async calculateConsecutiveLosses(
    strategyId: string,
    symbol: string,
    _interval: string
  ): Promise<{ max: number; current: number }> {
    const trades = await db.query.tradeExecutions.findMany({
      where: and(
        eq(tradeExecutions.setupType, strategyId),
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.status, 'closed')
      ),
      orderBy: sql`${tradeExecutions.closedAt} DESC`,
      limit: 100,
    });

    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let tempConsecutive = 0;

    for (const trade of trades) {
      const pnl = parseFloat(trade.pnlPercent ?? '0');
      
      if (pnl < 0) {
        tempConsecutive++;
        if (currentConsecutive === 0) {
          currentConsecutive = tempConsecutive;
        }
      } else {
        if (tempConsecutive > maxConsecutive) {
          maxConsecutive = tempConsecutive;
        }
        tempConsecutive = 0;
        currentConsecutive = 0;
      }
    }

    if (tempConsecutive > maxConsecutive) {
      maxConsecutive = tempConsecutive;
    }

    return {
      max: maxConsecutive,
      current: currentConsecutive,
    };
  }

  async getPerformance(
    strategyId: string,
    symbol: string,
    interval: string
  ): Promise<StrategyPerformance | null> {
    try {
      const perf = await db.query.strategyPerformance.findFirst({
        where: and(
          eq(strategyPerformance.strategyId, strategyId),
          eq(strategyPerformance.symbol, symbol),
          eq(strategyPerformance.interval, interval)
        ),
      });

      return perf ?? null;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        strategyId,
        symbol,
        interval,
      }, 'Failed to get strategy performance');
      return null;
    }
  }

  async getAllPerformance(): Promise<StrategyPerformance[]> {
    try {
      return await db.query.strategyPerformance.findMany({
        orderBy: sql`${strategyPerformance.winRate} DESC`,
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to get all strategy performance');
      return [];
    }
  }
}

export const strategyPerformanceService = new StrategyPerformanceService();
