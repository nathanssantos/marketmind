import type { Interval, MarketType } from '@marketmind/types';
import { z } from 'zod';
import { TIME_MS } from '../../constants';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../../services/binance-kline-stream';
import { getKlineMaintenance } from '../../services/kline-maintenance';
import { logger } from '../../services/logger';
import { KeyedCache } from '../../utils/cache';

export const intervalSchema = z.enum([
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M', '1y',
]);

export const marketTypeSchema = z.enum(['SPOT', 'FUTURES']).default('FUTURES');
export const assetClassSchema = z.enum(['CRYPTO', 'STOCKS']).default('CRYPTO');

export interface CachedSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
}

export const symbolsCache = new KeyedCache<CachedSymbolInfo[]>(5 * TIME_MS.MINUTE);
export const corruptionCheckCache = new KeyedCache<boolean>(2 * TIME_MS.MINUTE);

export const triggerCorruptionCheck = (symbol: string, interval: string, marketType: MarketType): void => {
  const key = `${symbol}@${interval}@${marketType}`;

  if (corruptionCheckCache.has(key)) return;

  corruptionCheckCache.set(key, true);

  const gapFiller = getKlineMaintenance();
  gapFiller.forceCheckSymbol(symbol, interval as Interval, marketType).catch((error) => {
    logger.error({ symbol, interval, marketType, error }, 'Error in corruption check');
  });
};

export const subscribeToStream = (symbol: string, interval: string, marketType: MarketType): void => {
  if (marketType === 'FUTURES') {
    binanceFuturesKlineStreamService.subscribe(symbol, interval);
  } else {
    binanceKlineStreamService.subscribe(symbol, interval);
  }
};

export const unsubscribeFromStream = (symbol: string, interval: string, marketType: MarketType): void => {
  if (marketType === 'FUTURES') {
    binanceFuturesKlineStreamService.unsubscribe(symbol, interval);
  } else {
    binanceKlineStreamService.unsubscribe(symbol, interval);
  }
};
