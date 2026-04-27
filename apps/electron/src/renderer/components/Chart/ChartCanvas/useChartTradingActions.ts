import type { MarketType, Order } from '@marketmind/types';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useOrderQuantity } from '@renderer/hooks/useOrderQuantity';
import { useToast } from '@renderer/hooks/useToast';
import { trpc } from '@renderer/utils/trpc';
import { ORDER_LINE_ANIMATION } from '@shared/constants';
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
} from './chartOrderHelpers';
import { parseCloseTarget } from './closeOrderTargetParser';
import { buildExchangeMoveRequest } from './exchangeMoveBuilder';

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
        void utils.trading.getTradeExecutions.invalidate();
      }
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenDbOrderIds.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
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

  const { getQuantity: getOrderQuantity } = useOrderQuantity(symbol, marketType);

  const handleLongEntry = useCallback(async (price: number) => {
    if (!backendWalletId) { warning(t('trading.ticket.noWallet')); return; }
    if (!symbol) return;

    const marketPrice = latestKlinesPriceRef.current;
    const hasOpenShort = (backendExecutions ?? []).some(
      (e) => e.symbol === symbol && e.side === 'SHORT' && e.status === 'open'
    );

    const optimisticId = createOptimisticEntry({
      symbol, side: 'LONG', price, marketType: marketType ?? 'FUTURES',
      getOrderQuantity, setOptimisticExecutions, orderLoadingMapRef, manager,
    });

    try {
      await submitEntryOrder({
        backendWalletId, symbol, side: 'BUY', price, marketPrice,
        quantity: getOrderQuantity(price), reduceOnly: hasOpenShort, addBackendOrder,
      });
      void utils.autoTrading.getActiveExecutions.invalidate();
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
      symbol, side: 'SHORT', price, marketType: marketType ?? 'FUTURES',
      getOrderQuantity, setOptimisticExecutions, orderLoadingMapRef, manager,
    });

    try {
      await submitEntryOrder({
        backendWalletId, symbol, side: 'SELL', price, marketPrice,
        quantity: getOrderQuantity(price), reduceOnly: hasOpenLong, addBackendOrder,
      });
      void utils.autoTrading.getActiveExecutions.invalidate();
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
    const target = parseCloseTarget(orderId);

    switch (target.kind) {
      case 'modal-clear':
        setOrderToClose(null);
        return;

      case 'ts-disable':
        if (!backendWalletId || !symbol) return;
        updateTsConfig.mutate({
          walletId: backendWalletId,
          symbol,
          useIndividualConfig: true,
          trailingStopEnabled: false,
        });
        return;

      case 'sltp':
        // Routed to the close-confirm modal — the actual cancel happens in
        // handleConfirmCloseOrder so the user sees the SL/TP type + position
        // before committing.
        if (orderId) setOrderToClose(orderId);
        return;

      case 'exchange': {
        if (!backendWalletId || !symbol || !target.exchangeOrderId) return;
        const cancelPatches = { status: 'cancelled' as const };
        // Flash up-front so the user sees a deliberate cancel pulse while
        // the order is still rendered (loading bypasses the cancelled
        // filter). Deferred finally lets the flash play out.
        orderFlashMapRef.current.set(target.rawId, performance.now());
        applyOptimistic(target.rawId, cancelPatches, { status: 'pending' });
        orderLoadingMapRef.current.set(target.rawId, Date.now());
        manager?.markDirty('overlays');
        cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: target.exchangeOrderId })
          .then(() => {
            manager?.markDirty('overlays');
          })
          .catch((error) => {
            clearOptimistic(target.rawId, cancelPatches);
            toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
          })
          .finally(() => {
            setTimeout(() => {
              orderLoadingMapRef.current.delete(target.rawId);
              manager?.markDirty('overlays');
            }, ORDER_LINE_ANIMATION.FLASH_DURATION_MS);
          });
        return;
      }

      case 'execution': {
        const exec = allExecutions.find((e) => e.id === target.executionId);
        if (!exec) return;
        if (exec.status === 'pending') {
          const cancelPatches = { status: 'cancelled' as const };
          orderFlashMapRef.current.set(exec.id, performance.now());
          applyOptimistic(exec.id, cancelPatches, { status: exec.status });
          orderLoadingMapRef.current.set(exec.id, Date.now());
          manager?.markDirty('overlays');
          cancelExecution(exec.id).then(() => {
            manager?.markDirty('overlays');
          }).catch((error: unknown) => {
            clearOptimistic(exec.id, cancelPatches);
            toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
          }).finally(() => {
            setTimeout(() => {
              orderLoadingMapRef.current.delete(exec.id);
              manager?.markDirty('overlays');
            }, ORDER_LINE_ANIMATION.FLASH_DURATION_MS);
          });
          return;
        }
        setOrderToClose(target.executionId);
        return;
      }
    }
  }, [allExecutions, cancelExecution, setOrderToClose, manager, backendWalletId, symbol, cancelFuturesOrderMutation, applyOptimistic, clearOptimistic, toastError, t, updateTsConfig, orderLoadingMapRef, orderFlashMapRef]);

  const handleConfirmCloseOrder = useCallback(async (orderToClose: string | null): Promise<void> => {
    if (!orderToClose || !manager) return;

    // Dismiss the modal immediately on confirm. The order itself stays
    // visible at its current position with the X-button in loading state
    // until the backend ACKs (orderLoadingMapRef + closingSnapshotsRef).
    setOrderToClose(null);

    if (orderToClose.startsWith('sltp:')) {
      const firstColon = orderToClose.indexOf(':');
      const secondColon = orderToClose.indexOf(':', firstColon + 1);
      const type = orderToClose.substring(firstColon + 1, secondColon) as 'stopLoss' | 'takeProfit';
      const executionIds = orderToClose.substring(secondColon + 1).split(',').filter(Boolean);

      if (executionIds.length > 0) {
        const patchField = type === 'stopLoss' ? 'stopLoss' : 'takeProfit';
        const flashSuffix = type === 'stopLoss' ? 'sl' : 'tp';

        // Fire the white flash on the SL/TP price tags BEFORE the optimistic
        // null-out so the user sees a deliberate cancel feedback while the
        // tags are still rendered. Then apply the optimistic patch — the
        // flash continues to play out via needsAnimation while loading is
        // bypassing the cancelled-status filter.
        executionIds.forEach(id => {
          orderFlashMapRef.current.set(`${id}-${flashSuffix}`, performance.now());
        });

        executionIds.forEach(id => {
          const exec = allExecutions.find(e => e.id === id);
          applyOptimistic(id, { [patchField]: null }, { [patchField]: exec?.[patchField] });
          orderLoadingMapRef.current.set(id, Date.now());
        });
        manager.markDirty('overlays');
        try {
          await cancelProtectionOrder(executionIds, type);
        } catch (error) {
          executionIds.forEach(id => clearOptimistic(id, { [patchField]: null }));
          toastError(t('trading.order.cancelFailed'), error instanceof Error ? error.message : undefined);
        } finally {
          // Defer the loading-clear so the flash gets to play out instead of
          // being yanked off-screen the same tick the mutation resolves.
          setTimeout(() => {
            executionIds.forEach(id => orderLoadingMapRef.current.delete(id));
            manager.markDirty('overlays');
          }, ORDER_LINE_ANIMATION.FLASH_DURATION_MS);
        }
      }

      return;
    }

    const exec = allExecutions.find((e) => e.id === orderToClose);
    if (exec) {
      // Flash kicks in immediately — order is still rendered (real cache +
      // snapshot for safety), so the white pulse is visible while the
      // backend close is in flight. Snapshot keeps the order on-screen
      // through the cache invalidation; deferred cleanup gives the flash
      // a full FLASH_DURATION_MS to play out before the order vanishes.
      orderFlashMapRef.current.set(exec.id, performance.now());
      closingSnapshotsRef.current.set(exec.id, exec);
      setClosingVersion(v => v + 1);
      orderLoadingMapRef.current.set(exec.id, Date.now());
      manager.markDirty('overlays');
      try {
        const klines = manager.getKlines();
        const lastKline = klines[klines.length - 1];
        const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
        await closeExecution(exec.id, exitPrice);
        manager.markDirty('overlays');
      } catch (error) {
        toastError(t('trading.order.closeFailed'), error instanceof Error ? error.message : undefined);
      } finally {
        setTimeout(() => {
          closingSnapshotsRef.current.delete(exec.id);
          setClosingVersion(v => v + 1);
          orderLoadingMapRef.current.delete(exec.id);
          manager.markDirty('overlays');
        }, ORDER_LINE_ANIMATION.FLASH_DURATION_MS);
      }
    }
  }, [manager, allExecutions, closeExecution, cancelProtectionOrder, toastError, t, applyOptimistic, clearOptimistic, orderLoadingMapRef, orderFlashMapRef, closingSnapshotsRef, setClosingVersion, setOrderToClose]);

  const handleUpdateOrder = useCallback((id: string, updates: Partial<Order>) => {
    if (!id) return;

    if (id.startsWith('exchange-') && updates.entryPrice !== undefined && backendWalletId && symbol) {
      const isAlgo = id.startsWith('exchange-algo-');
      const exchangeOrderId = id.replace(/^exchange-(order|algo)-/, '');
      if (!exchangeOrderId) return;

      const exec = allExecutions.find(e => e.id === id);
      if (!exec) return;

      const newPrice = roundTradingPrice(updates.entryPrice).toString();
      const { optimisticExecution, newOrderRequest } = buildExchangeMoveRequest(
        { symbol: exec.symbol, side: exec.side, quantity: exec.quantity, marketType: exec.marketType, entryOrderType: exec.entryOrderType },
        newPrice,
        isAlgo,
      );

      // Move = backend cancel + create. The OLD id should disappear from
      // the chart immediately (loading flag NOT set on it — would bypass
      // the cancelled-status filter and render a duplicate next to the
      // new optimistic). The NEW optimistic at the new price IS the
      // user-visible "moving" order, with its own loading + flash keys.
      const cancelPatches = { status: 'cancelled' as const };
      applyOptimistic(id, cancelPatches, { status: 'pending' });

      setOptimisticExecutions(prev => [...prev, optimisticExecution]);
      orderLoadingMapRef.current.set(optimisticExecution.id, Date.now());
      manager?.markDirty('overlays');

      cancelFuturesOrderMutation.mutateAsync({ walletId: backendWalletId, symbol, orderId: exchangeOrderId })
        .then(() => addBackendOrder({
          walletId: backendWalletId,
          symbol,
          ...newOrderRequest,
        }))
        .then(() => {
          orderFlashMapRef.current.set(optimisticExecution.id, performance.now());
          manager?.markDirty('overlays');
        })
        .catch((error) => {
          clearOptimistic(id, cancelPatches);
          setOptimisticExecutions(prev => prev.filter(e => e.id !== optimisticExecution.id));
          toastError(t('trading.order.entryUpdateFailed'), error instanceof Error ? error.message : undefined);
        })
        .finally(() => {
          orderLoadingMapRef.current.delete(optimisticExecution.id);
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
        marketType: marketType ?? 'FUTURES',
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

    void utils.autoTrading.getActiveExecutions.invalidate();
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
