import { and, desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { positions } from '../../db/schema';

export type PositionRecord = typeof positions.$inferSelect;
export type PositionStatus = 'open' | 'closed';
export type PositionSide = 'LONG' | 'SHORT';

export interface PositionQueryOptions {
  throwIfNotFound?: boolean;
  errorMessage?: string;
}

const DEFAULT_OPTIONS: PositionQueryOptions = {
  throwIfNotFound: true,
  errorMessage: 'Position not found',
};

export interface ListPositionsParams {
  walletId: string;
  userId: string;
  symbol?: string;
  status?: PositionStatus;
  limit?: number;
  offset?: number;
}

export const positionQueries = {
  async findById(
    id: string,
    options: PositionQueryOptions = { throwIfNotFound: false }
  ): Promise<PositionRecord | null> {
    const [position] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (!position && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Position not found',
      });
    }

    return position ?? null;
  },

  async findByIdAndUser(
    id: string,
    userId: string,
    options: PositionQueryOptions = DEFAULT_OPTIONS
  ): Promise<PositionRecord | null> {
    const [position] = await db
      .select()
      .from(positions)
      .where(and(eq(positions.id, id), eq(positions.userId, userId)))
      .limit(1);

    if (!position && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Position not found',
      });
    }

    return position ?? null;
  },

  async getByIdAndUser(id: string, userId: string): Promise<PositionRecord> {
    const position = await this.findByIdAndUser(id, userId, { throwIfNotFound: true });
    return position!;
  },

  async findByIdAndWallet(
    id: string,
    walletId: string,
    options: PositionQueryOptions = DEFAULT_OPTIONS
  ): Promise<PositionRecord | null> {
    const [position] = await db
      .select()
      .from(positions)
      .where(and(eq(positions.id, id), eq(positions.walletId, walletId)))
      .limit(1);

    if (!position && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Position not found',
      });
    }

    return position ?? null;
  },

  async listByWallet(params: ListPositionsParams): Promise<PositionRecord[]> {
    const conditions = [
      eq(positions.walletId, params.walletId),
      eq(positions.userId, params.userId),
    ];

    if (params.symbol) {
      conditions.push(eq(positions.symbol, params.symbol));
    }

    if (params.status) {
      conditions.push(eq(positions.status, params.status));
    }

    return db
      .select()
      .from(positions)
      .where(and(...conditions))
      .orderBy(desc(positions.createdAt))
      .limit(params.limit ?? 100)
      .offset(params.offset ?? 0);
  },

  async listOpenByWallet(walletId: string, userId: string): Promise<PositionRecord[]> {
    return db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.walletId, walletId),
          eq(positions.userId, userId),
          eq(positions.status, 'open')
        )
      )
      .orderBy(desc(positions.createdAt));
  },

  async findOpenBySymbol(
    walletId: string,
    symbol: string
  ): Promise<PositionRecord | null> {
    const [position] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.walletId, walletId),
          eq(positions.symbol, symbol),
          eq(positions.status, 'open')
        )
      )
      .limit(1);

    return position ?? null;
  },

  async countOpenByWallet(walletId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(positions)
      .where(
        and(
          eq(positions.walletId, walletId),
          eq(positions.status, 'open')
        )
      );

    return result?.count ?? 0;
  },

  async updateStatus(
    id: string,
    status: PositionStatus,
    additionalFields: Partial<typeof positions.$inferInsert> = {}
  ): Promise<PositionRecord> {
    const updateData = {
      status,
      updatedAt: new Date(),
      ...additionalFields,
    };

    if (status === 'closed' && !additionalFields.closedAt) {
      Object.assign(updateData, { closedAt: new Date() });
    }

    const [updated] = await db
      .update(positions)
      .set(updateData)
      .where(eq(positions.id, id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Position not found',
      });
    }

    return updated;
  },

  async updatePnl(
    id: string,
    pnl: string,
    pnlPercent: string,
    currentPrice?: string
  ): Promise<PositionRecord> {
    const [updated] = await db
      .update(positions)
      .set({
        pnl,
        pnlPercent,
        currentPrice,
        updatedAt: new Date(),
      })
      .where(eq(positions.id, id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Position not found',
      });
    }

    return updated;
  },
};

export const getPosition = positionQueries.getByIdAndUser.bind(positionQueries);
export const findPosition = positionQueries.findByIdAndUser.bind(positionQueries);
export const listOpenPositions = positionQueries.listOpenByWallet.bind(positionQueries);
