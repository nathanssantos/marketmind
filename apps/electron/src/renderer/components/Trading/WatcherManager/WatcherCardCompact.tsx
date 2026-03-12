import { Box, Flex, Portal, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { CryptoIcon, IconButton } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuPause } from 'react-icons/lu';

export interface WatcherCardCompactProps {
  symbol: string;
  interval: string;
  profileName?: string;
  marketType?: 'SPOT' | 'FUTURES';
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
          bg={{ base: 'blue.100', _dark: 'blue.900' }}
          color={{ base: 'blue.800', _dark: 'blue.200' }}
          borderRadius="sm"
          fontSize="2xs"
        >
          {interval}
        </Box>
        <Box
          px={1.5}
          py={0.5}
          bg={marketType === 'FUTURES'
            ? { base: 'orange.100', _dark: 'orange.900' }
            : { base: 'green.100', _dark: 'green.900' }}
          color={marketType === 'FUTURES'
            ? { base: 'orange.800', _dark: 'orange.200' }
            : { base: 'green.800', _dark: 'green.200' }}
          borderRadius="sm"
          fontSize="2xs"
          fontWeight="medium"
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
