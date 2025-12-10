import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const Portfolio = () => {
  const { t } = useTranslation();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);

  const simulatorWallets = useTradingStore((state) => state.wallets);
  const simulatorActiveWalletId = useTradingStore((state) => state.activeWalletId);
  const getSimulatorPositions = useTradingStore((state) => state.getPositions);

  const { wallets: backendWallets } = useBackendWallet();
  const backendActiveWalletId = backendWallets[0]?.id;
  const { positions: backendPositionsData } = useBackendTrading(
    backendActiveWalletId || '',
    undefined
  );

  const backendPositions = useMemo(() => {
    return backendPositionsData.map((p) => ({
      symbol: p.symbol,
      quantity: parseFloat(p.entryQty || '0'),
      avgPrice: parseFloat(p.entryPrice || '0'),
      currentPrice: parseFloat(p.currentPrice || p.entryPrice || '0'),
      pnl: 0,
      pnlPercent: 0,
      orders: [p.id],
    }));
  }, [backendPositionsData]);

  const wallets = isSimulatorActive ? simulatorWallets : backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance || '0'),
    initialBalance: parseFloat(w.initialBalance || '0'),
    currency: (w.currency || 'USDT') as any,
    createdAt: new Date(w.createdAt),
    performance: [],
    makerCommission: 0,
    takerCommission: 0,
    buyerCommission: 0,
    sellerCommission: 0,
    commissionRates: { maker: '0', taker: '0', buyer: '0', seller: '0' },
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    brokered: false,
    requireSelfTradePrevention: false,
    preventSor: false,
    updateTime: Date.now(),
    accountType: 'SPOT' as const,
    balances: [],
    permissions: ['SPOT'],
  }));

  const activeWalletId = isSimulatorActive ? simulatorActiveWalletId : backendActiveWalletId;
  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const positions = isSimulatorActive
    ? (activeWallet ? getSimulatorPositions(activeWallet.id) : [])
    : backendPositions;

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.reduce((sum, pos) => sum + pos.pnlPercent, 0) / (positions.length || 1);

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.portfolio.title')}
        </Text>
      </Flex>

      {!activeWallet ? (
        <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
          <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
            {t('trading.portfolio.noWallet')}
          </Text>
        </Box>
      ) : positions.length === 0 ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="fg.muted">
            {t('trading.portfolio.empty')}
          </Text>
        </Box>
      ) : (
        <>
          <Box p={3} bg="bg.muted" borderRadius="md">
            <Stack gap={1} fontSize="xs">
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.activePositions')}</Text>
                <Text fontWeight="medium">{positions.length}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.totalExposure')}</Text>
                <Text fontWeight="medium">
                  {activeWallet.currency} {positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.unrealizedPnL')}</Text>
                <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                </Text>
              </Flex>
            </Stack>
          </Box>

          <Box maxH="calc(100vh - 400px)" overflowY="auto">
            <Stack gap={2}>
              {positions.map((position) => (
                <PositionCard key={position.symbol} position={position} currency={activeWallet.currency} />
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
};

interface PositionCardProps {
  position: import('@marketmind/types').Position;
  currency: import('@marketmind/types').WalletCurrency;
}

const PositionCard = ({ position, currency }: PositionCardProps) => {
  const { t } = useTranslation();
  const isProfitable = position.pnl >= 0;

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isProfitable ? 'green.500' : 'red.500'}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontWeight="bold" fontSize="sm">
          {position.symbol}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {position.orders.length} {t('trading.portfolio.orders')}
        </Text>
      </Flex>

      <Stack gap={1} fontSize="xs">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.quantity')}</Text>
          <Text fontWeight="medium">{position.quantity.toFixed(8)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.avgPrice')}</Text>
          <Text>{currency} {position.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.currentPrice')}</Text>
          <Text>{currency} {position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.pnl')}</Text>
          <Text fontWeight="medium" color={isProfitable ? 'green.500' : 'red.500'}>
            {isProfitable ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
};
