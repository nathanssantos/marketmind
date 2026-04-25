import { TRPCError } from '@trpc/server';
import { BinanceIpBannedError, binanceApiCache } from '../services/binance-api-cache';

export const mapBinanceErrorToTRPC = (error: unknown): TRPCError => {
  if (error instanceof TRPCError) return error;
  if (error instanceof BinanceIpBannedError) return new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'Binance API error',
    cause: error,
  });
};

export const guardBinanceBan = (): void => {
  if (binanceApiCache.isBanned()) {
    const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: `IP banned by Binance. Try again in ${waitSeconds} seconds.` });
  }
};
