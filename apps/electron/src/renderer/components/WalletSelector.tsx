import { Badge, Box, Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBuilding2, LuChevronDown, LuCoins, LuWallet } from 'react-icons/lu';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { Popover } from './ui/popover';

const WalletSelectorComponent = () => {
  const { t } = useTranslation();
  const { activeWallet, wallets, setActiveWalletId, isLoading } = useActiveWallet();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return null;

  if (wallets.length === 0) {
    return (
      <HStack gap={1} opacity={0.6}>
        <LuWallet size={14} />
        <Text fontSize="xs">{t('walletSelector.noWallets')}</Text>
      </HStack>
    );
  }

  const cryptoWallets = wallets.filter((w) => w.exchange !== 'INTERACTIVE_BROKERS');
  const ibWallets = wallets.filter((w) => w.exchange === 'INTERACTIVE_BROKERS');

  return (
    <Popover
      open={isOpen}
      onOpenChange={(details) => setIsOpen(details.open)}
      width="280px"
      positioning={{ placement: 'bottom-end' }}
      trigger={
        <IconButton
          size="2xs"
          variant="ghost"
          aria-label={t('walletSelector.title')}
        >
          <HStack gap={1}>
            <LuWallet size={14} />
            <Text fontSize="xs" fontWeight="medium" maxW="120px" truncate>
              {activeWallet?.name ?? t('walletSelector.title')}
            </Text>
            <LuChevronDown size={12} />
          </HStack>
        </IconButton>
      }
    >
      <Stack gap={0} py={1}>
        {cryptoWallets.length > 0 && (
          <>
            <Text fontSize="2xs" fontWeight="bold" color="fg.muted" px={3} py={1}>
              {t('walletSelector.crypto')}
            </Text>
            {cryptoWallets.map((wallet) => (
              <Flex
                key={wallet.id}
                px={3}
                py={1.5}
                cursor="pointer"
                _hover={{ bg: 'bg.muted' }}
                align="center"
                justify="space-between"
                bg={wallet.id === activeWallet?.id ? 'bg.subtle' : undefined}
                onClick={() => {
                  setActiveWalletId(wallet.id);
                  setIsOpen(false);
                }}
              >
                <HStack gap={2}>
                  <LuCoins size={12} />
                  <Text fontSize="xs">{wallet.name}</Text>
                </HStack>
                <Badge size="sm" variant="subtle" colorPalette={wallet.walletType === 'live' ? 'green' : wallet.walletType === 'paper' ? 'blue' : 'orange'}>
                  {wallet.walletType}
                </Badge>
              </Flex>
            ))}
          </>
        )}

        {ibWallets.length > 0 && (
          <>
            {cryptoWallets.length > 0 && <Box h="1px" bg="border" my={1} />}
            <Text fontSize="2xs" fontWeight="bold" color="fg.muted" px={3} py={1}>
              {t('walletSelector.stocks')}
            </Text>
            {ibWallets.map((wallet) => (
              <Flex
                key={wallet.id}
                px={3}
                py={1.5}
                cursor="pointer"
                _hover={{ bg: 'bg.muted' }}
                align="center"
                justify="space-between"
                bg={wallet.id === activeWallet?.id ? 'bg.subtle' : undefined}
                onClick={() => {
                  setActiveWalletId(wallet.id);
                  setIsOpen(false);
                }}
              >
                <HStack gap={2}>
                  <LuBuilding2 size={12} />
                  <Text fontSize="xs">{wallet.name}</Text>
                </HStack>
                <Badge size="sm" variant="subtle" colorPalette={wallet.walletType === 'live' ? 'green' : wallet.walletType === 'paper' ? 'blue' : 'orange'}>
                  {wallet.walletType}
                </Badge>
              </Flex>
            ))}
          </>
        )}
      </Stack>
    </Popover>
  );
};

export const WalletSelector = memo(WalletSelectorComponent);
