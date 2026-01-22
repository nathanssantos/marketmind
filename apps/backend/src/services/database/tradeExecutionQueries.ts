import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';

export type TradeExecutionRecord = typeof tradeExecutions.$inferSelect;
export type TradeExecutionStatus = 'pending' | 'open' | 'closed' | 'cancelled';

export interface TradeExecutionQueryOptions {
  throwIfNotFound?: boolean;
  errorMessage?: string;
}

const DEFAULT_OPTIONS: TradeExecutionQueryOptions = {
  throwIfNotFound: true,
  errorMessage: 'Trade execution not found',
};

export interface ListTradeExecutionsParams {
  walletId: string;
  userId: string;
  symbol?: string;
  status?: TradeExecutionStatus;
  limit?: number;
  offset?: number;
}

export interface ListClosedTradesParams {
  walletId: string;
  userId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export const tradeExecutionQueries = {
  async findById(
    id: string,
    options: TradeExecutionQueryOptions = { throwIfNotFound: false }
  ): Promise<TradeExecutionRecord | null> {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.id, id))
      .limit(1);

    if (!execution && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Trade execution not found',
      });
    }

    return execution ?? null;
  },

  async findByIdAndUser(
    id: string,
    userId: string,
    options: TradeExecutionQueryOptions = DEFAULT_OPTIONS
  ): Promise<TradeExecutionRecord | null> {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(and(eq(tradeExecutions.id, id), eq(tradeExecutions.userId, userId)))
      .limit(1);

    if (!execution && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Trade execution not found',
      });
    }

    return execution ?? null;
  },

  async getByIdAndUser(id: string, userId: string): Promise<TradeExecutionRecord> {
    const execution = await this.findByIdAndUser(id, userId, { throwIfNotFound: true });
    return execution!;
  },

  async listByWallet(params: ListTradeExecutionsParams): Promise<TradeExecutionRecord[]> {
    const conditions = [
      eq(tradeExecutions.walletId, params.walletId),
      eq(tradeExecutions.userId, params.userId),
    ];

    if (params.symbol) {
      conditions.push(eq(tradeExecutions.symbol, params.symbol));
    }

    if (params.status) {
      conditions.push(eq(tradeExecutions.status, params.status));
    }

    return db
      .select()
      .from(tradeExecutions)
      .where(and(...conditions))
      .orderBy(desc(tradeExecutions.openedAt))
      .limit(params.limit ?? 100)
      .offset(params.offset ?? 0);
  },

  async listOpenByWallet(walletId: string, userId: string): Promise<TradeExecutionRecord[]> {
    return db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.userId, userId),
          inArray(tradeExecutions.status, ['open', 'pending'])
        )
      )
      .orderBy(desc(tradeExecutions.openedAt));
  },

  async listClosedByWallet(params: ListClosedTradesParams): Promise<TradeExecutionRecord[]> {
    const conditions = [
      eq(tradeExecutions.walletId, params.walletId),
      eq(tradeExecutions.userId, params.userId),
      eq(tradeExecutions.status, 'closed'),
    ];

    if (params.startDate) {
      conditions.push(gte(tradeExecutions.closedAt, params.startDate));
    }

    if (params.endDate) {
      conditions.push(sql`${tradeExecutions.closedAt} <= ${params.endDate}`);
    }

    return db
      .select()
      .from(tradeExecutions)
      .where(and(...conditions))
      .orderBy(desc(tradeExecutions.closedAt))
      .limit(params.limit ?? 1000);
  },

  async countByWallet(walletId: string, userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.userId, userId)
        )
      );

    return result?.count ?? 0;
  },

  async findOpenBySymbol(
    walletId: string,
    symbol: string
  ): Promise<TradeExecutionRecord | null> {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          inArray(tradeExecutions.status, ['open', 'pending'])
        )
      )
      .limit(1);

    return execution ?? null;
  },

  async updateStatus(
    id: string,
    status: TradeExecutionStatus,
    additionalFields: Partial<typeof tradeExecutions.$inferInsert> = {}
  ): Promise<TradeExecutionRecord> {
    const [updated] = await db
      .update(tradeExecutions)
      .set({ status, ...additionalFields })
      .where(eq(tradeExecutions.id, id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Trade execution not found',
      });
    }

    return updated;
  },
};

export const getTradeExecution = tradeExecutionQueries.getByIdAndUser.bind(tradeExecutionQueries);
export const findTradeExecution = tradeExecutionQueries.findByIdAndUser.bind(tradeExecutionQueries);
export const listOpenTrades = tradeExecutionQueries.listOpenByWallet.bind(tradeExecutionQueries);
