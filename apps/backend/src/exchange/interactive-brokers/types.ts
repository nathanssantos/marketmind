import type { Contract, Order, OrderState, Bar, SecType } from '@stoqey/ib';
import type { IB_ORDER_TYPES, IB_ORDER_ACTIONS, IB_TIME_IN_FORCE } from './constants';

export interface IBConnectionConfig {
  host: string;
  port: number;
  clientId: number;
  connectionTimeout?: number;
}

export interface IBConnectionState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  lastError?: Error;
  connectionTime?: Date;
  serverVersion?: number;
}

export type IBOrderType = (typeof IB_ORDER_TYPES)[keyof typeof IB_ORDER_TYPES];
export type IBOrderAction = (typeof IB_ORDER_ACTIONS)[keyof typeof IB_ORDER_ACTIONS];
export type IBTimeInForce = (typeof IB_TIME_IN_FORCE)[keyof typeof IB_TIME_IN_FORCE];

export interface IBStockContract {
  symbol: string;
  secType: SecType;
  exchange: string;
  primaryExchange?: string;
  currency: string;
  conId?: number;
}

export interface IBOrderParams {
  contract: IBStockContract;
  action: IBOrderAction;
  orderType: IBOrderType;
  totalQuantity: number;
  lmtPrice?: number;
  auxPrice?: number;
  tif?: IBTimeInForce;
  outsideRth?: boolean;
  trailingPercent?: number;
  trailStopPrice?: number;
  whatIf?: boolean;
  ocaGroup?: string;
  ocaType?: number;
  parentId?: number;
  transmit?: boolean;
}

export interface IBOrderResult {
  orderId: number;
  clientId: number;
  permId: number;
  contract: Contract;
  order: Order;
  orderState: OrderState;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  lastFillPrice: number;
  whyHeld?: string;
}

export interface IBExecution {
  execId: string;
  time: string;
  acctNumber: string;
  exchange: string;
  side: string;
  shares: number;
  price: number;
  permId: number;
  clientId: number;
  orderId: number;
  liquidation: number;
  cumQty: number;
  avgPrice: number;
}

export interface IBPosition {
  account: string;
  contract: Contract;
  position: number;
  avgCost: number;
  marketValue?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
}

export interface IBAccountSummary {
  netLiquidation: number;
  buyingPower: number;
  availableFunds: number;
  excessLiquidity: number;
  initMarginReq: number;
  maintMarginReq: number;
  equityWithLoanValue: number;
  grossPositionValue: number;
  sma: number;
  leverage: number;
  cushion: number;
  dayTradesRemaining: number;
  fullInitMarginReq: number;
  fullMaintMarginReq: number;
  fullAvailableFunds: number;
  fullExcessLiquidity: number;
}

export interface IBMarginImpact {
  initMarginBefore: number;
  maintMarginBefore: number;
  equityWithLoanBefore: number;
  initMarginChange: number;
  maintMarginChange: number;
  initMarginAfter: number;
  maintMarginAfter: number;
  equityWithLoanAfter: number;
  commission: number;
  minCommission: number;
  maxCommission: number;
}

export interface IBBar extends Partial<Bar> {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  wap: number;
  barCount: number;
}

export type ShortDifficulty = 'easy' | 'hard' | 'unavailable';

export interface ShortabilityInfo {
  symbol: string;
  available: boolean;
  difficulty: ShortDifficulty;
  sharesAvailable: number;
  borrowFeeRate?: number;
  rebateRate?: number;
}

export type GapType =
  | 'OVERNIGHT'
  | 'WEEKEND'
  | 'HOLIDAY'
  | 'EARLY_CLOSE'
  | 'UNEXPECTED';

export interface GapInfo {
  type: GapType;
  start: Date;
  end: Date;
  durationMs: number;
  expectedKlines: number;
  isLegitimate: boolean;
}

export interface MarginSafetyConfig {
  minCushion: number;
  maxLeverage: number;
  warnDayTradesRemaining: number;
  blockWhenMarginCall: boolean;
}

export interface MarginValidationResult {
  safe: boolean;
  issues: string[];
  canTrade: boolean;
}

export interface BackfillChunk {
  symbol: string;
  interval: string;
  endDateTime: Date;
  duration: string;
}

export interface BackfillResult {
  symbol: string;
  interval: string;
  klines: import('@marketmind/types').Kline[];
  totalRequests: number;
  durationMs: number;
  avgRequestTime?: number;
}

export interface MarketSession {
  name: string;
  open: string;
  close: string;
  isCore: boolean;
}

export interface MarketCalendar {
  timezone: string;
  sessions: MarketSession[];
  holidays: Date[];
  earlyCloses: Map<string, string>;
}

export type IBEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'orderStatus'
  | 'openOrder'
  | 'execDetails'
  | 'position'
  | 'accountSummary'
  | 'historicalData'
  | 'tickPrice'
  | 'tickSize'
  | 'tickGeneric';

export interface IBEventHandler<T = unknown> {
  (data: T): void;
}

export interface IBContractDetails {
  contract: Contract;
  marketName: string;
  minTick: number;
  orderTypes: string;
  validExchanges: string;
  priceMagnifier: number;
  underConId: number;
  longName: string;
  contractMonth: string;
  industry: string;
  category: string;
  subcategory: string;
  timeZoneId: string;
  tradingHours: string;
  liquidHours: string;
}

export interface IBSymbolSearchResult {
  conId: number;
  symbol: string;
  secType: string;
  primaryExchange: string;
  currency: string;
  derivativeSecTypes?: string[];
  description?: string;
}

export interface IBTickData {
  tickerId: number;
  field: number;
  value: number;
  attribs?: { canAutoExecute: boolean; pastLimit: boolean; preOpen: boolean };
}

export interface IBPriceData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  bidSize: number;
  askSize: number;
  lastSize: number;
  volume: number;
  close: number;
  open: number;
  high: number;
  low: number;
}
