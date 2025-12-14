import { Box, Flex, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { Wallet } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { TooltipWrapper } from '@renderer/components/ui/Tooltip';
import { useBackendAnalytics } from '@renderer/hooks/useBackendAnalytics';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuChartBar, LuInfo, LuPlus, LuTrash2 } from 'react-icons/lu';
import { CreateWalletDialog } from './CreateWalletDialog';
import { WalletPerformanceModal } from './WalletPerformanceModal';

export const WalletManager = () => {
  const { t } = useTranslation();

  const {
    wallets: backendWalletsData,
    isLoading,
    deleteWallet,
    createPaperWallet,
    isDeleting,
    isCreatingPaper: isCreatingPaperWallet,
  } = useBackendWallet();

  const wallets: Wallet[] = useMemo(() => {
    return backendWalletsData.map((w): Wallet => ({
      id: w.id,
      name: w.name,
      balance: parseFloat(w.currentBalance || '0'),
      initialBalance: parseFloat(w.initialBalance || '0'),
      currency: (w.currency || 'USDT') as 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC' | 'ETH',
      createdAt: new Date(w.createdAt),
      performance: [],
      makerCommission: 0,
      takerCommission: 0,
      buyerCommission: 0,
      sellerCommission: 0,
      commissionRates: {
        maker: '0',
        taker: '0',
        buyer: '0',
        seller: '0',
      },
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      brokered: false,
      requireSelfTradePrevention: false,
      preventSor: false,
      updateTime: Date.now(),
      accountType: 'SPOT',
      balances: [],
      permissions: ['SPOT'],
    }));
  }, [backendWalletsData]);

  const activeWalletId = wallets[0]?.id ?? null;

  const handleAddWallet = async (params: {
    name: string;
    initialBalance: number;
    currency: 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC' | 'ETH';
  }) => {
    await createPaperWallet({
      name: params.name,
      initialBalance: params.initialBalance.toString(),
      currency: params.currency,
    });
  };

  const handleDeleteWallet = async (id: string) => {
    await deleteWallet(id);
  };

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [performanceWalletId, setPerformanceWalletId] = useState<string | null>(null);

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
          loading={isCreatingPaperWallet}
        >
          <LuPlus />
          {t('trading.wallets.create')}
        </Button>
      </Flex>

      <Box maxH="calc(100vh - 250px)" overflowY="auto">
        {isLoading ? (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="fg.muted">
              {t('common.loading')}
            </Text>
          </Box>
        ) : wallets.length === 0 ? (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="fg.muted">
              {t('trading.wallets.emptyReal')}
            </Text>
          </Box>
        ) : (
          <Stack gap={2}>
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                isActive={wallet.id === activeWalletId}
                onDelete={() => handleDeleteWallet(wallet.id)}
                onViewPerformance={() => setPerformanceWalletId(wallet.id)}
                isDeleting={isDeleting}
              />
            ))}
          </Stack>
        )}
      </Box>

      <CreateWalletDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleAddWallet}
      />

      <WalletPerformanceModal
        isOpen={performanceWalletId !== null}
        onClose={() => setPerformanceWalletId(null)}
        walletId={performanceWalletId}
      />
    </Stack>
  );
};

interface WalletCardProps {
  wallet: Wallet;
  isActive: boolean;
  onDelete: () => void;
  onViewPerformance: () => void;
  isDeleting?: boolean;
}

const PERCENT_MULTIPLIER = 100;

const WalletCard = ({ wallet, isActive, onDelete, onViewPerformance, isDeleting = false }: WalletCardProps) => {
  const { t } = useTranslation();
  const { performance } = useBackendAnalytics(wallet.id, 'all');

  const netPnL = wallet.balance - wallet.initialBalance;
  const netPnLPercent = wallet.initialBalance > 0 ? (netPnL / wallet.initialBalance) * PERCENT_MULTIPLIER : 0;
  const isProfitable = netPnL >= 0;

  const totalFees = performance?.totalFees ?? 0;
  const grossPnL = netPnL + totalFees;

  return (
    <Box
      p={3}
      bg={isActive ? 'blue.50' : 'bg.muted'}
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isActive ? 'blue.500' : isProfitable ? 'green.500' : 'red.500'}
      _dark={{
        bg: isActive ? 'blue.900' : 'bg.muted',
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
              disabled={isDeleting}
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
                >
                  <LuChartBar />
                  <Text>{t('trading.wallets.viewPerformance')}</Text>
                </MenuItem>
                <MenuItem
                  value="delete"
                  onClick={onDelete}
                  color="red.500"
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                  disabled={isDeleting}
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
          <Text color="fg.muted">{t('trading.wallets.netPnL')}</Text>
          <TooltipWrapper label={`${t('trading.analytics.performance.grossPnL')}: ${grossPnL >= 0 ? '+' : ''}${grossPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${t('trading.analytics.performance.fees')}: ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} isDisabled={totalFees === 0}>
            <Text color={isProfitable ? 'green.500' : 'red.500'} fontWeight="medium" cursor={totalFees > 0 ? 'help' : 'default'}>
              {isProfitable ? '+' : ''}{netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}({isProfitable ? '+' : ''}{netPnLPercent.toFixed(2)}%)
              {totalFees > 0 && <LuInfo style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />}
            </Text>
          </TooltipWrapper>
        </Flex>
      </Stack>
    </Box>
  );
};
