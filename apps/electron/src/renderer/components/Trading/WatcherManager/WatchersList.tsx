import { Box, Flex, HStack, Stack } from '@chakra-ui/react';
import type { MarketType, TradingProfile } from '@marketmind/types';
import { Badge, Button, DirectionModeSelector, EmptyState, FormSection, LoadingSpinner } from '@renderer/components/ui';
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
    <FormSection
      title={
        <HStack gap={2}>
          <span>{t('tradingProfiles.watchers.title')}</span>
          {activeWatchers.length > 0 && (
            <Badge colorPalette="green" size="xs">
              {activeWatchers.length}
            </Badge>
          )}
        </HStack>
      }
      description={t('tradingProfiles.watchers.description')}
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
            data-testid="trigger-add-watcher"
          >
            <LuPlus />
            {t('tradingProfiles.watchers.add')}
          </Button>
        </Flex>

        {isLoading ? (
          <Box p={4}>
            <LoadingSpinner />
          </Box>
        ) : activeWatchers.length === 0 && persistedWatchers === 0 ? (
          <EmptyState
            dashed
            title={t('tradingProfiles.watchers.empty')}
            action={{ label: t('tradingProfiles.watchers.addFirst'), onClick: onAddWatcher }}
          />
        ) : (
          <Stack gap={1}>
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
          </Stack>
        )}
      </Stack>
    </FormSection>
  );
};
