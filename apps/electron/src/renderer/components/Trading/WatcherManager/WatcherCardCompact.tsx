import type { MarketType } from '@marketmind/types';
import { Box, Flex, Portal, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { Badge, CryptoIcon, IconButton } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuPause } from 'react-icons/lu';

export interface WatcherCardCompactProps {
  symbol: string;
  interval: string;
  profileName?: string;
  marketType?: MarketType;
  onStop: () => void;
  isStopping?: boolean;
}

export const WatcherCardCompact = ({
  symbol,
  interval,
  profileName,
  marketType = 'FUTURES',
  onStop,
  isStopping = false,
}: WatcherCardCompactProps) => {
  const { t } = useTranslation();

  return (
    <Flex
      align="center"
      gap={2}
      px={3}
      py={2}
      bg="bg.muted"
      borderRadius="md"
      _hover={{ bg: 'bg.subtle' }}
    >
      <Box w={1.5} h={1.5} borderRadius="full" bg="green.fg" flexShrink={0} />
      <CryptoIcon symbol={symbol} size={16} />
      <Text fontWeight="semibold" fontSize="sm" truncate flex="0 0 auto" minW="60px">
        {symbol.replace('USDT', '')}
      </Text>
      <Badge colorPalette="blue" variant="subtle" size="xs">
        {interval}
      </Badge>
      <Badge colorPalette={marketType === 'FUTURES' ? 'orange' : 'green'} variant="subtle" size="xs">
        {marketType}
      </Badge>
      {profileName && (
        <Text fontSize="2xs" color="fg.muted" truncate flex={1}>
          {profileName}
        </Text>
      )}
      {!profileName && <Box flex={1} />}
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
                color="red.fg"
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
  );
};
