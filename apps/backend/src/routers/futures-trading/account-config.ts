import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { binanceApiCache, guardBinanceCall } from '../../services/binance-api-cache';
import { mapBinanceErrorToTRPC } from '../../utils/binanceErrorHandler';
import {
  createBinanceFuturesClient,
  getConfiguredLeverage,
  getSymbolLeverageBrackets,
  isPaperWallet,
  LeverageUnavailableError,
  setLeverage,
  setMarginType,
} from '../../services/binance-futures-client';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';

export const accountConfigRouter = router({
  setLeverage: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        leverage: z.number().min(1).max(125),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return { leverage: input.leverage, maxNotionalValue: '0', symbol: input.symbol };
      }

      try {
        const client = createBinanceFuturesClient(wallet);

        const positionsV3 = await guardBinanceCall(() => client.getPositionsV3({ symbol: input.symbol }));
        const hasOpenPosition = positionsV3.some(
          (p) => p.symbol === input.symbol && Math.abs(parseFloat(String(p.positionAmt))) > 0
        );
        if (hasOpenPosition) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot change leverage while ${input.symbol} has an open position. Close the position first.`,
          });
        }

        const result = await setLeverage(client, input.symbol, input.leverage);
        binanceApiCache.invalidate('SYMBOL_LEVERAGE', input.walletId, input.symbol);
        return result;
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  setMarginType: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        marginType: z.enum(['ISOLATED', 'CROSSED']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return { success: true, marginType: input.marginType };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        await setMarginType(client, input.symbol, input.marginType);
        return { success: true, marginType: input.marginType };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  getSymbolLeverage: protectedProcedure
    .input(z.object({ walletId: z.string(), symbol: z.string() }))
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
      if (isPaperWallet(wallet)) return { leverage: 1 };

      // Cache only on positive (>0) results — never poison the cache
      // with a fallback / loading-state value that could be served to
      // the order-sizing path.
      const cached = binanceApiCache.get<{ leverage: number }>('SYMBOL_LEVERAGE', input.walletId, input.symbol);
      if (cached && cached.leverage > 0) return cached;

      try {
        const client = createBinanceFuturesClient(wallet);
        const leverage = await getConfiguredLeverage(client, input.symbol);
        // getConfiguredLeverage now throws LeverageUnavailableError when
        // it can't determine the value — so a returned `leverage` here
        // is always genuine. Safe to cache.
        const result = { leverage };
        binanceApiCache.set('SYMBOL_LEVERAGE', input.walletId, result, input.symbol);
        return result;
      } catch (error) {
        if (error instanceof LeverageUnavailableError) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: error.message,
          });
        }
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  getLeverageBrackets: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return [
          { bracket: 1, initialLeverage: 125, notionalCap: 50000, notionalFloor: 0, maintMarginRatio: 0.004, cum: 0 },
          { bracket: 2, initialLeverage: 100, notionalCap: 250000, notionalFloor: 50000, maintMarginRatio: 0.005, cum: 50 },
          { bracket: 3, initialLeverage: 50, notionalCap: 1000000, notionalFloor: 250000, maintMarginRatio: 0.01, cum: 1300 },
        ];
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getSymbolLeverageBrackets(client, input.symbol);
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),
});
