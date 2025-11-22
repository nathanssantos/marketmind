import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useEffect, useRef } from 'react';

export const usePriceUpdates = () => {
  const { chartData } = useChartContext();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const updateOrder = useTradingStore((state) => state.updateOrder);
  const closeOrder = useTradingStore((state) => state.closeOrder);
  const fillPendingOrders = useTradingStore((state) => state.fillPendingOrders);
  const expireOrders = useTradingStore((state) => state.expireOrders);
  const recordWalletPerformance = useTradingStore((state) => state.recordWalletPerformance);
  
  const lastCandleTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSimulatorActive || !chartData?.candles.length) return;

    const lastCandle = chartData.candles[chartData.candles.length - 1];
    if (!lastCandle) return;

    const currentPrice = lastCandle.close;
    const highPrice = lastCandle.high;
    const lowPrice = lastCandle.low;
    const symbol = chartData.symbol;
    const candleTime = lastCandle.timestamp;

    const currentState = useTradingStore.getState();
    const { wallets, orders } = currentState;

    if (lastCandleTimeRef.current !== null && candleTime !== lastCandleTimeRef.current) {
      wallets.forEach((wallet) => {
        recordWalletPerformance(wallet.id);
      });
    }
    lastCandleTimeRef.current = candleTime;

    expireOrders();
    
    fillPendingOrders(symbol, currentPrice, highPrice, lowPrice);

    const activeOrders = orders.filter((order) => order.status === 'active');

    activeOrders.forEach((order) => {
      const isLong = order.type === 'long';
      
      updateOrder(order.id, { currentPrice });

      const stopHit = order.stopLoss && (isLong
        ? lowPrice <= order.stopLoss
        : highPrice >= order.stopLoss);

      const targetHit = order.takeProfit && (isLong
        ? highPrice >= order.takeProfit
        : lowPrice <= order.takeProfit);

      if (stopHit && targetHit) {
        const stopDistance = Math.abs(currentPrice - (order.stopLoss || 0));
        const targetDistance = Math.abs(currentPrice - (order.takeProfit || 0));
        
        if (stopDistance < targetDistance) {
          closeOrder(order.id, order.stopLoss!);
        } else {
          closeOrder(order.id, order.takeProfit!);
        }
        return;
      }

      if (stopHit) {
        closeOrder(order.id, order.stopLoss!);
        return;
      }

      if (targetHit) {
        closeOrder(order.id, order.takeProfit!);
        return;
      }
    });
  }, [chartData?.candles, chartData?.symbol, isSimulatorActive, updateOrder, closeOrder, fillPendingOrders, expireOrders, recordWalletPerformance]);
};
