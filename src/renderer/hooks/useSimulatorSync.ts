import type { MarketDataService } from '@renderer/services/market/MarketDataService';
import { useTradingStore } from '@renderer/store/tradingStore';
import { getOrderId, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import { useEffect, useRef } from 'react';

export const useSimulatorSync = (marketService: MarketDataService | null) => {
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const hasSyncedRef = useRef(false);
  const previousPricesRef = useRef<Map<string, number>>(new Map());

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

      const activeOrders = orders.filter((o) => isOrderActive(o) || isOrderPending(o));
      if (activeOrders.length === 0) {
        hasSyncedRef.current = true;
        return;
      }

      const symbolsToSync = Array.from(new Set(activeOrders.map((o) => o.symbol)));

      const syncPromises = symbolsToSync.map(async (symbol) => {
        try {
          const klineData = await marketService.fetchKlines({
            symbol,
            interval: '1h',
            limit: 2,
          });
          
          if (!klineData?.klines || klineData.klines.length === 0) return;

          const lastKline = klineData.klines[klineData.klines.length - 1];
          if (!lastKline) return;

          const currentPrice = parseFloat(lastKline.close);
          const highPrice = parseFloat(lastKline.high);
          const lowPrice = parseFloat(lastKline.low);

          updatePrices(symbol, currentPrice);

          fillPendingOrders(symbol, currentPrice, highPrice, lowPrice);

          const symbolOrders = orders.filter(
            (o) => o.symbol === symbol && isOrderActive(o)
          );

          const previousPrice = previousPricesRef.current.get(symbol);
          const hasHistoricalData = previousPrice !== undefined;
          
          previousPricesRef.current.set(symbol, currentPrice);

          symbolOrders.forEach((order) => {
            const isLong = isOrderLong(order);

            updateOrder(getOrderId(order), { currentPrice });

            if (!hasHistoricalData) {
              return;
            }

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
                closeOrder(getOrderId(order), order.stopLoss!);
              } else {
                closeOrder(getOrderId(order), order.takeProfit!);
              }
              return;
            }

            if (stopHit) {
              closeOrder(getOrderId(order), order.stopLoss!);
              return;
            }

            if (targetHit) {
              closeOrder(getOrderId(order), order.takeProfit!);
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
