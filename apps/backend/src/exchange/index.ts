export type {
  ExchangeId,
  AssetClass,
  ExchangeCredentials,
  MarketHours,
  ExchangeCapabilities,
  ExchangeConfig,
} from './types';

export type {
  IExchangeFuturesClient,
  FuturesOrderParams,
  FuturesAlgoOrderParams,
  FuturesAlgoOrder,
  MarginModifyResult,
  IncomeHistoryParams,
  IncomeHistoryRecord,
  AccountTradeRecord,
  ClosingTradeResult,
  AllTradeFeesResult,
  OrderEntryFeeResult,
  LeverageBracket,
  CommissionRate,
} from './futures-client';

export type {
  IExchangeSpotClient,
  SpotOrderParams,
  SpotOrderResult,
  CancelOrderResult,
  OcoOrderParams,
  OcoOrderResult,
  SpotAccountInfo,
  SpotTradeFees,
} from './spot-client';

export type { IExchangePriceStream, PriceUpdate } from './price-stream';
export type { IExchangeKlineStream, KlineUpdate } from './kline-stream';
export type {
  IExchangeUserStream,
  OrderFillEvent,
  AccountUpdateEvent,
} from './user-stream';

export type { ExchangeProvider } from './exchange-registry';
export { exchangeRegistry } from './exchange-registry';

export {
  getExchangeCredentials,
  getExchangeId,
  getFuturesClient,
  getSpotClient,
} from './factory';
