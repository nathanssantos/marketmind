import type { FibonacciProjectionData, MarketType, Order, PositionSide } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
import { ORDER_LINE_COLORS } from '@shared/constants/chartColors';

export interface BackendExecution {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: string;
  quantity: string;
  stopLoss: string | null;
  takeProfit: string | null;
  status: string | null;
  setupType: string | null;
  entryOrderType?: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | null;
  marketType?: MarketType | null;
  openedAt?: string | Date | null;
  triggerKlineOpenTime?: number | null;
  fibonacciProjection?: FibonacciProjectionData | null;
  leverage?: number;
  liquidationPrice?: string | null;
}

export interface OrderCloseButton {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrderHitbox {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: Order;
}

export interface SLTPHitbox {
  orderId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'stopLoss' | 'takeProfit';
  price: number;
}

export interface SLTPCloseButton {
  orderIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'stopLoss' | 'takeProfit';
}

export interface SlTpButtonHitbox {
  executionId: string;
  type: 'stopLoss' | 'takeProfit';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PendingSetup {
  id: string;
  type: string;
  direction: PositionSide;
  entryPrice: number;
  limitEntryPrice?: number;
  entryOrderType?: 'MARKET' | 'LIMIT';
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio: number;
  confidence: number;
  klineIndex: number;
  label?: string;
}

export interface TrailingStopLineConfig {
  enabled: boolean;
  activationPercentLong: number;
  activationPercentShort: number;
}

export interface GroupedPosition {
  symbol: string;
  netQuantity: number;
  avgPrice: number;
  orderIds: string[];
  orders: Order[];
  totalPnL: number;
  leverage: number;
  liquidationPrice?: number;
}

export const SLTP_BUTTON = {
  WIDTH: 20,
  HEIGHT: 14,
  GAP: 3,
  BORDER_RADIUS: 3,
  FONT_SIZE: 9,
  SL_BG: 'rgba(185, 28, 28, 0.85)',
  SL_BORDER: ORDER_LINE_COLORS.SL_LOSS_LINE,
  TP_BG: 'rgba(15, 118, 56, 0.85)',
  TP_BORDER: ORDER_LINE_COLORS.TP_LINE,
  TEXT_COLOR: ORDER_LINE_COLORS.TEXT_WHITE,
} as const;

export const PRICE_TAG_WIDTH = CHART_CONFIG.CANVAS_PADDING_RIGHT;
