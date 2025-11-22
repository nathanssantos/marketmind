import { Box, Flex, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import { Button } from '@renderer/components/ui/button';
import { useTradingStore } from '@renderer/store/tradingStore';
import type { Wallet } from '@shared/types/trading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuPlus, LuTrash2, LuTrendingUp } from 'react-icons/lu';
import { CreateWalletDialog } from './CreateWalletDialog';
import { WalletPerformanceDialog } from './WalletPerformanceDialog';

export const WalletManager = () => {
  const { t } = useTranslation();
  const wallets = useTradingStore((state) => state.wallets);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const addWallet = useTradingStore((state) => state.addWallet);
  const setActiveWallet = useTradingStore((state) => state.setActiveWallet);
  const deleteWallet = useTradingStore((state) => state.deleteWallet);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  return (
    <Stack gap={2} p={4}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.wallets.title')}
        </Text>
        <Button
          size="2xs"
          colorPalette="blue"
          onClick={() => setShowCreateDialog(true)}
        >
          <LuPlus />
          {t('trading.wallets.create')}
        </Button>
      </Flex>

      <Box maxH="calc(100vh - 250px)" overflowY="auto">
        {wallets.length === 0 ? (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="fg.muted">
              {t('trading.wallets.empty')}
            </Text>
          </Box>
        ) : (
          <Stack gap={2}>
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                isActive={wallet.id === activeWalletId}
                onSelect={() => setActiveWallet(wallet.id)}
                onDelete={() => deleteWallet(wallet.id)}
                onViewPerformance={() => {
                  setSelectedWalletId(wallet.id);
                  setShowPerformanceDialog(true);
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      <CreateWalletDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={addWallet}
      />

      <WalletPerformanceDialog
        isOpen={showPerformanceDialog}
        onClose={() => {
          setShowPerformanceDialog(false);
          setSelectedWalletId(null);
        }}
        walletId={selectedWalletId}
      />
    </Stack>
  );
};

interface WalletCardProps {
  wallet: Wallet;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onViewPerformance: () => void;
}

const WalletCard = ({ wallet, isActive, onSelect, onDelete, onViewPerformance }: WalletCardProps) => {
  const { t } = useTranslation();
  const totalPnL = wallet.balance - wallet.initialBalance;
  const totalPnLPercent = (totalPnL / wallet.initialBalance) * 100;
  const isProfitable = totalPnL >= 0;

  return (
    <Box
      p={3}
      bg={isActive ? 'blue.50' : 'bg.muted'}
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isActive ? 'blue.500' : isProfitable ? 'green.500' : 'red.500'}
      cursor="pointer"
      onClick={onSelect}
      _hover={{ bg: isActive ? 'blue.100' : 'bg.subtle' }}
      _dark={{
        bg: isActive ? 'blue.900' : 'bg.muted',
        _hover: { bg: isActive ? 'blue.800' : 'bg.subtle' },
      }}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontWeight="bold" fontSize="sm">
          {wallet.name}
        </Text>
        <MenuRoot id={`wallet-menu-${wallet.id}`} positioning={{ placement: 'bottom-end' }}>
          <MenuTrigger asChild>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Wallet options"
              onClick={(e) => e.stopPropagation()}
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
                <MenuItem
                  value="performance"
                  onClick={onViewPerformance}
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <LuTrendingUp />
                  <Text>{t('trading.wallets.viewPerformance')}</Text>
                </MenuItem>
                <MenuItem
                  value="delete"
                  onClick={onDelete}
                  color="red.500"
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                >
                  <LuTrash2 />
                  <Text>{t('trading.wallets.delete')}</Text>
                </MenuItem>
              </MenuContent>
            </MenuPositioner>
          </Portal>
        </MenuRoot>
      </Flex>

      <Stack gap={1} fontSize="xs">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.balance')}</Text>
          <Text fontWeight="medium">
            {wallet.currency} {wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.initialBalance')}</Text>
          <Text>
            {wallet.currency} {wallet.initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.wallets.totalPnL')}</Text>
          <Text color={isProfitable ? 'green.500' : 'red.500'} fontWeight="medium">
            {isProfitable ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
};
