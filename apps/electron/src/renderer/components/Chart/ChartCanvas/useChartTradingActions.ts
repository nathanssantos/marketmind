import type { MarketType, Order } from '@marketmind/types';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { useToast } from '@renderer/hooks/useToast';
import { trpc } from '@renderer/utils/trpc';
import { getKlineClose, roundTradingPrice } from '@shared/utils';
import type { MutableRefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { OptimisticOverride } from './useChartTradingData';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import {
  createOptimisticEntry,
  submitEntryOrder,
  mapExecutionToOrder,
  getOrderQuantity as getOrderQuantityHelper,
} from './chartOrderHelpers';

export interface UseChartTradingActionsProps {
  symbol?: string;
  marketType?: MarketType;
  manager: CanvasManager | null;
  backendWalletId: string | undefined;
  backendExecutions: BackendExecution[] | undefined;
  allExecutions: BackendExecution[];
  setOptimisticExecutions: React.Dispatch<React.SetStateAction<BackendExecution[]>>;
  orderLoadingMapRef: MutableRefObject<Map<string, number>>;
  orderFlashMapRef: MutableRefObject<Map<string, number>>;
  closingSnapshotsRef: MutableRefObject<Map<string, BackendExecution>>;
  setClosingVersion: React.Dispatch<React.SetStateAction<number>>;
  applyOptimistic: (id: string, patches: OptimisticOverride['patches'], previousValues: OptimisticOverride['previousValues']) => void;
  clearOptimistic: (id: string, expectedPatches?: OptimisticOverride['patches']) => void;
  activeWalletBalance: string | undefined;
  latestKlinesPriceRef: MutableRefObject<number>;
  setOrderToClose: (id: string | null) => void;
}

export const useChartTradingActions = ({
  symbol,
  marketType,
  manager,
  backendWalletId,
  backendExecutions,
  allExecutions,
  setOptimisticExecutions,
  orderLoadingMapRef,
  orderFlashMapRef,
  closingSnapshotsRef,
  setClosingVersion,
  applyOptimistic,
  clearOptimistic,
  activeWalletBalance,
  latestKlinesPriceRef,
  setOrderToClose,
}: UseChartTradingActionsProps) => {
  const { t } = useTranslation();
  const { warning, error: toastError } = useToast();
  const utils = trpc.useUtils();

  const updateTsConfig = trpc.trading.updateSymbolTrailingConfig.useMutation({
    onSuccess: () => {
      void utils.trading.getSymbolTrailingConfig.invalidate();
    },
    onError: (error) => {
      toastError(t('positionTrailingStop.activationFailed'), error.message);
    },
  });

  const cancelFuturesOrderMutation = trpc.futuresTrading.cancelOrder.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.futuresTrading.getOpenAlgoOrders.invalidate();
      utils.futuresTrading.getOpenDbOrderIds.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
    },
  });

  const {
    createOrder: addBackendOrder,
    closeExecution,
    cancelExecution,
    updateExecutionSLTP,
    cancelProtectionOrder,
    updatePendingEntry,
  } = useBackendTradingMutations();

  const quickTradeSizePercent = useQuickTradeStore((s) => s.sizePercent);

  const getOrderQuantity = useCallback((price: number): string =>
    getOrderQuantityHelper(price, activeWalletBalance, quickTradeSizePercent),
  [activeWalletBalance, quickTradeSizePercent]);

  const handleLongEntry = useCallback(async (price: number) => {
    if (!backendWalletId) { warning(t('trading.ticket.noWallet')); return; }
    if (!symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const hasOpenShort = (backendExecutions ?? []).some(
      (e) => e.symbol === symbol && e.side === 'SHORT' && e.status === 'open'
    );

    const optimisticId = createOptimisticEntry({
      symbol, side: 'LONG', price, marketType: marketType || 'FUTURES',
      getOrderQuantity, setOptimisticExecutions, orderLoadingMapRef, manager,
    });

    try {
      await submitEntryOrder({
        backendWalletId, symbol, side: 'BUY', price, marketPrice,
        quantity: getOrderQuantity(price), reduceOnly: hasOpenShort, addBackendOrder,
      });
      utils.autoTrading.getActiveExecutions.invalidate();
      orderFlashMapRef.current.set(optimisticId, performance.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
      setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
    } finally {
      orderLoadingMapRef.current.delete(optimisticId);
      manager?.markDirty('overlays');
    }
  }, [addBackendOrder, symbol, marketType, getOrderQuantity, warning, toastError, t, backendWalletId, utils, backendExecutions, manager, orderLoadingMapRef, orderFlashMapRef, setOptimisticExecutions, latestKlinesPriceRef]);

  const handleShortEntry = useCallback(async (price: number) => {
    if (!backendWalletId) { warning(t('trading.ticket.noWallet')); return; }
    if (!symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const hasOpenLong = (backendExecutions ?? []).some(
      (e) => e.symbol === symbol && e.side === 'LONG' && e.status === 'open'
    );

    const optimisticId = createOptimisticEntry({
      symbol, side: 'SHORT', price, marketType: marketType || 'FUTURES',
      getOrderQuantity, setOptimisticExecutions, orderLoadingMapRef, manager,
    });

    try {
      await submitEntryOrder({
        backendWalletId, symbol, side: 'SELL', price, marketPrice,
        quantity: getOrderQuantity(price), reduceOnly: hasOpenLong, addBackendOrder,
      });
      utils.autoTrading.getActiveExecutions.invalidate();
      orderFlashMapRef.current.set(optimisticId, performance.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
      setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
    } finally {
      orderLoadingMapRef.current.delete(optimisticId);
      manager?.markDirty('overlays');
    }
  }, [addBackendOrder, symbol, marketType, getOrderQuantity, warning, toastError, t, backendWalletId, utils, backendExecutions, manager, orderLoadingMapRef, orderFlashMapRef, setOptimisticExecutions, latestKlinesPriceRef]);

  const handleOrderCloseRequest = useCallback((orderId: string | null): void => {
    if (!orderId) {
      setOrderToClose(null);
      return;
    }
    if (orderId === 'ts-disable') {
      if (!backendWalletId || !symbol) return;
      updateTsConfig.mutate({
        walletId: backendWalletId,
        symbol,
        useIndividualConfig: true,
        trailingStopEnabled: false,
      });
      return;
    }
    if (orderId.startsWith('sltp:')) {
      setOrderToClose(orderId);
      return;
    }
    if (orderId.startsWith('exchange-order-') || orderId.startsWith('exchange-algo-')) {
      const exchangeOrderId = orderId.replace(/^exchange-(order|algo)-/, '');
      if (!backendWalletId || !symbol || !exchangeOrderId) return;
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(orderId, cancelPatches, { status: 'pending' });
      orderLoadingMapRef.current.set(orderId, Date.now());
      manager?.markDirty('overlays');
      cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: exchangeOrderId })
        .then(() => {
          orderFlashMapRef.current.set(orderId, performance.now());
          manager?.markDirty('overlays');
        })
        .catch((error) => {
          clearOptimistic(orderId, cancelPatches);
          toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
        })
        .finally(() => {
          orderLoadingMapRef.current.delete(orderId);
          manager?.markDirty('overlays');
        });
      return;
    }
    const exec = allExecutions.find((e) => e.id === orderId);
    if (!exec) return;
    if (exec.status === 'pending') {
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(exec.id, cancelPatches, { status: exec.status });
      orderLoadingMapRef.current.set(exec.id, Date.now());
      manager?.markDirty('overlays');
      cancelExecution(exec.id).then(() => {
        orderFlashMapRef.current.set(exec.id, performance.now());
        manager?.markDirty('overlays');
      }).catch((error: unknown) => {
        clearOptimistic(exec.id, cancelPatches);
        toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(exec.id);
        manager?.markDirty('overlays');
      });
      return;
    }
    setOrderToClose(orderId);
  }, [allExecutions, cancelExecution, setOrderToClose, manager, backendWalletId, symbol, cancelFuturesOrderMutation, applyOptimistic, clearOptimistic, toastError, t, updateTsConfig, orderLoadingMapRef, orderFlashMapRef]);

  const handleConfirmCloseOrder = useCallback(async (orderToClose: string | null): Promise<void> => {
    if (!orderToClose || !manager) return;

    if (orderToClose.startsWith('sltp:')) {
      const firstColon = orderToClose.indexOf(':');
      const secondColon = orderToClose.indexOf(':', firstColon + 1);
      const type = orderToClose.substring(firstColon + 1, secondColon) as 'stopLoss' | 'takeProfit';
      const executionIds = orderToClose.substring(secondColon + 1).split(',').filter(Boolean);

      if (executionIds.length > 0) {
        const patchField = type === 'stopLoss' ? 'stopLoss' : 'takeProfit';
        executionIds.forEach(id => {
          const exec = allExecutions.find(e => e.id === id);
          applyOptimistic(id, { [patchField]: null }, { [patchField]: exec?.[patchField] });
          orderLoadingMapRef.current.set(id, Date.now());
        });
        manager.markDirty('overlays');
        try {
          await cancelProtectionOrder(executionIds, type);
          executionIds.forEach(id => {
            const flashKey = `${id}-${type === 'stopLoss' ? 'sl' : 'tp'}`;
            orderFlashMapRef.current.set(flashKey, performance.now());
          });
        } catch (error) {
          executionIds.forEach(id => clearOptimistic(id, { [patchField]: null }));
          toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
        } finally {
          executionIds.forEach(id => orderLoadingMapRef.current.delete(id));
          manager.markDirty('overlays');
        }
      }

      return;
    }

    const exec = allExecutions.find((e) => e.id === orderToClose);
    if (exec) {
      closingSnapshotsRef.current.set(exec.id, exec);
      setClosingVersion(v => v + 1);
      orderLoadingMapRef.current.set(exec.id, Date.now());
      manager.markDirty('overlays');
      try {
        const klines = manager.getKlines();
        const lastKline = klines[klines.length - 1];
        const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
        await closeExecution(exec.id, exitPrice);
        orderFlashMapRef.current.set(exec.id, performance.now());
        manager.markDirty('overlays');
      } catch (error) {
        toastError(t('trading.order.closeFailed'), error instanceof Error ? error.message : undefined);
      } finally {
        closingSnapshotsRef.current.delete(exec.id);
        setClosingVersion(v => v + 1);
        orderLoadingMapRef.current.delete(exec.id);
        manager.markDirty('overlays');
      }
    }
  }, [manager, allExecutions, closeExecution, cancelProtectionOrder, toastError, t, applyOptimistic, clearOptimistic, orderLoadingMapRef, orderFlashMapRef, closingSnapshotsRef, setClosingVersion]);

  const handleUpdateOrder = useCallback((id: string, updates: Partial<Order>) => {
    if (!id) return;

    if (id.startsWith('exchange-') && updates.entryPrice !== undefined && backendWalletId && symbol) {
      const isAlgo = id.startsWith('exchange-algo-');
      const exchangeOrderId = id.replace(/^exchange-(order|algo)-/, '');
      if (!exchangeOrderId) return;

      const exec = allExecutions.find(e => e.id === id);
      if (!exec) return;

      const newPrice = roundTradingPrice(updates.entryPrice).toString();
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(id, cancelPatches, { status: 'pending' });
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      const optimisticId = `opt-exchange-${Date.now()}`;
      setOptimisticExecutions(prev => [...prev, {
        id: optimisticId,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: newPrice,
        quantity: exec.quantity,
        stopLoss: null,
        takeProfit: null,
        status: 'pending',
        setupType: null,
        marketType: exec.marketType ?? 'FUTURES',
        openedAt: new Date(),
        entryOrderType: exec.entryOrderType,
      }]);

      const side = exec.side === 'LONG' ? 'BUY' as const : 'SELL' as const;
      const orderType = isAlgo
        ? (exec.entryOrderType as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET') ?? 'STOP_MARKET' as const
        : 'LIMIT' as const;

      cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: exchangeOrderId })
        .then(() => addBackendOrder({
          walletId: backendWalletId,
          symbol,
          side,
          type: orderType,
          quantity: exec.quantity,
          ...(isAlgo ? { stopPrice: newPrice } : { price: newPrice }),
          reduceOnly: true,
        }))
        .then(() => {
          orderFlashMapRef.current.set(optimisticId, performance.now());
          manager?.markDirty('overlays');
        })
        .catch((error) => {
          clearOptimistic(id, cancelPatches);
          setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticId));
          toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
        })
        .finally(() => {
          orderLoadingMapRef.current.delete(id);
          manager?.markDirty('overlays');
        });
      return;
    }

    if (updates.entryPrice !== undefined) {
      const exec = allExecutions.find(e => e.id === id);
      const newPrice = roundTradingPrice(updates.entryPrice).toString();
      const prevValues = { entryPrice: exec?.entryPrice };
      const patches = { entryPrice: newPrice };
      applyOptimistic(id, patches, prevValues);
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      updatePendingEntry({ id, newPrice: updates.entryPrice }).then(() => {
        orderFlashMapRef.current.set(id, performance.now());
      }).catch((error) => {
        clearOptimistic(id, patches);
        toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(id);
        manager?.markDirty('overlays');
      });
      return;
    }

    const updatePayload: { stopLoss?: number; takeProfit?: number } = {};
    if (updates.stopLoss !== undefined) updatePayload.stopLoss = updates.stopLoss;
    if (updates.takeProfit !== undefined) updatePayload.takeProfit = updates.takeProfit;

    if (Object.keys(updatePayload).length > 0) {
      const exec = allExecutions.find(e => e.id === id);
      const patches: OptimisticOverride['patches'] = {};
      const prevValues: OptimisticOverride['previousValues'] = {};
      let flashKey = id;

      if (updatePayload.stopLoss !== undefined) {
        patches.stopLoss = updatePayload.stopLoss.toString();
        prevValues.stopLoss = exec?.stopLoss;
        flashKey = `${id}-sl`;
      }
      if (updatePayload.takeProfit !== undefined) {
        patches.takeProfit = updatePayload.takeProfit.toString();
        prevValues.takeProfit = exec?.takeProfit;
        flashKey = `${id}-tp`;
      }

      applyOptimistic(id, patches, prevValues);
      orderLoadingMapRef.current.set(id, Date.now());
      manager?.markDirty('overlays');

      updateExecutionSLTP(id, updatePayload).then(() => {
        orderFlashMapRef.current.set(flashKey, performance.now());
      }).catch((error) => {
        clearOptimistic(id, patches);
        toastError(t('trading.order.slTpUpdateFailed'), error instanceof Error ? error.message : undefined);
      }).finally(() => {
        orderLoadingMapRef.current.delete(id);
        manager?.markDirty('overlays');
      });
    }
  }, [updateExecutionSLTP, updatePendingEntry, manager, backendWalletId, symbol, allExecutions, cancelFuturesOrderMutation, addBackendOrder, toastError, t, applyOptimistic, clearOptimistic, orderLoadingMapRef, orderFlashMapRef, setOptimisticExecutions]);

  const handleGridConfirm = useCallback(async (prices: number[], side: 'BUY' | 'SELL') => {
    if (!backendWalletId || !symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const gridSide = side === 'BUY' ? 'LONG' as const : 'SHORT' as const;
    const optimisticIds: string[] = [];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i]!;
      const quantity = getOrderQuantity(price);
      if (!quantity || parseFloat(quantity) <= 0) continue;

      const optId = `opt-grid-${Date.now()}-${i}`;
      optimisticIds.push(optId);
      setOptimisticExecutions(prev => [...prev, {
        id: optId,
        symbol,
        side: gridSide,
        entryPrice: roundTradingPrice(price),
        quantity,
        stopLoss: null,
        takeProfit: null,
        status: 'pending',
        setupType: null,
        marketType: marketType || 'FUTURES',
        openedAt: new Date(),
        triggerKlineOpenTime: null,
        fibonacciProjection: null,
      }]);
      orderLoadingMapRef.current.set(optId, Date.now());
    }
    manager?.markDirty('overlays');

    let idx = 0;
    for (const price of prices) {
      const quantity = getOrderQuantity(price);
      if (!quantity || parseFloat(quantity) <= 0) continue;

      const optId = optimisticIds[idx]!;
      idx++;

      try {
        await submitEntryOrder({
          backendWalletId, symbol, side, price, marketPrice,
          quantity, reduceOnly: false, addBackendOrder,
        });
        orderFlashMapRef.current.set(optId, performance.now());
        orderLoadingMapRef.current.delete(optId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toastError(t('trading.order.failed'), msg);
        const remainingIds = optimisticIds.slice(idx - 1);
        setOptimisticExecutions(prev => prev.filter(e => !remainingIds.includes(e.id)));
        remainingIds.forEach(id => orderLoadingMapRef.current.delete(id));
        break;
      }
    }
    manager?.markDirty('overlays');

    utils.autoTrading.getActiveExecutions.invalidate();
  }, [backendWalletId, symbol, marketType, getOrderQuantity, addBackendOrder, utils, manager, toastError, t, orderLoadingMapRef, orderFlashMapRef, setOptimisticExecutions, latestKlinesPriceRef]);

  const draggableOrders = useMemo((): Order[] =>
    allExecutions
      .filter(exec => exec.status === 'open' || exec.status === 'pending')
      .map(exec => mapExecutionToOrder(exec, backendWalletId ?? '')),
  [allExecutions, backendWalletId]);

  return {
    handleLongEntry,
    handleShortEntry,
    handleOrderCloseRequest,
    handleConfirmCloseOrder,
    handleUpdateOrder,
    handleGridConfirm,
    getOrderQuantity,
    draggableOrders,
    toastError,
    warning,
    updateExecutionSLTP,
    updateTsConfig,
  };
};
