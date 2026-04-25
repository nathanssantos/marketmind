import { trpc } from '@renderer/utils/trpc';
import { useToast } from '@renderer/hooks/useToast';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DirectionMode } from '../WatchersList';

export const useWatcherConfig = (walletId: string) => {
  const { t } = useTranslation();
  const { success, info } = useToast();
  const utils = trpc.useUtils();

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId, staleTime: 30_000 }
  );

  const lastSentBatchRef = useRef<Record<string, unknown>>({});

  const updateConfig = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => {
      if (Object.keys(pendingUpdates.current).length === 0) {
        void utils.autoTrading.getConfig.invalidate({ walletId });
      }
      const sent = lastSentBatchRef.current;
      if ('trailingStopEnabled' in sent) {
        const enabled = sent['trailingStopEnabled'];
        const key = enabled ? 'trailingStopEnabled' : 'trailingStopDisabled';
        (enabled ? success : info)(t(`positionTrailingStop.${key}`, { symbol: t('watcherManager.trailingStop.global') }));
      }
      lastSentBatchRef.current = {};
    },
  });

  const mutateRef = useRef(updateConfig.mutate);
  mutateRef.current = updateConfig.mutate;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingUpdates = useRef<Record<string, unknown>>({});

  const handleConfigUpdate = useCallback((updates: Record<string, unknown>): void => {
    if (!walletId) return;
    void utils.autoTrading.getConfig.cancel({ walletId });
    utils.autoTrading.getConfig.setData({ walletId }, (old) =>
      old ? { ...old, ...updates } : old
    );
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const batch = pendingUpdates.current;
      pendingUpdates.current = {};
      lastSentBatchRef.current = { ...batch };
      mutateRef.current({ walletId, ...batch });
    }, 300);
  }, [walletId, utils]);

  const handleTpModeChange = (details: { value: string }): void => {
    handleConfigUpdate({ tpCalculationMode: details.value });
  };

  const handleFibonacciLevelLongChange = (details: { value: string }): void => {
    handleConfigUpdate({ fibonacciTargetLevelLong: details.value });
  };

  const handleFibonacciLevelShortChange = (details: { value: string }): void => {
    handleConfigUpdate({ fibonacciTargetLevelShort: details.value });
  };

  const handleFibonacciSwingRangeChange = (details: { value: string }): void => {
    handleConfigUpdate({ fibonacciSwingRange: details.value });
  };

  const handleInitialStopModeChange = (details: { value: string }): void => {
    handleConfigUpdate({ initialStopMode: details.value });
  };

  const handleFilterToggle = (filterKey: string, value: boolean): void => {
    handleConfigUpdate({ [filterKey]: value });
  };

  const handleDirectionModeChange = (mode: DirectionMode): void => {
    handleConfigUpdate({ directionMode: mode });
  };

  const handleAutoRotationToggle = (value: boolean): void => {
    handleConfigUpdate({ enableAutoRotation: value });
  };

  const handleLeverageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const leverage = parseInt(e.target.value, 10);
    if (isNaN(leverage) || leverage < 1 || leverage > 125) return;
    handleConfigUpdate({ leverage });
  };

  const handleMaxDrawdownEnabledChange = (enabled: boolean): void => {
    handleConfigUpdate({ maxDrawdownEnabled: enabled });
  };

  const handleMaxDrawdownChange = (value: number): void => {
    handleConfigUpdate({ maxDrawdownPercent: value.toString() });
  };

  const handleMaxRiskPerStopEnabledChange = (enabled: boolean): void => {
    handleConfigUpdate({ maxRiskPerStopEnabled: enabled });
  };

  const handleMaxRiskPerStopChange = (value: number): void => {
    handleConfigUpdate({ maxRiskPerStopPercent: value.toString() });
  };

  const handleMarginTopUpEnabledChange = (enabled: boolean): void => {
    handleConfigUpdate({ marginTopUpEnabled: enabled });
  };

  const handleMarginTopUpThresholdChange = (value: number): void => {
    handleConfigUpdate({ marginTopUpThreshold: value.toString() });
  };

  const handleMarginTopUpPercentChange = (value: number): void => {
    handleConfigUpdate({ marginTopUpPercent: value.toString() });
  };

  const handleMarginTopUpMaxCountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < 1 || count > 10) return;
    handleConfigUpdate({ marginTopUpMaxCount: count });
  };

  const handleConfluenceMinScoreChange = (value: number): void => {
    handleConfigUpdate({ confluenceMinScore: value });
  };

  const handleTradingModeChange = (mode: 'auto' | 'semi_assisted'): void => {
    handleConfigUpdate({ tradingMode: mode });
  };

  return {
    config,
    updateConfig,
    handleConfigUpdate,
    handleTpModeChange,
    handleFibonacciLevelLongChange,
    handleFibonacciLevelShortChange,
    handleFibonacciSwingRangeChange,
    handleInitialStopModeChange,
    handleFilterToggle,
    handleDirectionModeChange,
    handleAutoRotationToggle,
    handleLeverageChange,
    handleMaxDrawdownEnabledChange,
    handleMaxDrawdownChange,
    handleMaxRiskPerStopEnabledChange,
    handleMaxRiskPerStopChange,
    handleMarginTopUpEnabledChange,
    handleMarginTopUpThresholdChange,
    handleMarginTopUpPercentChange,
    handleMarginTopUpMaxCountChange,
    handleConfluenceMinScoreChange,
    handleTradingModeChange,
  };
};
