import { Box, Flex, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { Button } from '@renderer/components/ui/button';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuPause, LuPlay, LuPlus, LuTrash2 } from 'react-icons/lu';
import { AddWatcherDialog } from './AddWatcherDialog';

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

  const [showAddDialog, setShowAddDialog] = useState(false);

  const activeWatchers = watcherStatus?.activeWatchers ?? [];
  const persistedWatchers = watcherStatus?.persistedWatchers ?? 0;

  const handleStopWatcher = async (symbol: string, interval: string) => {
    await stopWatcher(symbol, interval);
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
      <Flex justify="space-between" align="center">
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            {t('tradingProfiles.watchers.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('tradingProfiles.watchers.description')}
          </Text>
        </Box>
        <Flex gap={2}>
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
                onStop={() => handleStopWatcher(watcher.symbol, watcher.interval)}
                isStopping={isStoppingWatcher}
              />
            );
          })}
        </Stack>
      )}

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
