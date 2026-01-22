import { Box, Collapsible, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import type { TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuPause, LuPlus } from 'react-icons/lu';
import type { ActiveWatcher } from './types';
import { WatcherCardCompact } from './WatcherCardCompact';

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
