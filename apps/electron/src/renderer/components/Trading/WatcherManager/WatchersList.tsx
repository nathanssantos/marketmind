import { Box, Collapsible, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import type { TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuChevronDown, LuChevronUp, LuPause, LuPlus, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import type { ActiveWatcher } from './types';
import { WatcherCardCompact } from './WatcherCardCompact';

export type DirectionMode = 'auto' | 'long_only' | 'short_only';

export interface WatchersListProps {
  activeWatchers: ActiveWatcher[];
  persistedWatchers: number;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onAddWatcher: () => void;
  onStopWatcher: (symbol: string, interval: string, marketType?: 'SPOT' | 'FUTURES') => void;
  onStopAll: () => void;
  isStoppingWatcher: boolean;
  isStoppingAll: boolean;
  getProfileById: (id: string) => TradingProfile | undefined;
  directionMode: DirectionMode;
  onDirectionModeChange: (mode: DirectionMode) => void;
  isPendingConfig: boolean;
}

export const WatchersList = ({
  activeWatchers,
  persistedWatchers,
  isLoading,
  isExpanded,
  onToggle,
  onAddWatcher,
  onStopWatcher,
  onStopAll,
  isStoppingWatcher,
  isStoppingAll,
  getProfileById,
  directionMode,
  onDirectionModeChange,
  isPendingConfig,
}: WatchersListProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={onToggle}
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
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
            <HStack gap={1}>
              <Button
                size="xs"
                variant={directionMode === 'short_only' ? 'solid' : 'outline'}
                colorPalette={directionMode === 'short_only' ? 'red' : 'gray'}
                onClick={() => onDirectionModeChange(directionMode === 'short_only' ? 'auto' : 'short_only')}
                disabled={isPendingConfig}
                flex={1}
              >
                <LuTrendingDown />
                {t('settings.algorithmicAutoTrading.directionMode.shortOnly')}
              </Button>
              <Button
                size="xs"
                variant={directionMode === 'auto' ? 'solid' : 'outline'}
                colorPalette={directionMode === 'auto' ? 'gray' : 'gray'}
                onClick={() => onDirectionModeChange('auto')}
                disabled={isPendingConfig}
                flex={1}
              >
                <LuArrowUpDown />
                {t('settings.algorithmicAutoTrading.directionMode.auto')}
              </Button>
              <Button
                size="xs"
                variant={directionMode === 'long_only' ? 'solid' : 'outline'}
                colorPalette={directionMode === 'long_only' ? 'green' : 'gray'}
                onClick={() => onDirectionModeChange(directionMode === 'long_only' ? 'auto' : 'long_only')}
                disabled={isPendingConfig}
                flex={1}
              >
                <LuTrendingUp />
                {t('settings.algorithmicAutoTrading.directionMode.longOnly')}
              </Button>
            </HStack>

            <Flex justify="flex-end" gap={2}>
              {activeWatchers.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="red"
                  onClick={onStopAll}
                  loading={isStoppingAll}
                >
                  <LuPause />
                  {t('tradingProfiles.watchers.stopAll')}
                </Button>
              )}
              <Button
                size="sm"
                colorPalette="blue"
                onClick={onAddWatcher}
              >
                <LuPlus />
                {t('tradingProfiles.watchers.add')}
              </Button>
            </Flex>

            {isLoading ? (
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
                  onClick={onAddWatcher}
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
                      onStop={() => onStopWatcher(watcher.symbol, watcher.interval, watcher.marketType)}
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
  );
};
