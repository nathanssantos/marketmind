import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradingProfiles } from '../../db/schema';

export type TradingProfileRecord = typeof tradingProfiles.$inferSelect;

export interface TradingProfileQueryOptions {
  throwIfNotFound?: boolean;
  errorMessage?: string;
}

const DEFAULT_ERROR_MESSAGE = 'Profile not found';

export const tradingProfileQueries = {
  async findByIdAndUser(
    profileId: string,
    userId: string,
    options: TradingProfileQueryOptions = { throwIfNotFound: false },
  ): Promise<TradingProfileRecord | null> {
    const [profile] = await db
      .select()
      .from(tradingProfiles)
      .where(and(eq(tradingProfiles.id, profileId), eq(tradingProfiles.userId, userId)))
      .limit(1);

    if (!profile && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? DEFAULT_ERROR_MESSAGE,
      });
    }

    return profile ?? null;
  },

  async getByIdAndUser(profileId: string, userId: string): Promise<TradingProfileRecord> {
    const profile = await this.findByIdAndUser(profileId, userId, { throwIfNotFound: true });
    return profile!;
  },

  async findById(
    profileId: string,
    options: TradingProfileQueryOptions = { throwIfNotFound: false },
  ): Promise<TradingProfileRecord | null> {
    const [profile] = await db
      .select()
      .from(tradingProfiles)
      .where(eq(tradingProfiles.id, profileId))
      .limit(1);

    if (!profile && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? DEFAULT_ERROR_MESSAGE,
      });
    }

    return profile ?? null;
  },

  async getById(profileId: string): Promise<TradingProfileRecord> {
    const profile = await this.findById(profileId, { throwIfNotFound: true });
    return profile!;
  },

  async listByUser(userId: string): Promise<TradingProfileRecord[]> {
    return db
      .select()
      .from(tradingProfiles)
      .where(eq(tradingProfiles.userId, userId))
      .orderBy(tradingProfiles.createdAt);
  },
};
