import type { ExchangeId, MarketType } from '@marketmind/types';

interface KlineStreamSubscriber {
  subscribe(symbol: string, interval: string): void | Promise<void>;
  unsubscribe(symbol: string, interval: string): void;
}

export const getKlineStreamService = async (exchange: ExchangeId, marketType: MarketType): Promise<KlineStreamSubscriber> => {
  if (exchange === 'INTERACTIVE_BROKERS') {
    const { ibKlineStreamService } = await import('./ib-kline-stream-service');
    return ibKlineStreamService;
  }

  const { binanceKlineStreamService, binanceFuturesKlineStreamService } = await import('./binance-kline-stream');
  return marketType === 'FUTURES' ? binanceFuturesKlineStreamService : binanceKlineStreamService;
};
