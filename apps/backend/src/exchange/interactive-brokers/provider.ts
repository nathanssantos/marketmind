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
import { US_STOCK_MARKET_HOURS, US_MARKET_REGULAR_SESSION } from './constants';

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
  supportsLeverage: false,
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
    const now = new Date();
    const nyTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const timeParts = nyTime.split(':').map(Number);
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;
    const currentMinutes = hours * 60 + minutes;

    const openParts = US_MARKET_REGULAR_SESSION.open.split(':').map(Number);
    const closeParts = US_MARKET_REGULAR_SESSION.close.split(':').map(Number);
    const openHours = openParts[0] ?? 9;
    const openMinutes = openParts[1] ?? 30;
    const closeHours = closeParts[0] ?? 16;
    const closeMinutes = closeParts[1] ?? 0;

    const openTotalMinutes = openHours * 60 + openMinutes;
    const closeTotalMinutes = closeHours * 60 + closeMinutes;

    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(now);

    if (day === 'Sat' || day === 'Sun') {
      return false;
    }

    return currentMinutes >= openTotalMinutes && currentMinutes < closeTotalMinutes;
  }

  getMarketHours(): MarketHours {
    return this.capabilities.marketHours;
  }
}
