import { Box, Flex, IconButton, Portal, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
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
