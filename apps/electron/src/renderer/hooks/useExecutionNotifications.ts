import type { PositionSide } from '@marketmind/types';
import { useBackendAutoTrading } from './useBackendAutoTrading';
import { useBackendWallet } from './useBackendWallet';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from './useNotification';
import { useToast } from './useToast';

interface ExecutionState {
  id: string;
  status: string;
  stopLoss: string | null;
  exitReason?: string | null;
  pnl?: string | null;
  pnlPercent?: string | null;
  symbol: string;
  side: PositionSide;
  entryPrice: string;
  exitPrice?: string | null;
  quantity: string;
}

export const useExecutionNotifications = () => {
  const { t } = useTranslation();
  const { persistentSuccess, persistentError, persistentInfo, persistentWarning } = useToast();
  const { showNotification, isSupported } = useNotification();

  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id;
  const { activeExecutions, executionHistory } = useBackendAutoTrading(activeWalletId || '');

  const allExecutions = useMemo(() => {
    return [...activeExecutions, ...executionHistory];
  }, [activeExecutions, executionHistory]);

  const executionStateMap = useMemo(() => {
    const map = new Map<string, ExecutionState>();
    for (const exec of allExecutions) {
      map.set(exec.id, {
        id: exec.id,
        status: exec.status || 'open',
        stopLoss: exec.stopLoss,
        exitReason: exec.exitReason,
        pnl: exec.pnl,
        pnlPercent: exec.pnlPercent,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: exec.entryPrice,
        exitPrice: exec.exitPrice,
        quantity: exec.quantity,
      });
    }
    return map;
  }, [allExecutions]);

  const prevExecutionsRef = useRef<Map<string, ExecutionState>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    const prevExecutions = prevExecutionsRef.current;

    if (!initializedRef.current && executionStateMap.size > 0) {
      initializedRef.current = true;
      prevExecutionsRef.current = new Map(executionStateMap);
      return;
    }

    if (!initializedRef.current) return;

    executionStateMap.forEach((current, execId) => {
      const prev = prevExecutions.get(execId);

      if (!prev) {
        handleNewExecution(current);
        return;
      }

      if (prev.status === 'open' && current.status === 'closed') {
        handlePositionClosed(current);
        return;
      }

      if (
        prev.status === 'open' &&
        current.status === 'open' &&
        prev.stopLoss !== current.stopLoss &&
        current.stopLoss !== null
      ) {
        handleTrailingStopUpdate(current, prev.stopLoss);
      }
    });

    prevExecutionsRef.current = new Map(executionStateMap);
  }, [executionStateMap, t, persistentSuccess, persistentError, persistentInfo, persistentWarning]);

  const formatPrice = (price: string | number): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (numPrice >= 1000) return numPrice.toFixed(2);
    if (numPrice >= 1) return numPrice.toFixed(4);
    return numPrice.toFixed(6);
  };

  const handleNewExecution = (exec: ExecutionState) => {
    const isLong = exec.side === 'LONG';
    const sideLabel = t(`trading.ticket.${isLong ? 'long' : 'short'}`);
    const title = t('trading.notifications.positionOpened.title');
    const body = t('trading.notifications.positionOpened.body', {
      side: sideLabel,
      symbol: exec.symbol,
      price: formatPrice(exec.entryPrice),
      quantity: parseFloat(exec.quantity).toFixed(4),
    });

    persistentSuccess(title, body);

    if (isSupported) {
      void showNotification({
        title,
        body,
        urgency: 'normal',
      });
    }
  };

  const handlePositionClosed = (exec: ExecutionState) => {
    const isLong = exec.side === 'LONG';
    const sideLabel = t(`trading.ticket.${isLong ? 'long' : 'short'}`);
    const pnl = parseFloat(exec.pnl || '0');
    const pnlPercent = parseFloat(exec.pnlPercent || '0');
    const isProfit = pnl >= 0;

    let title: string;
    let reasonLabel: string;

    switch (exec.exitReason) {
      case 'STOP_LOSS':
        title = isProfit
          ? t('trading.notifications.stopLossProfit.title')
          : t('trading.notifications.stopLossLoss.title');
        reasonLabel = t('trading.notifications.exitReasons.stopLoss');
        break;
      case 'TAKE_PROFIT':
        title = t('trading.notifications.takeProfit.title');
        reasonLabel = t('trading.notifications.exitReasons.takeProfit');
        break;
      default:
        title = isProfit
          ? t('trading.notifications.positionClosedProfit.title')
          : t('trading.notifications.positionClosedLoss.title');
        reasonLabel = t('trading.notifications.exitReasons.manual');
    }

    const body = t('trading.notifications.positionClosed.body', {
      side: sideLabel,
      symbol: exec.symbol,
      entryPrice: formatPrice(exec.entryPrice),
      exitPrice: formatPrice(exec.exitPrice || '0'),
      pnl: pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2),
      pnlPercent: pnlPercent >= 0 ? `+${pnlPercent.toFixed(2)}` : pnlPercent.toFixed(2),
      reason: reasonLabel,
    });

    if (isProfit) {
      persistentSuccess(title, body);
    } else {
      persistentError(title, body);
    }

    if (isSupported) {
      void showNotification({
        title,
        body,
        urgency: 'critical',
      });
    }
  };

  const handleTrailingStopUpdate = (exec: ExecutionState, oldStopLoss: string | null) => {
    const isLong = exec.side === 'LONG';
    const sideLabel = t(`trading.ticket.${isLong ? 'long' : 'short'}`);
    const title = t('trading.notifications.trailingStopUpdated.title');
    const body = t('trading.notifications.trailingStopUpdated.body', {
      side: sideLabel,
      symbol: exec.symbol,
      oldStop: oldStopLoss ? formatPrice(oldStopLoss) : '-',
      newStop: formatPrice(exec.stopLoss!),
    });

    persistentInfo(title, body);

    if (isSupported) {
      void showNotification({
        title,
        body,
        urgency: 'low',
      });
    }
  };

  return null;
};
