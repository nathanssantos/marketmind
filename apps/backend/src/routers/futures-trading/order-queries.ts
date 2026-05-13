import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders } from '../../db/schema';
import { mapBinanceErrorToTRPC } from '../../utils/binanceErrorHandler';
import {
  createBinanceFuturesClient,
  getOpenAlgoOrders,
  isPaperWallet,
} from '../../services/binance-futures-client';
import { getCustomSymbolService } from '../../services/custom-symbol-service';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';

const isCustomSymbol = (symbol: string | undefined): boolean =>
  symbol ? (getCustomSymbolService()?.isCustomSymbolSync(symbol) ?? false) : false;

export const orderQueriesRouter = router({
  // Phase 5 of the binance-connection audit: this query now reads from
  // the `orders` table for BOTH paper and live wallets. The table is
  // kept in sync by:
  //   - WS `ORDER_TRADE_UPDATE` handler (real-time per state change)
  //   - `OrderSyncService` reconcile loop (30s safety net)
  //   - Reconnect-time syncWallet call (post-disconnect catchup)
  //
  // Switching off the REST + 10s `binanceApiCache.OPEN_ORDERS` removes
  // the entire class of "UI stuck for ~10s because cache hadn't
  // expired" bugs we audited in PR #608. The cache invalidation calls
  // that PR sprinkled across every mutation are now dead — they're
  // being removed in a follow-up commit so the code stays honest.
  //
  // Trade-off: a brief post-reconnect window can show stale orders
  // until the reconcile catches up. The 30s reconcile interval bounds
  // this, and is no worse than the prior 10s cache TTL in the typical
  // path. The reliability win — UI matches DB matches Binance, no
  // hidden cache layer — outweighs the rare gap-after-reconnect case.
  getOpenOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (isCustomSymbol(input.symbol)) return [];

      try {
        // Confirms ownership + throws NOT_FOUND if the wallet was
        // deleted between cache lookup and query. Cheap.
        await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }

      const whereConditions = [
        eq(orders.userId, ctx.user.id),
        eq(orders.walletId, input.walletId),
        eq(orders.marketType, 'FUTURES'),
        eq(orders.status, 'NEW'),
      ];

      if (input.symbol) {
        whereConditions.push(eq(orders.symbol, input.symbol));
      }

      return ctx.db.select().from(orders).where(and(...whereConditions));
    }),

  getOpenAlgoOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (isCustomSymbol(input.symbol)) return [];

      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return [];
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getOpenAlgoOrders(client, input.symbol);
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  getOpenDbOrderIds: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(
          and(
            eq(orders.userId, ctx.user.id),
            eq(orders.walletId, input.walletId),
            eq(orders.status, 'NEW'),
            eq(orders.marketType, 'FUTURES')
          )
        );
      return result.map((r) => r.orderId);
    }),
});
