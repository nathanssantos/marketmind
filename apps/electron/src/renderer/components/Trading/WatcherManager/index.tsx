import { Box, Separator, Stack, Text } from '@chakra-ui/react';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { useBackendAutoTrading, useCapitalLimits, useFilteredSymbolsForQuickStart, useRotationStatus, useTriggerRotation } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AddWatcherDialog } from '../AddWatcherDialog';
import { DynamicSymbolRankings } from '../DynamicSymbolRankings';
import { TradingProfilesManager } from '../TradingProfilesManager';
import { DynamicSelectionSection } from './DynamicSelectionSection';
import { EmergencyStopSection } from './EmergencyStopSection';
import { FiltersSection } from './FiltersSection';
import { useWatcherState } from './hooks/useWatcherState';
import { LeverageSettingsSection } from './LeverageSettingsSection';
import { OpportunityCostSection } from './OpportunityCostSection';
import { PyramidingSection } from './PyramidingSection';
import { TrailingStopSection } from './TrailingStopSection';
import { TpModeSection } from './TpModeSection';
import { WatchersList } from './WatchersList';

export const WatcherManager = () => {
  const { t } = useTranslation();
  const { wallets } = useBackendWallet();
  const walletId = wallets[0]?.id ?? '';

  const {
    watcherStatus,
    isLoadingWatcherStatus,
    stopWatcher,
    stopAllWatchers,
    startWatchersBulk,
    isStoppingWatcher,
    isStoppingAllWatchers,
    isStartingWatchersBulk,
    emergencyStop,
    isEmergencyStopping,
  } = useBackendAutoTrading(walletId);

  const { profiles, getProfileById } = useTradingProfiles();

  const { data: config, refetch } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId }
  );

  const updateConfig = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => refetch(),
  });

  const {
    expandedSections,
    toggleSection,
    quickStartCount,
    setQuickStartCount,
    quickStartTimeframe,
    setQuickStartTimeframe,
    quickStartMarketType,
    setQuickStartMarketType,
    showAddDialog,
    setShowAddDialog,
    showRankingsDialog,
    setShowRankingsDialog,
    showEmergencyConfirm,
    setShowEmergencyConfirm,
  } = useWatcherState();

  const { rotationStatus, isLoadingRotationStatus } = useRotationStatus(walletId);
  const { triggerRotation, isTriggeringRotation } = useTriggerRotation(walletId);

  const { capitalLimits, formatCapitalTooltip, isLoadingCapitalLimits } = useCapitalLimits(walletId, quickStartMarketType);

  const useTrendFilter = config?.useTrendFilter ?? true;

  const {
    filteredSymbols: quickStartSymbols,
    maxAffordableWatchers: filteredMaxAffordable,
    isLoadingFiltered,
    btcTrend,
    skippedTrend,
  } = useFilteredSymbolsForQuickStart(walletId, quickStartMarketType, quickStartTimeframe, quickStartCount, useTrendFilter);

  const maxAffordableWatchers = capitalLimits?.maxAffordableWatchers ?? filteredMaxAffordable ?? AUTO_TRADING_CONFIG.TARGET_COUNT.MAX;
  const effectiveMax = Math.min(maxAffordableWatchers, AUTO_TRADING_CONFIG.TARGET_COUNT.MAX);
  const isLoadingMax = isLoadingCapitalLimits || isLoadingFiltered;

  useEffect(() => {
    if (maxAffordableWatchers > 0) setQuickStartCount(Math.min(effectiveMax, quickStartCount || effectiveMax));
  }, [maxAffordableWatchers, effectiveMax]);

  const { data: btcTrendStatus } = trpc.autoTrading.getBtcTrendStatus.useQuery(undefined, {
    enabled: config?.useBtcCorrelationFilter === true,
    staleTime: 60000,
  });

  const { data: fundingRates } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: quickStartSymbols },
    {
      enabled: quickStartMarketType === 'FUTURES' && config?.useFundingFilter === true && quickStartSymbols.length > 0,
      staleTime: 60000,
    }
  );

  const filteredSymbols = useMemo(() => {
    const extremeSymbols = new Set(
      quickStartMarketType === 'FUTURES' && config?.useFundingFilter && fundingRates
        ? fundingRates.filter((f) => f.isExtreme).map((f) => f.symbol)
        : []
    );

    return quickStartSymbols.filter(symbol => !extremeSymbols.has(symbol));
  }, [quickStartSymbols, fundingRates, config?.useFundingFilter, quickStartMarketType]);

  const tpCalculationMode = config?.tpCalculationMode ?? 'default';
  const fibonacciTargetLevel = config?.fibonacciTargetLevel ?? 'auto';

  const handleTpModeChange = (details: { value: string }): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      tpCalculationMode: details.value as 'default' | 'fibonacci',
    });
  };

  const handleFibonacciLevelChange = (details: { value: string }): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      fibonacciTargetLevel: details.value as 'auto' | '1' | '1.272' | '1.618' | '2' | '2.618',
    });
  };

  const handleFilterToggle = (filterKey: string, value: boolean): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      [filterKey]: value,
    });
  };

  const handleDynamicSelectionToggle = (value: boolean): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      useDynamicSymbolSelection: value,
    });
  };

  const handleAutoRotationToggle = (value: boolean): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      enableAutoRotation: value,
    });
  };

  const handleLeverageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!walletId) return;
    const leverage = parseInt(e.target.value, 10);
    if (isNaN(leverage) || leverage < 1 || leverage > 125) return;
    updateConfig.mutate({
      walletId,
      leverage,
    });
  };

  const handleMarginTypeChange = (value: 'ISOLATED' | 'CROSSED'): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      marginType: value,
    });
  };

  const handleTriggerRotation = async (): Promise<void> => {
    if (!walletId) return;
    await triggerRotation();
  };

  const handleQuickStartFromRankings = async (): Promise<void> => {
    if (!walletId || filteredSymbols.length === 0) return;
    await startWatchersBulk(filteredSymbols, quickStartTimeframe, undefined, quickStartMarketType, quickStartCount);
  };

  const activeWatchers = watcherStatus?.activeWatchers ?? [];
  const persistedWatchers = watcherStatus?.persistedWatchers ?? 0;

  const handleStopWatcher = async (symbol: string, interval: string, marketType?: 'SPOT' | 'FUTURES') => {
    await stopWatcher(symbol, interval, marketType);
  };

  const handleStopAll = async () => {
    await stopAllWatchers();
  };

  const handleEmergencyStop = async () => {
    await emergencyStop();
    setShowEmergencyConfirm(false);
  };

  const handleConfigUpdate = (updates: Record<string, unknown>): void => {
    if (!walletId) return;
    updateConfig.mutate({ walletId, ...updates });
  };

  if (!walletId) {
    return (
      <Box p={4} textAlign="center">
        <Text fontSize="sm" color="fg.muted">
          {t('tradingProfiles.noWallet')}
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={4}>
      <EmergencyStopSection
        showConfirm={showEmergencyConfirm}
        onShowConfirm={() => setShowEmergencyConfirm(true)}
        onHideConfirm={() => setShowEmergencyConfirm(false)}
        onEmergencyStop={handleEmergencyStop}
        isEmergencyStopping={isEmergencyStopping}
        hasActiveWatchers={activeWatchers.length > 0 || persistedWatchers > 0}
      />

      <WatchersList
        activeWatchers={activeWatchers}
        persistedWatchers={persistedWatchers}
        isLoading={isLoadingWatcherStatus}
        isExpanded={expandedSections.watchers}
        onToggle={() => toggleSection('watchers')}
        onAddWatcher={() => setShowAddDialog(true)}
        onStopWatcher={handleStopWatcher}
        onStopAll={handleStopAll}
        isStoppingWatcher={isStoppingWatcher}
        isStoppingAll={isStoppingAllWatchers}
        getProfileById={getProfileById}
      />

      <Separator />

      <DynamicSelectionSection
        isExpanded={expandedSections.dynamicSelection}
        onToggle={() => toggleSection('dynamicSelection')}
        isDynamicSelectionEnabled={config?.useDynamicSymbolSelection ?? false}
        onDynamicSelectionToggle={handleDynamicSelectionToggle}
        isAutoRotationEnabled={config?.enableAutoRotation ?? true}
        onAutoRotationToggle={handleAutoRotationToggle}
        rotationStatus={rotationStatus}
        isLoadingRotationStatus={isLoadingRotationStatus}
        onTriggerRotation={handleTriggerRotation}
        isTriggeringRotation={isTriggeringRotation}
        quickStartMarketType={quickStartMarketType}
        quickStartTimeframe={quickStartTimeframe}
        quickStartCount={quickStartCount}
        effectiveMax={effectiveMax}
        isLoadingMax={isLoadingMax}
        filteredSymbolsCount={filteredSymbols.length}
        isLoadingFiltered={isLoadingFiltered}
        isStartingWatchersBulk={isStartingWatchersBulk}
        btcTrendStatus={btcTrendStatus}
        btcTrendInfo={btcTrend}
        skippedTrendCount={skippedTrend.length}
        showBtcTrend={useTrendFilter || config?.useBtcCorrelationFilter === true}
        formatCapitalTooltip={formatCapitalTooltip}
        onMarketTypeChange={setQuickStartMarketType}
        onTimeframeChange={setQuickStartTimeframe}
        onCountChange={setQuickStartCount}
        onQuickStart={handleQuickStartFromRankings}
        onViewRankings={() => setShowRankingsDialog(true)}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <TradingProfilesManager />

      <Separator />

      <LeverageSettingsSection
        isExpanded={expandedSections.leverageSettings}
        onToggle={() => toggleSection('leverageSettings')}
        leverage={config?.leverage ?? 1}
        marginType={config?.marginType ?? 'ISOLATED'}
        onLeverageChange={handleLeverageChange}
        onMarginTypeChange={handleMarginTypeChange}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <TrailingStopSection
        isExpanded={expandedSections.trailingStop}
        onToggle={() => toggleSection('trailingStop')}
        trailingStopEnabled={config?.trailingStopEnabled ?? true}
        onTrailingStopEnabledChange={(enabled) => handleConfigUpdate({ trailingStopEnabled: enabled })}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <TpModeSection
        isExpanded={expandedSections.tpMode}
        onToggle={() => toggleSection('tpMode')}
        tpCalculationMode={tpCalculationMode}
        fibonacciTargetLevel={fibonacciTargetLevel}
        onTpModeChange={handleTpModeChange}
        onFibonacciLevelChange={handleFibonacciLevelChange}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <FiltersSection
        isExpanded={expandedSections.filters}
        onToggle={() => toggleSection('filters')}
        config={config}
        onFilterToggle={handleFilterToggle}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <OpportunityCostSection
        isExpanded={expandedSections.opportunityCost}
        onToggle={() => toggleSection('opportunityCost')}
        config={config}
        walletId={walletId}
        onConfigUpdate={handleConfigUpdate}
        onFilterToggle={handleFilterToggle}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <PyramidingSection
        isExpanded={expandedSections.pyramiding}
        onToggle={() => toggleSection('pyramiding')}
        config={config}
        walletId={walletId}
        onConfigUpdate={handleConfigUpdate}
        onFilterToggle={handleFilterToggle}
        isPending={updateConfig.isPending}
      />

      <AddWatcherDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        walletId={walletId}
        profiles={profiles}
      />

      <DynamicSymbolRankings
        isOpen={showRankingsDialog}
        onClose={() => setShowRankingsDialog(false)}
      />
    </Stack>
  );
};

export { WatcherCardCompact } from './WatcherCardCompact';
export { FilterToggle } from './FilterToggle';
export type { ActiveWatcher, WatcherConfig } from './types';
