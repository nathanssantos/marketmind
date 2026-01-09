import { Radio, RadioGroup } from '@/renderer/components/ui/radio';
import { Box, Collapsible, Flex, Grid, HStack, IconButton, Portal, Separator, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuChevronDown, LuChevronUp, LuPause, LuPlay, LuPlus, LuTrash2 } from 'react-icons/lu';
import { AddWatcherDialog } from './AddWatcherDialog';
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
    isStoppingWatcher,
    isStoppingAllWatchers,
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
  const [tpModeExpanded, setTpModeExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [watchersExpanded, setWatchersExpanded] = useState(true);

  const tpCalculationMode = config?.tpCalculationMode ?? 'default';

  const handleTpModeChange = (details: { value: string }): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      tpCalculationMode: details.value as 'default' | 'fibonacci',
    });
  };

  const handleFilterToggle = (filterKey: string, value: boolean): void => {
    if (!walletId) return;
    updateConfig.mutate({
      walletId,
      [filterKey]: value,
    });
  };

  const activeWatchers = watcherStatus?.activeWatchers ?? [];
  const persistedWatchers = watcherStatus?.persistedWatchers ?? 0;

  const handleStopWatcher = async (symbol: string, interval: string, marketType?: 'SPOT' | 'FUTURES') => {
    await stopWatcher(symbol, interval, marketType);
  };

  const handleStopAll = async () => {
    await stopAllWatchers();
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
                <Stack gap={2}>
                  {activeWatchers.map((watcher) => {
                    const profile = watcher.profileId ? getProfileById(watcher.profileId) : null;

                    return (
                      <WatcherCard
                        key={watcher.watcherId}
                        symbol={watcher.symbol}
                        interval={watcher.interval}
                        profileName={profile?.name ?? watcher.profileName}
                        profileId={watcher.profileId}
                        marketType={watcher.marketType}
                        isActive={true}
                        onStop={() => handleStopWatcher(watcher.symbol, watcher.interval, watcher.marketType)}
                        isStopping={isStoppingWatcher}
                      />
                    );
                  })}
                </Stack>
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

      <AddWatcherDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        walletId={walletId}
        profiles={profiles}
      />
    </Stack>
  );
};

interface WatcherCardProps {
  symbol: string;
  interval: string;
  profileName?: string;
  profileId?: string;
  marketType?: 'SPOT' | 'FUTURES';
  isActive: boolean;
  onStop: () => void;
  isStopping?: boolean;
}

const WatcherCard = ({
  symbol,
  interval,
  profileName,
  marketType = 'SPOT',
  isActive,
  onStop,
  isStopping = false,
}: WatcherCardProps) => {
  const { t } = useTranslation();

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isActive ? 'green.500' : 'gray.400'}
    >
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={3}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            bg={isActive ? 'green.500' : 'gray.400'}
          />
          <Box>
            <Flex align="center" gap={2}>
              <Text fontWeight="bold" fontSize="md">
                {symbol}
              </Text>
              <Box
                px={2}
                py={0.5}
                bg="blue.100"
                color="blue.800"
                borderRadius="sm"
                fontSize="xs"
                _dark={{ bg: 'blue.900', color: 'blue.200' }}
              >
                {interval}
              </Box>
              <Box
                px={2}
                py={0.5}
                bg={marketType === 'FUTURES' ? 'orange.100' : 'green.100'}
                color={marketType === 'FUTURES' ? 'orange.800' : 'green.800'}
                borderRadius="sm"
                fontSize="xs"
                fontWeight="medium"
                _dark={{
                  bg: marketType === 'FUTURES' ? 'orange.900' : 'green.900',
                  color: marketType === 'FUTURES' ? 'orange.200' : 'green.200',
                }}
              >
                {marketType}
              </Box>
            </Flex>
            <Text fontSize="xs" color="fg.muted">
              {profileName
                ? `${t('tradingProfiles.watchers.profile')}: ${profileName}`
                : t('tradingProfiles.watchers.usingDefault')}
            </Text>
          </Box>
        </Flex>

        <MenuRoot id={`watcher-menu-${symbol}-${interval}`} positioning={{ placement: 'bottom-end' }}>
          <MenuTrigger asChild>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Watcher options"
              onClick={(e) => e.stopPropagation()}
              disabled={isStopping}
            >
              <BsThreeDotsVertical />
            </IconButton>
          </MenuTrigger>
          <Portal>
            <MenuPositioner>
              <MenuContent
                bg="bg.panel"
                borderColor="border"
                shadow="lg"
                minW="180px"
                zIndex={99999}
                p={0}
              >
                {isActive ? (
                  <MenuItem
                    value="stop"
                    onClick={onStop}
                    color="red.500"
                    px={4}
                    py={2.5}
                    _hover={{ bg: 'bg.muted' }}
                    disabled={isStopping}
                  >
                    <LuPause />
                    <Text>{t('tradingProfiles.watchers.stop')}</Text>
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem
                      value="start"
                      px={4}
                      py={2.5}
                      _hover={{ bg: 'bg.muted' }}
                    >
                      <LuPlay />
                      <Text>{t('tradingProfiles.watchers.start')}</Text>
                    </MenuItem>
                    <MenuItem
                      value="delete"
                      color="red.500"
                      px={4}
                      py={2.5}
                      _hover={{ bg: 'bg.muted' }}
                    >
                      <LuTrash2 />
                      <Text>{t('common.delete')}</Text>
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </MenuPositioner>
          </Portal>
        </MenuRoot>
      </Flex>
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
