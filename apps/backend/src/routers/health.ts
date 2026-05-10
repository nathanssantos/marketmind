import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { binanceKlineStreamService, binanceFuturesKlineStreamService } from '../services/binance-kline-stream';
import { binanceFuturesUserStreamService } from '../services/binance-futures-user-stream';

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.31.0',
  })),

  ping: publicProcedure
    .input(z.object({ message: z.string().optional() }))
    .query(({ input }) => ({
      pong: true,
      echo: input.message ?? 'No message provided',
    })),

  streams: publicProcedure.query(() => {
    const spotKlineSubs = binanceKlineStreamService.getActiveSubscriptions();
    const futuresKlineSubs = binanceFuturesKlineStreamService.getActiveSubscriptions();
    const userStreamWallets = binanceFuturesUserStreamService.getHealthSnapshot();

    return {
      timestamp: new Date().toISOString(),
      kline: {
        spot: spotKlineSubs,
        futures: futuresKlineSubs,
      },
      userStream: {
        wallets: userStreamWallets,
      },
    };
  }),
});
