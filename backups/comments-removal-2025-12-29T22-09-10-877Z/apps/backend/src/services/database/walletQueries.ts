import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { wallets } from '../../db/schema';

export type WalletRecord = typeof wallets.$inferSelect;

export interface WalletQueryOptions {
  throwIfNotFound?: boolean;
  errorMessage?: string;
}

const DEFAULT_OPTIONS: WalletQueryOptions = {
  throwIfNotFound: true,
  errorMessage: 'Wallet not found',
};

export const walletQueries = {
  async findByIdAndUser(
    walletId: string,
    userId: string,
    options: WalletQueryOptions = DEFAULT_OPTIONS
  ): Promise<WalletRecord | null> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)))
      .limit(1);

    if (!wallet && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Wallet not found',
      });
    }

    return wallet ?? null;
  },

  async getByIdAndUser(walletId: string, userId: string): Promise<WalletRecord> {
    const wallet = await this.findByIdAndUser(walletId, userId, { throwIfNotFound: true });
    return wallet!;
  },

  async findById(
    walletId: string,
    options: WalletQueryOptions = { throwIfNotFound: false }
  ): Promise<WalletRecord | null> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet && options.throwIfNotFound) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: options.errorMessage ?? 'Wallet not found',
      });
    }

    return wallet ?? null;
  },

  async listByUser(userId: string): Promise<WalletRecord[]> {
    return db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));
  },

  async listActiveByUser(userId: string): Promise<WalletRecord[]> {
    return db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.isActive, true)));
  },

  async validateOwnership(walletId: string, userId: string): Promise<boolean> {
    const wallet = await this.findByIdAndUser(walletId, userId, { throwIfNotFound: false });
    return wallet !== null;
  },

  async getOrThrow(walletId: string, userId: string): Promise<WalletRecord> {
    return this.getByIdAndUser(walletId, userId);
  },
};

export const getWallet = walletQueries.getByIdAndUser.bind(walletQueries);
export const findWallet = walletQueries.findByIdAndUser.bind(walletQueries);
export const listUserWallets = walletQueries.listByUser.bind(walletQueries);
