import { Radio, RadioGroup } from '@/renderer/components/ui/radio';
import { Box, Collapsible, Flex, Grid, Group, HStack, IconButton, Portal, Separator, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Switch } from '@renderer/components/ui/switch';
import { useBackendAutoTrading, useDynamicSymbolScores, useRotationStatus, useTriggerRotation } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuChartBar, LuChevronDown, LuChevronUp, LuPause, LuPlay, LuPlus, LuRefreshCw, LuTriangleAlert, LuZap } from 'react-icons/lu';
import { TimeframeSelector } from '../Chart/TimeframeSelector';
import { AddWatcherDialog } from './AddWatcherDialog';
import { DynamicSymbolRankings } from './DynamicSymbolRankings';
import { TradingProfilesManager } from './TradingProfilesManager';

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

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRankingsDialog, setShowRankingsDialog] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [tpModeExpanded, setTpModeExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [opportunityCostExpanded, setOpportunityCostExpanded] = useState(false);
  const [watchersExpanded, setWatchersExpanded] = useState(true);
  const [dynamicSelectionExpanded, setDynamicSelectionExpanded] = useState(false);
  const [quickStartCount, setQuickStartCount] = useState(10);
  const [quickStartTimeframe, setQuickStartTimeframe] = useState<TimeInterval>('4h');
  const [quickStartMarketType, setQuickStartMarketType] = useState<MarketType>('FUTURES');
  const [leverageSettingsExpanded, setLeverageSettingsExpanded] = useState(false);

  const { rotationStatus, isLoadingRotationStatus } = useRotationStatus(walletId);
  const { triggerRotation, isTriggeringRotation } = useTriggerRotation(walletId);
  const { symbolScores, isLoadingScores } = useDynamicSymbolScores(quickStartMarketType, 50);

  const { data: btcTrendStatus } = trpc.autoTrading.getBtcTrendStatus.useQuery(undefined, {
    enabled: config?.useBtcCorrelationFilter === true,
    staleTime: 60000,
  });

  const symbolsToCheck = useMemo(
    () => symbolScores.slice(0, Math.min(quickStartCount * 2, 100)).map((s) => s.symbol),
    [symbolScores, quickStartCount]
  );

  const { data: fundingRates } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: symbolsToCheck },
    {
      enabled: quickStartMarketType === 'FUTURES' && config?.useFundingFilter === true && symbolsToCheck.length > 0,
      staleTime: 60000,
    }
  );

  const { filteredSymbols, fundingFilteredCount } = useMemo(() => {
    const extremeSymbols = new Set(
      quickStartMarketType === 'FUTURES' && config?.useFundingFilter && fundingRates
        ? fundingRates.filter((f) => f.isExtreme).map((f) => f.symbol)
        : []
    );

    const result: string[] = [];
    let filtered = 0;

    for (const score of symbolScores) {
      if (result.length >= quickStartCount) break;

      if (extremeSymbols.has(score.symbol)) {
        filtered++;
        continue;
      }
      result.push(score.symbol);
    }

    return {
      filteredSymbols: result,
      fundingFilteredCount: filtered,
    };
  }, [symbolScores, quickStartCount, fundingRates, config?.useFundingFilter, quickStartMarketType]);

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
    await startWatchersBulk(filteredSymbols, quickStartTimeframe, undefined, quickStartMarketType);
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
      {showEmergencyConfirm && (
        <Box
          p={4}
          bg="red.50"
          borderRadius="lg"
          borderWidth="2px"
          borderColor="red.500"
          _dark={{ bg: 'red.900/30' }}
        >
          <Flex align="center" gap={3} mb={3}>
            <Box color="red.500">
              <LuTriangleAlert size={24} />
            </Box>
            <Box>
              <Text fontWeight="bold" color="red.600" _dark={{ color: 'red.300' }}>
                {t('tradingProfiles.emergencyStop.confirmTitle')}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {t('tradingProfiles.emergencyStop.confirmDescription')}
              </Text>
            </Box>
          </Flex>
          <Flex gap={2} justify="flex-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEmergencyConfirm(false)}
              disabled={isEmergencyStopping}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              colorPalette="red"
              onClick={handleEmergencyStop}
              loading={isEmergencyStopping}
            >
              <LuTriangleAlert />
              {t('tradingProfiles.emergencyStop.confirm')}
            </Button>
          </Flex>
        </Box>
      )}

      {(activeWatchers.length > 0 || persistedWatchers > 0) && !showEmergencyConfirm && (
        <Button
          size="sm"
          variant="outline"
          colorPalette="red"
          onClick={() => setShowEmergencyConfirm(true)}
          w="full"
        >
          <LuTriangleAlert />
          {t('tradingProfiles.emergencyStop.button')}
        </Button>
      )}

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setWatchersExpanded(!watchersExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Flex align="center" gap={2}>
              <Text fontSize="lg" fontWeight="bold">
                {t('tradingProfiles.watchers.title')}
              </Text>
              {activeWatchers.length > 0 && (
                <Box
                  px={2}
                  py={0.5}
                  bg="green.100"
                  color="green.800"
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="medium"
                  _dark={{ bg: 'green.900', color: 'green.200' }}
                >
                  {activeWatchers.length}
                </Box>
              )}
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {t('tradingProfiles.watchers.description')}
            </Text>
          </Box>
          {watchersExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={watchersExpanded}>
          <Collapsible.Content>
            <Stack gap={4} mt={4}>
              <Flex justify="flex-end" gap={2}>
                {activeWatchers.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="red"
                    onClick={handleStopAll}
                    loading={isStoppingAllWatchers}
                  >
                    <LuPause />
                    {t('tradingProfiles.watchers.stopAll')}
                  </Button>
                )}
                <Button
                  size="sm"
                  colorPalette="blue"
                  onClick={() => setShowAddDialog(true)}
                >
                  <LuPlus />
                  {t('tradingProfiles.watchers.add')}
                </Button>
              </Flex>

              {isLoadingWatcherStatus ? (
                <Box p={4} textAlign="center">
                  <Text fontSize="sm" color="fg.muted">
                    {t('common.loading')}
                  </Text>
                </Box>
              ) : activeWatchers.length === 0 && persistedWatchers === 0 ? (
                <Box
                  p={6}
                  textAlign="center"
                  borderWidth="1px"
                  borderStyle="dashed"
                  borderRadius="lg"
                  borderColor="border"
                >
                  <Text fontSize="sm" color="fg.muted" mb={2}>
                    {t('tradingProfiles.watchers.empty')}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <LuPlus />
                    {t('tradingProfiles.watchers.addFirst')}
                  </Button>
                </Box>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fill, minmax(160px, 1fr))"
                  gap={2}
                >
                  {activeWatchers.map((watcher) => {
                    const profile = watcher.profileId ? getProfileById(watcher.profileId) : null;

                    return (
                      <WatcherCardCompact
                        key={watcher.watcherId}
                        symbol={watcher.symbol}
                        interval={watcher.interval}
                        profileName={profile?.name ?? watcher.profileName}
                        marketType={watcher.marketType}
                        onStop={() => handleStopWatcher(watcher.symbol, watcher.interval, watcher.marketType)}
                        isStopping={isStoppingWatcher}
                      />
                    );
                  })}
                </Grid>
              )}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Separator />

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setDynamicSelectionExpanded(!dynamicSelectionExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Flex align="center" gap={2}>
              <Text fontSize="lg" fontWeight="bold">
                {t('tradingProfiles.dynamicSelection.title')}
              </Text>
              {config?.useDynamicSymbolSelection && (
                <Box
                  px={2}
                  py={0.5}
                  bg="blue.100"
                  color="blue.800"
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="medium"
                  _dark={{ bg: 'blue.900', color: 'blue.200' }}
                >
                  <Flex align="center" gap={1}>
                    <LuZap size={10} />
                    {t('common.active')}
                  </Flex>
                </Box>
              )}
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {t('tradingProfiles.dynamicSelection.description')}
            </Text>
          </Box>
          {dynamicSelectionExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={dynamicSelectionExpanded}>
          <Collapsible.Content>
            <Stack gap={4} mt={4}>
              <Flex justify="space-between" align="center" p={3} bg="bg.muted" borderRadius="md">
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('tradingProfiles.dynamicSelection.enable')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('tradingProfiles.dynamicSelection.enableDescription')}
                  </Text>
                </Box>
                <Switch
                  checked={config?.useDynamicSymbolSelection ?? false}
                  onCheckedChange={handleDynamicSelectionToggle}
                  disabled={updateConfig.isPending}
                />
              </Flex>

              {config?.useDynamicSymbolSelection && (
                <>
                  <Box p={4} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">
                          {t('tradingProfiles.dynamicSelection.rotationStatus')}
                        </Text>
                        {isLoadingRotationStatus ? (
                          <Text fontSize="xs" color="fg.muted">
                            {t('common.loading')}
                          </Text>
                        ) : rotationStatus?.isActive ? (
                          <Text fontSize="xs" color="green.500">
                            {t('tradingProfiles.dynamicSelection.nextRotation', {
                              time: rotationStatus.nextRotation
                                ? new Date(rotationStatus.nextRotation).toLocaleTimeString()
                                : '-',
                            })}
                          </Text>
                        ) : (
                          <Text fontSize="xs" color="fg.muted">
                            {t('tradingProfiles.dynamicSelection.rotationInactive')}
                          </Text>
                        )}
                      </Box>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTriggerRotation}
                        loading={isTriggeringRotation}
                        disabled={updateConfig.isPending}
                      >
                        <LuRefreshCw />
                        {t('tradingProfiles.dynamicSelection.triggerNow')}
                      </Button>
                    </Flex>
                    <Flex justify="space-between" align="center" mt={3} pt={3} borderTopWidth="1px" borderColor="border">
                      <Box>
                        <Text fontSize="sm" fontWeight="medium">
                          {t('tradingProfiles.dynamicSelection.autoRotation')}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('tradingProfiles.dynamicSelection.autoRotationDescription')}
                        </Text>
                      </Box>
                      <Switch
                        checked={config?.enableAutoRotation ?? true}
                        onCheckedChange={handleAutoRotationToggle}
                        disabled={updateConfig.isPending}
                      />
                    </Flex>
                  </Box>

                  <Box p={4} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200" _dark={{ bg: 'green.900/20', borderColor: 'green.800' }}>
                    <Flex justify="space-between" align="center" mb={3}>
                      <Text fontSize="sm" fontWeight="medium">
                        {t('tradingProfiles.dynamicSelection.quickStartTitle')}
                      </Text>
                      {config?.useBtcCorrelationFilter && btcTrendStatus && (
                        <Box
                          px={2}
                          py={0.5}
                          bg={
                            btcTrendStatus.trend === 'BULLISH'
                              ? 'green.100'
                              : btcTrendStatus.trend === 'BEARISH'
                                ? 'red.100'
                                : 'gray.100'
                          }
                          borderRadius="md"
                          fontSize="xs"
                          _dark={{
                            bg:
                              btcTrendStatus.trend === 'BULLISH'
                                ? 'green.900'
                                : btcTrendStatus.trend === 'BEARISH'
                                  ? 'red.900'
                                  : 'gray.700',
                          }}
                        >
                          <Text
                            fontWeight="medium"
                            color={
                              btcTrendStatus.trend === 'BULLISH'
                                ? 'green.700'
                                : btcTrendStatus.trend === 'BEARISH'
                                  ? 'red.700'
                                  : 'gray.600'
                            }
                            _dark={{
                              color:
                                btcTrendStatus.trend === 'BULLISH'
                                  ? 'green.200'
                                  : btcTrendStatus.trend === 'BEARISH'
                                    ? 'red.200'
                                    : 'gray.300',
                            }}
                          >
                            BTC: {btcTrendStatus.trend}
                            {!btcTrendStatus.canLong && ' (LONG blocked)'}
                            {!btcTrendStatus.canShort && ' (SHORT blocked)'}
                          </Text>
                        </Box>
                      )}
                    </Flex>
                    <Stack gap={3}>
                      <Flex gap={3} align="center">
                        <Group attached flex="0 0 180px">
                          <Button
                            size="sm"
                            variant={quickStartMarketType === 'SPOT' ? 'solid' : 'outline'}
                            onClick={() => setQuickStartMarketType('SPOT')}
                            flex={1}
                          >
                            Spot
                          </Button>
                          <Button
                            size="sm"
                            variant={quickStartMarketType === 'FUTURES' ? 'solid' : 'outline'}
                            onClick={() => setQuickStartMarketType('FUTURES')}
                            flex={1}
                          >
                            Futures
                          </Button>
                        </Group>
                        <Box>
                          <TimeframeSelector
                            selectedTimeframe={quickStartTimeframe}
                            onTimeframeChange={setQuickStartTimeframe}
                          />
                        </Box>
                        <Box flex="0 0 80px">
                          <NumberInput
                            min={1}
                            max={50}
                            value={quickStartCount}
                            onChange={(e) => setQuickStartCount(parseInt(e.target.value, 10) || 10)}
                            size="sm"
                            px={3}
                          />
                        </Box>
                        <Text fontSize="sm" color="fg.muted" flex={1}>
                          {t('tradingProfiles.dynamicSelection.quickStartDescription')}
                        </Text>
                        <Button
                          size="sm"
                          colorPalette="green"
                          onClick={handleQuickStartFromRankings}
                          loading={isStartingWatchersBulk}
                          disabled={isLoadingScores || filteredSymbols.length === 0}
                        >
                          <LuPlay />
                          {t('tradingProfiles.dynamicSelection.quickStartButton', { count: filteredSymbols.length })}
                        </Button>
                      </Flex>
                      {fundingFilteredCount > 0 && (
                        <Text fontSize="xs" color="orange.600" _dark={{ color: 'orange.300' }}>
                          {t('tradingProfiles.dynamicSelection.fundingFiltered', {
                            count: fundingFilteredCount,
                            defaultValue: '{{count}} symbols excluded (extreme funding)',
                          })}
                        </Text>
                      )}
                    </Stack>
                  </Box>

                  <Flex justify="space-between" align="center">
                    <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900/20' }} flex={1}>
                      <Flex gap={2} align="flex-start">
                        <LuZap size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                        <Text fontSize="xs" color="fg.muted">
                          {t('tradingProfiles.dynamicSelection.infoText')}
                        </Text>
                      </Flex>
                    </Box>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowRankingsDialog(true)}
                      ml={2}
                    >
                      <LuChartBar />
                      {t('tradingProfiles.dynamicSelection.viewRankings')}
                    </Button>
                  </Flex>
                </>
              )}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Separator />

      <TradingProfilesManager />

      <Separator />

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setLeverageSettingsExpanded(!leverageSettingsExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Text fontSize="lg" fontWeight="bold">
              {t('settings.algorithmicAutoTrading.leverage.title', 'Futures Settings')}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {t('settings.algorithmicAutoTrading.leverage.description', 'Configure leverage and margin type for futures trading')}
            </Text>
          </Box>
          {leverageSettingsExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={leverageSettingsExpanded}>
          <Collapsible.Content>
            <Stack gap={4} mt={4}>
              <Flex gap={4} align="flex-end" wrap="wrap">
                <Box flex="0 0 120px">
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    {t('settings.algorithmicAutoTrading.leverage.label', 'Leverage')}
                  </Text>
                  <NumberInput
                    min={1}
                    max={125}
                    value={config?.leverage ?? 1}
                    onChange={handleLeverageChange}
                    size="sm"
                    disabled={updateConfig.isPending}
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    {t('settings.algorithmicAutoTrading.marginType.label', 'Margin Type')}
                  </Text>
                  <Group attached>
                    <Button
                      size="sm"
                      variant={config?.marginType === 'ISOLATED' ? 'solid' : 'outline'}
                      onClick={() => handleMarginTypeChange('ISOLATED')}
                      disabled={updateConfig.isPending}
                    >
                      Isolated
                    </Button>
                    <Button
                      size="sm"
                      variant={config?.marginType === 'CROSSED' ? 'solid' : 'outline'}
                      onClick={() => handleMarginTypeChange('CROSSED')}
                      disabled={updateConfig.isPending}
                    >
                      Cross
                    </Button>
                  </Group>
                </Box>
              </Flex>
              <Box p={3} bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900/20' }}>
                <Text fontSize="xs" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.leverage.warning', 'Higher leverage increases both potential gains and losses. Use with caution.')}
                </Text>
              </Box>
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Separator />

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setTpModeExpanded(!tpModeExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Text fontSize="lg" fontWeight="bold">
              {t('settings.algorithmicAutoTrading.tpMode.title')}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {t('settings.algorithmicAutoTrading.tpMode.description')}
            </Text>
          </Box>
          {tpModeExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={tpModeExpanded}>
          <Collapsible.Content>
            <RadioGroup
              value={tpCalculationMode}
              onValueChange={handleTpModeChange}
              disabled={updateConfig.isPending}
            >
              <HStack gap={6} mt={4}>
                <Radio value="default">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('settings.algorithmicAutoTrading.tpMode.default')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('settings.algorithmicAutoTrading.tpMode.defaultDescription')}
                    </Text>
                  </Box>
                </Radio>
                <Radio value="fibonacci">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('settings.algorithmicAutoTrading.tpMode.fibonacci')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('settings.algorithmicAutoTrading.tpMode.fibonacciDescription')}
                    </Text>
                  </Box>
                </Radio>
              </HStack>
            </RadioGroup>

            {tpCalculationMode === 'fibonacci' && (
              <Box mt={4} pl={4} borderLeftWidth="2px" borderLeftColor="blue.500">
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.title')}
                </Text>
                <RadioGroup
                  value={fibonacciTargetLevel}
                  onValueChange={handleFibonacciLevelChange}
                  disabled={updateConfig.isPending}
                >
                  <Stack gap={2}>
                    <Radio value="auto">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.auto')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.autoDescription')}
                        </Text>
                      </Box>
                    </Radio>
                    <Radio value="1">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservative')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservativeDescription')}
                        </Text>
                      </Box>
                    </Radio>
                    <Radio value="1.272">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderate')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateDescription')}
                        </Text>
                      </Box>
                    </Radio>
                    <Radio value="1.618">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressive')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressiveDescription')}
                        </Text>
                      </Box>
                    </Radio>
                    <Radio value="2">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extended')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extendedDescription')}
                        </Text>
                      </Box>
                    </Radio>
                    <Radio value="2.618">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtended')}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtendedDescription')}
                        </Text>
                      </Box>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </Box>
            )}
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Separator />

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Text fontSize="lg" fontWeight="bold">
              {t('settings.algorithmicAutoTrading.filters.title')}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.description')}
            </Text>
          </Box>
          {filtersExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={filtersExpanded}>
          <Collapsible.Content>
            <Stack gap={4} mt={4}>
              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {t('settings.algorithmicAutoTrading.filters.directionFilters')}
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.mtf.title')}
                  description={t('settings.algorithmicAutoTrading.filters.mtf.description')}
                  checked={config?.useMtfFilter ?? true}
                  onChange={(value) => handleFilterToggle('useMtfFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.btcCorrelation.title')}
                  description={t('settings.algorithmicAutoTrading.filters.btcCorrelation.description')}
                  checked={config?.useBtcCorrelationFilter ?? true}
                  onChange={(value) => handleFilterToggle('useBtcCorrelationFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.marketRegime.title')}
                  description={t('settings.algorithmicAutoTrading.filters.marketRegime.description')}
                  checked={config?.useMarketRegimeFilter ?? true}
                  onChange={(value) => handleFilterToggle('useMarketRegimeFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.trend.title')}
                  description={t('settings.algorithmicAutoTrading.filters.trend.description')}
                  checked={config?.useTrendFilter ?? false}
                  onChange={(value) => handleFilterToggle('useTrendFilter', value)}
                  disabled={updateConfig.isPending}
                />
              </Grid>

              <Separator />

              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {t('settings.algorithmicAutoTrading.filters.timingFilters')}
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.momentumTiming.title')}
                  description={t('settings.algorithmicAutoTrading.filters.momentumTiming.description')}
                  checked={config?.useMomentumTimingFilter ?? true}
                  onChange={(value) => handleFilterToggle('useMomentumTimingFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.stochastic.title')}
                  description={t('settings.algorithmicAutoTrading.filters.stochastic.description')}
                  checked={config?.useStochasticFilter ?? false}
                  onChange={(value) => handleFilterToggle('useStochasticFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.adx.title')}
                  description={t('settings.algorithmicAutoTrading.filters.adx.description')}
                  checked={config?.useAdxFilter ?? false}
                  onChange={(value) => handleFilterToggle('useAdxFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.volume.title')}
                  description={t('settings.algorithmicAutoTrading.filters.volume.description')}
                  checked={config?.useVolumeFilter ?? false}
                  onChange={(value) => handleFilterToggle('useVolumeFilter', value)}
                  disabled={updateConfig.isPending}
                />
              </Grid>

              <Separator />

              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {t('settings.algorithmicAutoTrading.filters.marketFilters')}
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.funding.title')}
                  description={t('settings.algorithmicAutoTrading.filters.funding.description')}
                  checked={config?.useFundingFilter ?? true}
                  onChange={(value) => handleFilterToggle('useFundingFilter', value)}
                  disabled={updateConfig.isPending}
                />
                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.filters.confluence.title')}
                  description={t('settings.algorithmicAutoTrading.filters.confluence.description')}
                  checked={config?.useConfluenceScoring ?? true}
                  onChange={(value) => handleFilterToggle('useConfluenceScoring', value)}
                  disabled={updateConfig.isPending}
                />
              </Grid>
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Separator />

      <Box>
        <Flex
          justify="space-between"
          align="center"
          cursor="pointer"
          onClick={() => setOpportunityCostExpanded(!opportunityCostExpanded)}
          _hover={{ bg: 'bg.muted' }}
          p={2}
          mx={-2}
          borderRadius="md"
        >
          <Box>
            <Flex align="center" gap={2}>
              <Text fontSize="lg" fontWeight="bold">
                {t('settings.algorithmicAutoTrading.opportunityCost.title')}
              </Text>
              {config?.opportunityCostEnabled && (
                <Box
                  px={2}
                  py={0.5}
                  bg="purple.100"
                  color="purple.800"
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="medium"
                  _dark={{ bg: 'purple.900', color: 'purple.200' }}
                >
                  {t('common.active')}
                </Box>
              )}
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {t('settings.algorithmicAutoTrading.opportunityCost.description')}
            </Text>
          </Box>
          {opportunityCostExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
        </Flex>

        <Collapsible.Root open={opportunityCostExpanded}>
          <Collapsible.Content>
            <Stack gap={4} mt={4}>
              <Flex justify="space-between" align="center" p={3} bg="bg.muted" borderRadius="md">
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('settings.algorithmicAutoTrading.opportunityCost.enable')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('settings.algorithmicAutoTrading.opportunityCost.enableDescription')}
                  </Text>
                </Box>
                <Switch
                  checked={config?.opportunityCostEnabled ?? false}
                  onCheckedChange={(e) => {
                    if (!walletId) return;
                    updateConfig.mutate({ walletId, opportunityCostEnabled: e.checked });
                  }}
                  disabled={updateConfig.isPending}
                />
              </Flex>

              {config?.opportunityCostEnabled && (
                <>
                  <Box p={3} bg="bg.muted" borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      {t('settings.algorithmicAutoTrading.opportunityCost.maxHoldingPeriod')}
                    </Text>
                    <Flex gap={2} align="center">
                      <NumberInput
                        min={5}
                        max={100}
                        value={String(config?.maxHoldingPeriodBars ?? 20)}
                        onValueChange={(e) => {
                          if (!walletId) return;
                          const value = parseInt(e.value, 10);
                          if (!isNaN(value) && value >= 5 && value <= 100) {
                            updateConfig.mutate({ walletId, maxHoldingPeriodBars: value });
                          }
                        }}
                        size="sm"
                        w="100px"
                      />
                      <Text fontSize="sm" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.opportunityCost.bars')}
                      </Text>
                    </Flex>
                  </Box>

                  <Box p={3} bg="bg.muted" borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      {t('settings.algorithmicAutoTrading.opportunityCost.staleThreshold')}
                    </Text>
                    <Flex gap={2} align="center">
                      <NumberInput
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={config?.stalePriceThresholdPercent ?? '0.5'}
                        onValueChange={(e) => {
                          if (!walletId) return;
                          const value = parseFloat(e.value);
                          if (!isNaN(value) && value >= 0.1 && value <= 5) {
                            updateConfig.mutate({ walletId, stalePriceThresholdPercent: value.toString() });
                          }
                        }}
                        size="sm"
                        w="100px"
                      />
                      <Text fontSize="sm" color="fg.muted">%</Text>
                    </Flex>
                  </Box>

                  <Box p={3} bg="bg.muted" borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      {t('settings.algorithmicAutoTrading.opportunityCost.actionWhenStale')}
                    </Text>
                    <RadioGroup
                      value={config?.staleTradeAction ?? 'TIGHTEN_STOP'}
                      onValueChange={(e) => {
                        if (!walletId) return;
                        updateConfig.mutate({
                          walletId,
                          staleTradeAction: e.value as 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE',
                        });
                      }}
                    >
                      <Stack gap={2}>
                        <Radio value="ALERT_ONLY">
                          {t('settings.algorithmicAutoTrading.opportunityCost.alertOnly')}
                        </Radio>
                        <Radio value="TIGHTEN_STOP">
                          {t('settings.algorithmicAutoTrading.opportunityCost.tightenStop')}
                        </Radio>
                        <Radio value="AUTO_CLOSE">
                          {t('settings.algorithmicAutoTrading.opportunityCost.autoClose')}
                        </Radio>
                      </Stack>
                    </RadioGroup>
                  </Box>

                  <FilterToggle
                    label={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.title')}
                    description={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.description')}
                    checked={config?.timeBasedStopTighteningEnabled ?? true}
                    onChange={(value) => handleFilterToggle('timeBasedStopTighteningEnabled', value)}
                    disabled={updateConfig.isPending}
                  />

                  {config?.timeBasedStopTighteningEnabled && (
                    <Box p={3} bg="bg.muted" borderRadius="md" ml={4}>
                      <Grid templateColumns="1fr 1fr" gap={4}>
                        <Box>
                          <Text fontSize="sm" mb={1}>
                            {t('settings.algorithmicAutoTrading.opportunityCost.tightenAfterBars')}
                          </Text>
                          <NumberInput
                            min={1}
                            max={50}
                            value={String(config?.timeTightenAfterBars ?? 10)}
                            onValueChange={(e) => {
                              if (!walletId) return;
                              const value = parseInt(e.value, 10);
                              if (!isNaN(value) && value >= 1 && value <= 50) {
                                updateConfig.mutate({ walletId, timeTightenAfterBars: value });
                              }
                            }}
                            size="sm"
                          />
                        </Box>
                        <Box>
                          <Text fontSize="sm" mb={1}>
                            {t('settings.algorithmicAutoTrading.opportunityCost.tightenPercentPerBar')}
                          </Text>
                          <Flex gap={2} align="center">
                            <NumberInput
                              min={1}
                              max={20}
                              value={config?.timeTightenPercentPerBar ?? '5'}
                              onValueChange={(e) => {
                                if (!walletId) return;
                                const value = parseFloat(e.value);
                                if (!isNaN(value) && value >= 1 && value <= 20) {
                                  updateConfig.mutate({ walletId, timeTightenPercentPerBar: value.toString() });
                                }
                              }}
                              size="sm"
                            />
                            <Text fontSize="sm">%</Text>
                          </Flex>
                        </Box>
                      </Grid>
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

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

interface WatcherCardCompactProps {
  symbol: string;
  interval: string;
  profileName?: string;
  marketType?: 'SPOT' | 'FUTURES';
  onStop: () => void;
  isStopping?: boolean;
}

const WatcherCardCompact = ({
  symbol,
  interval,
  profileName,
  marketType = 'SPOT',
  onStop,
  isStopping = false,
}: WatcherCardCompactProps) => {
  const { t } = useTranslation();

  return (
    <Box
      p={2}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="3px solid"
      borderColor="green.500"
      position="relative"
    >
      <Flex align="center" gap={1.5} mb={1}>
        <Box w={1.5} h={1.5} borderRadius="full" bg="green.500" />
        <CryptoIcon symbol={symbol} size={16} />
        <Text fontWeight="semibold" fontSize="sm" truncate flex={1}>
          {symbol.replace('USDT', '')}
        </Text>
        <MenuRoot id={`watcher-compact-${symbol}-${interval}`} positioning={{ placement: 'bottom-end' }}>
          <MenuTrigger asChild>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label={t('tradingProfiles.watchers.options')}
              onClick={(e) => e.stopPropagation()}
              disabled={isStopping}
            >
              <BsThreeDotsVertical />
            </IconButton>
          </MenuTrigger>
          <Portal>
            <MenuPositioner>
              <MenuContent bg="bg.panel" borderColor="border" shadow="lg" minW="150px" zIndex={99999} p={0}>
                <MenuItem
                  value="stop"
                  onClick={onStop}
                  color="red.500"
                  px={3}
                  py={2}
                  _hover={{ bg: 'bg.muted' }}
                  disabled={isStopping}
                >
                  <LuPause />
                  <Text>{t('tradingProfiles.watchers.stop')}</Text>
                </MenuItem>
              </MenuContent>
            </MenuPositioner>
          </Portal>
        </MenuRoot>
      </Flex>
      <Flex gap={1} flexWrap="wrap">
        <Box
          px={1.5}
          py={0.5}
          bg="blue.100"
          color="blue.800"
          borderRadius="sm"
          fontSize="2xs"
          _dark={{ bg: 'blue.900', color: 'blue.200' }}
        >
          {interval}
        </Box>
        <Box
          px={1.5}
          py={0.5}
          bg={marketType === 'FUTURES' ? 'orange.100' : 'green.100'}
          color={marketType === 'FUTURES' ? 'orange.800' : 'green.800'}
          borderRadius="sm"
          fontSize="2xs"
          fontWeight="medium"
          _dark={{
            bg: marketType === 'FUTURES' ? 'orange.900' : 'green.900',
            color: marketType === 'FUTURES' ? 'orange.200' : 'green.200',
          }}
        >
          {marketType}
        </Box>
      </Flex>
      {profileName && (
        <Text fontSize="2xs" color="fg.muted" mt={1} truncate>
          {profileName}
        </Text>
      )}
    </Box>
  );
};

interface FilterToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const FilterToggle = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: FilterToggleProps) => (
  <Box
    p={3}
    bg="bg.muted"
    borderRadius="md"
    borderWidth="1px"
    borderColor={checked ? 'green.500' : 'border'}
    opacity={disabled ? 0.6 : 1}
  >
    <Flex justify="space-between" align="flex-start" gap={3}>
      <Box flex={1}>
        <Text fontSize="sm" fontWeight="medium">
          {label}
        </Text>
        <Text fontSize="xs" color="fg.muted" mt={1}>
          {description}
        </Text>
      </Box>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        size="sm"
      />
    </Flex>
  </Box>
);
