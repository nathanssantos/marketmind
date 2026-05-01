import { Badge, Button, Popover } from '@renderer/components/ui';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBuilding2, LuCoins, LuSettings, LuWallet } from 'react-icons/lu';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { useDisclosure } from '../hooks/useDisclosure';
import { WalletsDialog } from './Trading/WalletsDialog';

const WalletSelectorComponent = () => {
  const { t } = useTranslation();
  const { activeWallet, wallets, setActiveWalletId, isLoading } = useActiveWallet();
  const [isOpen, setIsOpen] = useState(false);
  const manageDialog = useDisclosure();

  if (isLoading) return null;

  if (wallets.length === 0) {
    return (
      <>
        <Button
          size="2xs"
          variant="outline"
          color="fg.muted"
          onClick={manageDialog.open}
          aria-label={t('walletSelector.manage')}
          data-testid="wallet-selector-empty"
        >
          <LuWallet />
          {t('walletSelector.noWallets')}
        </Button>
        <WalletsDialog isOpen={manageDialog.isOpen} onClose={manageDialog.close} />
      </>
    );
  }

  const cryptoWallets = wallets.filter((w) => w.exchange !== 'INTERACTIVE_BROKERS');
  const ibWallets = wallets.filter((w) => w.exchange === 'INTERACTIVE_BROKERS');

  const openManage = () => {
    setIsOpen(false);
    manageDialog.open();
  };

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(details) => setIsOpen(details.open)}
        showArrow={false}
        width="280px"
        positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}
        trigger={
          <Button
            size="2xs"
            variant="outline"
            color="fg.muted"
            aria-label={t('walletSelector.title')}
          >
            <LuWallet />
            {activeWallet?.name ?? t('walletSelector.title')}
          </Button>
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

          <Box h="1px" bg="border" my={1} />
          <Flex
            px={3}
            py={1.5}
            cursor="pointer"
            _hover={{ bg: 'bg.muted' }}
            align="center"
            gap={2}
            onClick={openManage}
            data-testid="wallet-selector-manage"
          >
            <LuSettings size={12} />
            <Text fontSize="xs">{t('walletSelector.manage')}</Text>
          </Flex>
        </Stack>
      </Popover>

      <WalletsDialog isOpen={manageDialog.isOpen} onClose={manageDialog.close} />
    </>
  );
};

export const WalletSelector = memo(WalletSelectorComponent);
