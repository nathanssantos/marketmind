import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useEffect, useRef } from 'react';

export const usePriceUpdates = () => {
  const { chartData } = useChartContext();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const closeOrder = useTradingStore((state) => state.closeOrder);
  const expireOrders = useTradingStore((state) => state.expireOrders);
  const recordWalletPerformance = useTradingStore((state) => state.recordWalletPerformance);
  
  const lastCandleTimeRef = useRef<number | null>(null);
  const previousPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSimulatorActive || !chartData?.candles.length) return;

    const lastCandle = chartData.candles[chartData.candles.length - 1];
    if (!lastCandle) return;

    const currentPrice = lastCandle.close;
    const previousPrice = previousPriceRef.current;
    const candleTime = lastCandle.timestamp;

    const candleChanged = lastCandleTimeRef.current !== null && lastCandleTimeRef.current !== candleTime;
    
    if (candleChanged) {
      const currentState = useTradingStore.getState();
      const { wallets } = currentState;
      
      wallets.forEach((wallet) => {
        recordWalletPerformance(wallet.id);
      });
      
      expireOrders();
    }
    
    lastCandleTimeRef.current = candleTime;
    previousPriceRef.current = currentPrice;

    if (previousPrice === null) return;

    const currentState = useTradingStore.getState();
    const { orders } = currentState;
    const activeOrders = orders.filter((order) => order.status === 'active');

    activeOrders.forEach((order) => {
      const isLong = order.type === 'long';

      const stopLossCrossed = order.stopLoss && (isLong
        ? previousPrice > order.stopLoss && currentPrice <= order.stopLoss
        : previousPrice < order.stopLoss && currentPrice >= order.stopLoss);

      const takeProfitCrossed = order.takeProfit && (isLong
        ? previousPrice < order.takeProfit && currentPrice >= order.takeProfit
        : previousPrice > order.takeProfit && currentPrice <= order.takeProfit);

      if (stopLossCrossed && takeProfitCrossed) {
        const stopDistance = Math.abs(currentPrice - (order.stopLoss || 0));
        const targetDistance = Math.abs(currentPrice - (order.takeProfit || 0));
        
        if (stopDistance < targetDistance) {
          closeOrder(order.id, order.stopLoss!);
        } else {
          closeOrder(order.id, order.takeProfit!);
        }
        return;
      }

      if (stopLossCrossed) {
        closeOrder(order.id, order.stopLoss!);
        return;
      }

      if (takeProfitCrossed) {
        closeOrder(order.id, order.takeProfit!);
        return;
      }
    });
  }, [isSimulatorActive, chartData, closeOrder, expireOrders, recordWalletPerformance]);
};
