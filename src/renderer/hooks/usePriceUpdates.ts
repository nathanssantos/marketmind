import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useEffect } from 'react';

export const usePriceUpdates = () => {
  const { chartData } = useChartContext();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const orders = useTradingStore((state) => state.orders);
  const updateOrder = useTradingStore((state) => state.updateOrder);
  const closeOrder = useTradingStore((state) => state.closeOrder);

  useEffect(() => {
    if (!isSimulatorActive || !chartData?.candles.length) return;

    const lastCandle = chartData.candles[chartData.candles.length - 1];
    if (!lastCandle) return;

    const currentPrice = lastCandle.close;
    const highPrice = lastCandle.high;
    const lowPrice = lastCandle.low;

    const activeOrders = orders.filter((order) => order.status === 'active');

    activeOrders.forEach((order) => {
      const isLong = order.type === 'long';
      
      updateOrder(order.id, { currentPrice });

      if (order.stopLoss) {
        const stopHit = isLong
          ? lowPrice <= order.stopLoss
          : highPrice >= order.stopLoss;

        if (stopHit) {
          closeOrder(order.id, order.stopLoss);
          return;
        }
      }

      if (order.takeProfit) {
        const targetHit = isLong
          ? highPrice >= order.takeProfit
          : lowPrice <= order.takeProfit;

        if (targetHit) {
          closeOrder(order.id, order.takeProfit);
          return;
        }
      }
    });
  }, [chartData?.candles, isSimulatorActive, orders, updateOrder, closeOrder]);
};
