import type { Order } from '@marketmind/types';
import { getOrderPrice, getOrderQuantity, isOrderLong } from '@shared/utils';

export interface PositionData {
  avgPrice: number;
  totalQuantity: number;
  totalPnL: number;
  leverage?: number;
}

export interface OrderPnlOptions {
  order: Order;
  currentPrice: number;
  isPosition?: boolean;
  positionData?: PositionData | null;
}

export interface OrderPnlResult {
  pnl: number;
  pnlPercent: number;
  isProfitable: boolean;
}

export const calculateOrderPnl = ({
  order,
  currentPrice,
  isPosition = false,
  positionData = null,
}: OrderPnlOptions): OrderPnlResult => {
  if (isPosition && positionData) {
    const totalInvestment = positionData.avgPrice * positionData.totalQuantity;
    const leverage = positionData.leverage ?? 1;
    const pnlPercent = totalInvestment > 0 ? (positionData.totalPnL / totalInvestment) * 100 * leverage : 0;

    return {
      pnl: positionData.totalPnL,
      pnlPercent,
      isProfitable: positionData.totalPnL >= 0,
    };
  }

  const isLong = isOrderLong(order);
  const entryPrice = getOrderPrice(order);
  const quantity = getOrderQuantity(order);
  const priceChange = currentPrice - entryPrice;
  const pnl = priceChange * quantity * (isLong ? 1 : -1);
  const investment = entryPrice * quantity;
  const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;

  return {
    pnl,
    pnlPercent,
    isProfitable: pnl >= 0,
  };
};
