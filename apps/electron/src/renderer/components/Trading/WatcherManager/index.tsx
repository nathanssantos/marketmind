import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { Button, Separator } from '@renderer/components/ui';
import { useBackendAutoTrading, useCapitalLimits, useFilteredSymbolsForQuickStart, useRotationStatus, useTriggerRotation } from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { useTradingPref } from '@renderer/store/preferencesStore';
import { useMemo } from 'react';
import { useDebounce } from '@renderer/hooks/useDebounce';
import { useTranslation } from 'react-i18next';
import { AddWatcherDialog } from '../AddWatcherDialog';
import { DynamicSymbolRankings } from '../DynamicSymbolRankings';
import { DynamicSelectionSection } from './DynamicSelectionSection';
import { EmergencyStopSection } from './EmergencyStopSection';
import { EntrySettingsSection } from './EntrySettingsSection';
import { FiltersSection } from './FiltersSection';
import { useWatcherConfig } from './hooks/useWatcherConfig';
import { useWatcherState } from './hooks/useWatcherState';
import { LeverageSettingsSection } from './LeverageSettingsSection';
import { OpportunityCostSection } from './OpportunityCostSection';
import { PositionSizeSection } from './PositionSizeSection';
import { PyramidingSection } from './PyramidingSection';
import { RiskManagementSection } from './RiskManagementSection';
import { TrailingStopSection } from './TrailingStopSection';
import { TpModeSection } from './TpModeSection';
import { StopModeSection } from './StopModeSection';
import { WatchersList } from './WatchersList';
import { SetupToggleSection } from '../SetupToggleSection';

