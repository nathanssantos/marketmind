import { z } from 'zod';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../../services/binance-kline-stream';
import { getWebSocketService } from '../../services/websocket';
import { demoOrProtectedProcedure } from '../../trpc';
import { intervalSchema, marketTypeSchema, subscribeToStream, unsubscribeFromStream } from './shared';

export const subscriptionProcedures = {
  subscribe: demoOrProtectedProcedure
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

  unsubscribe: demoOrProtectedProcedure
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

  subscribeStream: demoOrProtectedProcedure
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

  unsubscribeStream: demoOrProtectedProcedure
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

  getActiveStreams: demoOrProtectedProcedure
    .query(async () => {
      const spotStreams = binanceKlineStreamService.getActiveSubscriptions();
      const futuresStreams = binanceFuturesKlineStreamService.getActiveSubscriptions();
      return {
        streams: spotStreams,
        futuresStreams,
      };
    }),

  getActiveSymbols: demoOrProtectedProcedure.query(() => {
    const ws = getWebSocketService();
    if (!ws) return [];
    return ws.getActivelyViewedSymbols();
  }),
};
