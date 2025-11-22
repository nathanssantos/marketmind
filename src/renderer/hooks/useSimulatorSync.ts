import { MarketDataService } from '@renderer/services/market/MarketDataService';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useEffect, useRef } from 'react';

export const useSimulatorSync = (marketService: MarketDataService | null) => {
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!isSimulatorActive || !marketService || hasSyncedRef.current) return;

    const syncSimulator = async () => {
      const state = useTradingStore.getState();
      const { orders, wallets, updateOrder, fillPendingOrders, closeOrder, expireOrders, recordWalletPerformance, updatePrices } = state;

      if (wallets.length === 0 && orders.length === 0) {
        hasSyncedRef.current = true;
        return;
      }

      expireOrders();

      const activeOrders = orders.filter((o) => o.status === 'active' || o.status === 'pending');
      if (activeOrders.length === 0) {
        hasSyncedRef.current = true;
        return;
      }

      const symbolsToSync = Array.from(new Set(activeOrders.map((o) => o.symbol)));

      const syncPromises = symbolsToSync.map(async (symbol) => {
        try {
          const candleData = await marketService.fetchCandles({
            symbol,
            interval: '1h',
            limit: 2,
          });
          
          if (!candleData?.candles || candleData.candles.length === 0) return;

          const lastCandle = candleData.candles[candleData.candles.length - 1];
          if (!lastCandle) return;

          const currentPrice = lastCandle.close;
          const highPrice = lastCandle.high;
          const lowPrice = lastCandle.low;

          updatePrices(symbol, currentPrice);

          fillPendingOrders(symbol, currentPrice, highPrice, lowPrice);

          const symbolOrders = orders.filter(
            (o) => o.symbol === symbol && o.status === 'active'
          );

          symbolOrders.forEach((order) => {
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
        } catch (error) {
          console.error(`Failed to sync symbol ${symbol}:`, error);
        }
      });

      await Promise.all(syncPromises);

      wallets.forEach((wallet) => {
        recordWalletPerformance(wallet.id);
      });

      hasSyncedRef.current = true;
    };

    syncSimulator();
  }, [isSimulatorActive, marketService]);

  return { hasSynced: hasSyncedRef.current };
};