export const WatcherManager = () => {
  const { t } = useTranslation();
  const { activeWallet, isIB } = useActiveWallet();
  const walletId = activeWallet?.id ?? '';

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

  const {
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
  } = useWatcherConfig(walletId);

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
  const { formatCapitalTooltip } = useCapitalLimits(walletId, quickStartMarketType);

  const useBtcCorrelationFilter = config?.useBtcCorrelationFilter ?? false;
  const debouncedQuickStartCount = useDebounce(quickStartCount, 500);

  const {
    filteredSymbols: quickStartSymbols,
    maxAffordableWatchers: filteredMaxAffordable,
    isLoadingFiltered,
    btcTrend,
    skippedTrend,
  } = useFilteredSymbolsForQuickStart(walletId, quickStartMarketType, quickStartTimeframe, debouncedQuickStartCount, useBtcCorrelationFilter);

  const maxAffordableWatchers = filteredMaxAffordable ?? AUTO_TRADING_CONFIG.TARGET_COUNT.MAX;
  const effectiveMax = Math.min(maxAffordableWatchers, AUTO_TRADING_CONFIG.TARGET_COUNT.MAX);
  const isLoadingMax = isLoadingFiltered;

  const { data: btcTrendStatus } = trpc.autoTrading.getBtcTrendStatus.useQuery(
    { interval: quickStartTimeframe },
    {
      enabled: config?.useBtcCorrelationFilter === true,
      staleTime: 60000,
    }
  );

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
  const fibonacciTargetLevelLong = config?.fibonacciTargetLevelLong ?? config?.fibonacciTargetLevel ?? '3.618';
  const fibonacciTargetLevelShort = config?.fibonacciTargetLevelShort ?? config?.fibonacciTargetLevel ?? '1.272';
  const fibonacciSwingRange = config?.fibonacciSwingRange ?? 'nearest';
  const initialStopMode = config?.initialStopMode ?? 'fibo_target';

  const [dragSlEnabled, setDragSlEnabled] = useTradingPref<boolean>('dragSlEnabled', true);
  const [dragTpEnabled, setDragTpEnabled] = useTradingPref<boolean>('dragTpEnabled', true);
  const [slTightenOnly, setSlTightenOnly] = useTradingPref<boolean>('slTightenOnly', false);

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
  const directionMode = config?.directionMode ?? 'auto';
  const tradingMode = config?.tradingMode ?? 'auto';

  const handleStopWatcher = async (symbol: string, interval: string, marketType?: MarketType) => {
    await stopWatcher(symbol, interval, marketType);
  };

  const handleStopAll = async () => {
    await stopAllWatchers();
  };

  const handleEmergencyStop = async () => {
    await emergencyStop();
    setShowEmergencyConfirm(false);
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
        onEmergencyStop={() => { void handleEmergencyStop(); }}
        isEmergencyStopping={isEmergencyStopping}
        hasActiveWatchers={activeWatchers.length > 0 || persistedWatchers > 0}
      />

      <Box>
        <Text fontSize="xs" fontWeight="medium" mb={2}>{t('trading.mode.title')}</Text>
        <HStack gap={1}>
          <Button
            size="2xs"
            variant="outline"
            color={tradingMode === 'auto' ? 'blue.500' : 'fg.muted'}
            onClick={() => handleTradingModeChange('auto')}
            disabled={updateConfig.isPending}
            flex={1}
          >
            {t('trading.mode.auto')}
          </Button>
          <Button
            size="2xs"
            variant="outline"
            color={tradingMode === 'semi_assisted' ? 'yellow.500' : 'fg.muted'}
            onClick={() => handleTradingModeChange('semi_assisted')}
            disabled={updateConfig.isPending}
            flex={1}
          >
            {t('trading.mode.semiAssisted')}
          </Button>
        </HStack>
        <Text fontSize="2xs" color="fg.muted" mt={1}>
          {tradingMode === 'auto' ? t('trading.mode.autoDescription') : t('trading.mode.semiAssistedDescription')}
        </Text>
      </Box>

      <Separator />

      <WatchersList
        activeWatchers={activeWatchers}
        persistedWatchers={persistedWatchers}
        isLoading={isLoadingWatcherStatus}
        isExpanded={expandedSections.watchers}
        onToggle={() => toggleSection('watchers')}
        onAddWatcher={() => setShowAddDialog(true)}
        onStopWatcher={(symbol, interval, marketType) => { void handleStopWatcher(symbol, interval, marketType); }}
        onStopAll={() => { void handleStopAll(); }}
        isStoppingWatcher={isStoppingWatcher}
        isStoppingAll={isStoppingAllWatchers}
        getProfileById={getProfileById}
        directionMode={directionMode}
        onDirectionModeChange={handleDirectionModeChange}
        isPendingConfig={updateConfig.isPending}
      />

      <Separator />

      <DynamicSelectionSection
        isExpanded={expandedSections.dynamicSelection}
        onToggle={() => toggleSection('dynamicSelection')}
        isIB={isIB}
        directionMode={directionMode}
        isAutoRotationEnabled={config?.enableAutoRotation ?? true}
        onAutoRotationToggle={handleAutoRotationToggle}
        rotationStatus={rotationStatus}
        isLoadingRotationStatus={isLoadingRotationStatus}
        onTriggerRotation={() => { void handleTriggerRotation(); }}
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
        showBtcTrend={useBtcCorrelationFilter}
        formatCapitalTooltip={formatCapitalTooltip}
        onMarketTypeChange={setQuickStartMarketType}
        onTimeframeChange={setQuickStartTimeframe}
        onCountChange={setQuickStartCount}
        onQuickStart={() => { void handleQuickStartFromRankings(); }}
        onViewRankings={() => setShowRankingsDialog(true)}
        isPending={updateConfig.isPending}
      />

      <Separator />
      <SetupToggleSection />
      <Separator />

      {!isIB && (
        <>
          <LeverageSettingsSection
            isExpanded={expandedSections.leverageSettings}
            onToggle={() => toggleSection('leverageSettings')}
            leverage={config?.leverage ?? 1}
            onLeverageChange={handleLeverageChange}
            isPending={updateConfig.isPending}
          />
          <Separator />
        </>
      )}

      <PositionSizeSection
        isExpanded={expandedSections.positionSize}
        onToggle={() => toggleSection('positionSize')}
        positionSizePercent={Number(config?.positionSizePercent ?? 10)}
        onPositionSizeChange={(value) => handleConfigUpdate({ positionSizePercent: value.toString() })}
        manualPositionSizePercent={Number(config?.manualPositionSizePercent ?? 2.5)}
        onManualPositionSizeChange={(value) => handleConfigUpdate({ manualPositionSizePercent: value.toString() })}
        maxGlobalExposurePercent={Number(config?.maxGlobalExposurePercent ?? 100)}
        onMaxGlobalExposureChange={(value) => handleConfigUpdate({ maxGlobalExposurePercent: value.toString() })}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <RiskManagementSection
        isExpanded={expandedSections.riskManagement}
        onToggle={() => toggleSection('riskManagement')}
        maxDrawdownEnabled={config?.maxDrawdownEnabled ?? false}
        onMaxDrawdownEnabledChange={handleMaxDrawdownEnabledChange}
        maxDrawdownPercent={Number(config?.maxDrawdownPercent ?? 15)}
        onMaxDrawdownChange={handleMaxDrawdownChange}
        maxRiskPerStopEnabled={config?.maxRiskPerStopEnabled ?? false}
        onMaxRiskPerStopEnabledChange={handleMaxRiskPerStopEnabledChange}
        maxRiskPerStopPercent={Number(config?.maxRiskPerStopPercent ?? 2)}
        onMaxRiskPerStopChange={handleMaxRiskPerStopChange}
        marginTopUpEnabled={config?.marginTopUpEnabled ?? false}
        onMarginTopUpEnabledChange={handleMarginTopUpEnabledChange}
        marginTopUpThreshold={Number(config?.marginTopUpThreshold ?? 30)}
        onMarginTopUpThresholdChange={handleMarginTopUpThresholdChange}
        marginTopUpPercent={Number(config?.marginTopUpPercent ?? 10)}
        onMarginTopUpPercentChange={handleMarginTopUpPercentChange}
        marginTopUpMaxCount={config?.marginTopUpMaxCount ?? 3}
        onMarginTopUpMaxCountChange={handleMarginTopUpMaxCountChange}
        autoCancelOrphans={config?.autoCancelOrphans ?? false}
        onAutoCancelOrphansChange={(enabled) => handleConfigUpdate({ autoCancelOrphans: enabled })}
        isPending={updateConfig.isPending}
        isIB={isIB}
      />

      <Separator />

      <TrailingStopSection
        isExpanded={expandedSections.trailingStop}
        onToggle={() => toggleSection('trailingStop')}
        trailingStopEnabled={config?.trailingStopEnabled ?? true}
        onTrailingStopEnabledChange={(enabled) => handleConfigUpdate({ trailingStopEnabled: enabled })}
        trailingActivationPercentLong={Number(config?.trailingActivationPercentLong ?? 0.9)}
        onTrailingActivationPercentLongChange={(value) => handleConfigUpdate({ trailingActivationPercentLong: value.toString() })}
        trailingActivationPercentShort={Number(config?.trailingActivationPercentShort ?? 0.8)}
        onTrailingActivationPercentShortChange={(value) => handleConfigUpdate({ trailingActivationPercentShort: value.toString() })}
        trailingDistancePercentLong={Number(config?.trailingDistancePercentLong ?? 0.4)}
        onTrailingDistancePercentLongChange={(value) => handleConfigUpdate({ trailingDistancePercentLong: value.toString() })}
        trailingDistancePercentShort={Number(config?.trailingDistancePercentShort ?? 0.3)}
        onTrailingDistancePercentShortChange={(value) => handleConfigUpdate({ trailingDistancePercentShort: value.toString() })}
        useAdaptiveTrailing={config?.useAdaptiveTrailing ?? true}
        onUseAdaptiveTrailingChange={(enabled) => handleConfigUpdate({ useAdaptiveTrailing: enabled })}
        trailingDistanceMode={config?.trailingDistanceMode ?? 'fixed'}
        onTrailingDistanceModeChange={(mode) => handleConfigUpdate({ trailingDistanceMode: mode })}
        trailingStopOffsetPercent={Number(config?.trailingStopOffsetPercent ?? 0)}
        onTrailingStopOffsetPercentChange={(value) => handleConfigUpdate({ trailingStopOffsetPercent: value.toString() })}
        isPending={updateConfig.isPending}
        indicatorInterval={(config?.trailingStopIndicatorInterval ?? '30m') as TimeInterval}
        onIndicatorIntervalChange={(interval) => handleConfigUpdate({ trailingStopIndicatorInterval: interval })}
        activationModeLong={config?.trailingActivationModeLong ?? 'auto'}
        onActivationModeLongChange={(mode) => handleConfigUpdate({ trailingActivationModeLong: mode })}
        activationModeShort={config?.trailingActivationModeShort ?? 'auto'}
        onActivationModeShortChange={(mode) => handleConfigUpdate({ trailingActivationModeShort: mode })}
      />

      <Separator />

      <TpModeSection
        isExpanded={expandedSections.tpMode}
        onToggle={() => toggleSection('tpMode')}
        tpCalculationMode={tpCalculationMode}
        fibonacciTargetLevelLong={fibonacciTargetLevelLong}
        fibonacciTargetLevelShort={fibonacciTargetLevelShort}
        fibonacciSwingRange={fibonacciSwingRange}
        onTpModeChange={handleTpModeChange}
        onFibonacciLevelLongChange={handleFibonacciLevelLongChange}
        onFibonacciLevelShortChange={handleFibonacciLevelShortChange}
        onFibonacciSwingRangeChange={handleFibonacciSwingRangeChange}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <StopModeSection
        isExpanded={expandedSections.stopMode}
        onToggle={() => toggleSection('stopMode')}
        initialStopMode={initialStopMode}
        onInitialStopModeChange={handleInitialStopModeChange}
        isPending={updateConfig.isPending}
      />

      <Separator />

      <EntrySettingsSection
        isExpanded={expandedSections.entrySettings}
        onToggle={() => toggleSection('entrySettings')}
        maxFibonacciEntryProgressPercentLong={Number(config?.maxFibonacciEntryProgressPercentLong ?? 127.2)}
        onEntryProgressLongChange={(value) => handleConfigUpdate({ maxFibonacciEntryProgressPercentLong: value })}
        maxFibonacciEntryProgressPercentShort={Number(config?.maxFibonacciEntryProgressPercentShort ?? 127.2)}
        onEntryProgressShortChange={(value) => handleConfigUpdate({ maxFibonacciEntryProgressPercentShort: value })}
        minRiskRewardRatioLong={Number(config?.minRiskRewardRatioLong ?? 1)}
        onMinRiskRewardLongChange={(value) => handleConfigUpdate({ minRiskRewardRatioLong: value.toString() })}
        minRiskRewardRatioShort={Number(config?.minRiskRewardRatioShort ?? 1)}
        onMinRiskRewardShortChange={(value) => handleConfigUpdate({ minRiskRewardRatioShort: value.toString() })}
        isPending={updateConfig.isPending}
        dragSlEnabled={dragSlEnabled}
        onDragSlEnabledChange={setDragSlEnabled}
        dragTpEnabled={dragTpEnabled}
        onDragTpEnabledChange={setDragTpEnabled}
        slTightenOnly={slTightenOnly}
        onSlTightenOnlyChange={setSlTightenOnly}
      />

      <Separator />

      <FiltersSection
        isExpanded={expandedSections.filters}
        onToggle={() => toggleSection('filters')}
        config={config}
        onFilterToggle={handleFilterToggle}
        isPending={updateConfig.isPending}
        isIB={isIB}
        directionMode={directionMode}
        onDirectionModeChange={handleDirectionModeChange}
        confluenceMinScore={config?.confluenceMinScore ?? 60}
        onConfluenceMinScoreChange={handleConfluenceMinScoreChange}
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
        isIB={isIB}
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
