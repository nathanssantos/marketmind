import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useEffect, useRef } from 'react';

const APP_LOAD_TIME = Date.now();

export const usePriceUpdates = () => {
  const { chartData } = useChartContext();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const pendingOrdersCount = useTradingStore((state) => 
    state.orders.filter(o => o.status === 'pending').length
  );
  const updateOrder = useTradingStore((state) => state.updateOrder);
  const closeOrder = useTradingStore((state) => state.closeOrder);
  const fillPendingOrders = useTradingStore((state) => state.fillPendingOrders);
  const expireOrders = useTradingStore((state) => state.expireOrders);
  const recordWalletPerformance = useTradingStore((state) => state.recordWalletPerformance);
  
  const lastCandleTimeRef = useRef<number | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSimulatorActive || !chartData?.candles.length) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const processOrders = () => {
      const lastCandle = chartData.candles[chartData.candles.length - 1];
      if (!lastCandle) return;

      const currentPrice = lastCandle.close;
      const highPrice = lastCandle.high;
      const lowPrice = lastCandle.low;
      const symbol = chartData.symbol;
      const candleTime = lastCandle.timestamp;

      const currentState = useTradingStore.getState();
      const { wallets, orders } = currentState;

      const candleChanged = lastCandleTimeRef.current !== null && lastCandleTimeRef.current !== candleTime;
      const priceChanged = lastPriceRef.current !== null && lastPriceRef.current !== currentPrice;
      
      if (candleChanged) {
        wallets.forEach((wallet) => {
          recordWalletPerformance(wallet.id);
        });
        lastPriceRef.current = null;
      }
      
      lastCandleTimeRef.current = candleTime;

      expireOrders();
      
      if (!priceChanged && !candleChanged) {
        return;
      }
      
      const previousPrice = lastPriceRef.current;
      
      if (pendingOrdersCount > 0) {
        console.log(`[usePriceUpdates] Calling fillPendingOrders: symbol=${symbol}, current=${currentPrice.toFixed(2)}, previous=${previousPrice?.toFixed(2) ?? 'null'}, candleTime=${new Date(candleTime).toISOString()}`);
      }
      
      fillPendingOrders(symbol, currentPrice, previousPrice, APP_LOAD_TIME);
      lastPriceRef.current = currentPrice;

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
    };

    processOrders();
    
    intervalRef.current = setInterval(processOrders, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [chartData?.symbol, isSimulatorActive, pendingOrdersCount, updateOrder, closeOrder, fillPendingOrders, expireOrders, recordWalletPerformance]);
};
