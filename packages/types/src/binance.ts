export type BinanceOrderSide = 'BUY' | 'SELL';

export type BinanceOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT'
  | 'LIMIT_MAKER';

export type BinanceOrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED';

export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';

export type BinanceContingencyType = 'OCO' | 'OTO' | 'OTOCO';

export type BinanceListStatusType = 'RESPONSE' | 'EXEC_STARTED' | 'ALL_DONE';

export type BinanceListOrderStatus = 'EXECUTING' | 'ALL_DONE' | 'REJECT';

export interface BinanceOrderFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId?: number;
}

export interface BinanceNewOrderResult {
  symbol: string;
  orderId: string;
  orderListId?: string;
  clientOrderId: string;
  transactTime: number;
  price?: string;
  origQty?: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  status: string;
  timeInForce?: string;
  type: string;
  side: BinanceOrderSide;
  fills?: BinanceOrderFill[];
  workingTime?: number;
  selfTradePreventionMode?: string;
}

export interface BinanceOrderQueryResult {
  symbol: string;
  orderId: string;
  orderListId?: string;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: BinanceOrderSide;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  workingTime?: number;
  origQuoteOrderQty?: string;
  selfTradePreventionMode?: string;
}

export interface BinanceOrderList {
  orderListId: string;
  contingencyType: BinanceContingencyType;
  listStatusType: BinanceListStatusType;
  listOrderStatus: BinanceListOrderStatus;
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: Array<{
    symbol: string;
    orderId: string;
    clientOrderId: string;
  }>;
}

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceAccount {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  commissionRates: {
    maker: string;
    taker: string;
    buyer: string;
    seller: string;
  };
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokered: boolean;
  requireSelfTradePrevention: boolean;
  preventSor: boolean;
  updateTime: number;
  accountType: 'SPOT' | 'MARGIN' | 'FUTURES';
  balances: BinanceBalance[];
  permissions: string[];
  uid?: number;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  trades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface BinanceTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }>;
  exchangeFilters: unknown[];
  symbols: BinanceSymbolInfo[];
}

export interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Array<{
    filterType: string;
    [key: string]: unknown;
  }>;
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}
