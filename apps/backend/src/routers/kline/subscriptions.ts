import { z } from 'zod';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../../services/binance-kline-stream';
import { getWebSocketService } from '../../services/websocket';
import { protectedProcedure } from '../../trpc';
import { intervalSchema, marketTypeSchema, subscribeToStream, unsubscribeFromStream } from './shared';

export const subscriptionProcedures = {
  subscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      subscribeToStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Subscribed to ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      unsubscribeFromStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Unsubscribed from ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  subscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      subscribeToStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Subscribed to real-time stream ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  unsubscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      unsubscribeFromStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Unsubscribed from real-time stream ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  getActiveStreams: protectedProcedure
    .query(async () => {
      const spotStreams = binanceKlineStreamService.getActiveSubscriptions();
      const futuresStreams = binanceFuturesKlineStreamService.getActiveSubscriptions();
      return {
        streams: spotStreams,
        futuresStreams,
      };
    }),

  getActiveSymbols: protectedProcedure.query(() => {
    const ws = getWebSocketService();
    if (!ws) return [];
    return ws.getActivelyViewedSymbols();
  }),
};
