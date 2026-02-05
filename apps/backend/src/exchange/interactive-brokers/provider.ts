import type { IExchangeFuturesClient } from '../futures-client';
import type { IExchangeKlineStream } from '../kline-stream';
import type { IExchangePriceStream } from '../price-stream';
import type { IExchangeSpotClient } from '../spot-client';
import type { ExchangeCapabilities, ExchangeCredentials, ExchangeId, MarketHours } from '../types';
import type { IExchangeUserStream } from '../user-stream';
import type { ExchangeProvider } from '../exchange-registry';
import { IBStockClient } from './stock-client';
import { IBKlineStream } from './kline-stream';
import { IBPriceStream } from './price-stream';
import { US_STOCK_MARKET_HOURS } from './constants';
import { marketHoursService } from './market-hours';

const IB_CAPABILITIES: ExchangeCapabilities = {
  supportedAssetClasses: ['EQUITY', 'ETF'],
  supportedOrderTypes: [
    'LIMIT',
    'MARKET',
    'STOP_LOSS',
    'STOP_LOSS_LIMIT',
    'TRAILING_STOP_MARKET',
  ],
  supportsOco: true,
  supportsAlgoOrders: true,
  supportsLeverage: true,
  supportsIsolatedMargin: false,
  supportsWebSocket: true,
  marketHours: US_STOCK_MARKET_HOURS,
};

export class IBExchangeProvider implements ExchangeProvider {
  readonly exchangeId: ExchangeId = 'INTERACTIVE_BROKERS';
  readonly capabilities: ExchangeCapabilities = IB_CAPABILITIES;

  createSpotClient(credentials: ExchangeCredentials): IExchangeSpotClient {
    return new IBStockClient(credentials);
  }

  createFuturesClient(_credentials: ExchangeCredentials): IExchangeFuturesClient {
    throw new Error('Interactive Brokers futures trading not yet implemented');
  }

  createPriceStream(): IExchangePriceStream {
    return new IBPriceStream();
  }

  createSpotKlineStream(): IExchangeKlineStream {
    return new IBKlineStream();
  }

  createFuturesKlineStream(): IExchangeKlineStream {
    throw new Error('Futures kline stream not available for Interactive Brokers');
  }

  createSpotUserStream(): IExchangeUserStream {
    throw new Error('User stream not yet implemented for Interactive Brokers');
  }

  createFuturesUserStream(): IExchangeUserStream {
    throw new Error('Futures user stream not available for Interactive Brokers');
  }

  normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  isMarketOpen(): boolean {
    return marketHoursService.isMarketOpen();
  }

  getMarketHours(): MarketHours {
    return this.capabilities.marketHours;
  }
}
