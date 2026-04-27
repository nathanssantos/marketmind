import { Box, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TradingProfile } from '@marketmind/types';
import { Badge, Button, CollapsibleSection, DirectionModeSelector } from '@renderer/components/ui';
import type { DirectionMode } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuPause, LuPlus } from 'react-icons/lu';
import type { ActiveWatcher } from './types';
import { WatcherCardCompact } from './WatcherCardCompact';

export type { DirectionMode } from '@renderer/components/ui';

export interface WatchersListProps {
  activeWatchers: ActiveWatcher[];
  persistedWatchers: number;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onAddWatcher: () => void;
  onStopWatcher: (symbol: string, interval: string, marketType?: MarketType) => void;
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
    <CollapsibleSection
      title={t('tradingProfiles.watchers.title')}
      description={t('tradingProfiles.watchers.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
      badge={activeWatchers.length > 0 ? (
        <Badge colorPalette="green" size="sm">
          {activeWatchers.length}
        </Badge>
      ) : undefined}
    >
      <Stack gap={4}>
        <DirectionModeSelector value={directionMode} onChange={onDirectionModeChange} disabled={isPendingConfig} />

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
            variant="outline"
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
    </CollapsibleSection>
  );
};
