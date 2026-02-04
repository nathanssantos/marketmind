import type { IExchangeFuturesClient } from '../futures-client';
import type { IExchangeKlineStream } from '../kline-stream';
import type { IExchangePriceStream } from '../price-stream';
import type { IExchangeSpotClient } from '../spot-client';
import type { ExchangeCapabilities, ExchangeCredentials, ExchangeId, MarketHours } from '../types';
import type { IExchangeUserStream } from '../user-stream';
import type { ExchangeProvider } from '../exchange-registry';
import { BinanceFuturesExchangeClient } from './futures-client';
import { BinanceSpotExchangeClient } from './spot-client';

const BINANCE_CAPABILITIES: ExchangeCapabilities = {
  supportedAssetClasses: ['CRYPTO_SPOT', 'CRYPTO_FUTURES'],
  supportedOrderTypes: [
    'LIMIT',
    'MARKET',
    'STOP_LOSS',
    'STOP_LOSS_LIMIT',
    'TAKE_PROFIT',
    'TAKE_PROFIT_LIMIT',
    'LIMIT_MAKER',
  ],
  supportsOco: true,
  supportsAlgoOrders: true,
  supportsLeverage: true,
  supportsIsolatedMargin: true,
  supportsWebSocket: true,
  marketHours: { timezone: 'UTC', is24h: true },
};

export class BinanceExchangeProvider implements ExchangeProvider {
  readonly exchangeId: ExchangeId = 'BINANCE';
  readonly capabilities: ExchangeCapabilities = BINANCE_CAPABILITIES;

  createSpotClient(credentials: ExchangeCredentials): IExchangeSpotClient {
    return new BinanceSpotExchangeClient(credentials);
  }

  createFuturesClient(credentials: ExchangeCredentials): IExchangeFuturesClient {
    return new BinanceFuturesExchangeClient(credentials);
  }

  createPriceStream(): IExchangePriceStream {
    throw new Error('Price stream not yet migrated — use BinancePriceStreamService directly');
  }

  createSpotKlineStream(): IExchangeKlineStream {
    throw new Error('Kline stream not yet migrated — use BinanceKlineStreamService directly');
  }

  createFuturesKlineStream(): IExchangeKlineStream {
    throw new Error('Kline stream not yet migrated — use BinanceFuturesKlineStreamService directly');
  }

  createSpotUserStream(): IExchangeUserStream {
    throw new Error('User stream not yet migrated — use BinanceUserStreamService directly');
  }

  createFuturesUserStream(): IExchangeUserStream {
    throw new Error('User stream not yet migrated — use BinanceFuturesUserStreamService directly');
  }

  normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  isMarketOpen(): boolean {
    return true;
  }

  getMarketHours(): MarketHours {
    return this.capabilities.marketHours;
  }
}
