import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useTranslation } from 'react-i18next';

export const Portfolio = () => {
  const { t } = useTranslation();
  const wallets = useTradingStore((state) => state.wallets);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const getPositions = useTradingStore((state) => state.getPositions);

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const positions = activeWallet ? getPositions(activeWallet.id) : [];

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.reduce((sum, pos) => sum + pos.pnlPercent, 0) / (positions.length || 1);

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={2}>
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
                <Text color="fg.muted">{t('trading.portfolio.totalPositions')}</Text>
                <Text fontWeight="medium">{positions.length}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.totalPnL')}</Text>
                <Text fontWeight="medium" color={totalPnL >= 0 ? 'green.500' : 'red.500'}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}({totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                </Text>
              </Flex>
            </Stack>
          </Box>

          <Stack gap={2}>
            {positions.map((position) => (
              <PositionCard key={position.symbol} position={position} currency={activeWallet.currency} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
};

interface PositionCardProps {
  position: import('@shared/types/trading').Position;
  currency: import('@shared/types/trading').WalletCurrency;
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
