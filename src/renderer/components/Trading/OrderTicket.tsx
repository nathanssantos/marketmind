import { Box, Button, Flex, Input, NativeSelectField, NativeSelectRoot, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import type { OrderType } from '@shared/types/trading';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const OrderTicket = () => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();
  
  const currentPrice = chartData?.candles[chartData.candles.length - 1]?.close;
  const symbol = chartData?.symbol || 'UNKNOWN';
  
  const wallets = useTradingStore((state) => state.wallets);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const addOrder = useTradingStore((state) => state.addOrder);

  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  const [orderType, setOrderType] = useState<OrderType>('long');
  const [quantity, setQuantity] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const handleSubmit = () => {
    if (!activeWallet || !quantity || !entryPrice) return;

    const qty = Number(quantity);
    const entry = Number(entryPrice);
    const stop = stopLoss ? Number(stopLoss) : undefined;
    const target = takeProfit ? Number(takeProfit) : undefined;

    if (isNaN(qty) || qty <= 0) return;
    if (isNaN(entry) || entry <= 0) return;
    if (stop !== undefined && (isNaN(stop) || stop <= 0)) return;
    if (target !== undefined && (isNaN(target) || target <= 0)) return;

    const cost = qty * entry;
    if (cost > activeWallet.balance) return;

    const orderData: Omit<import('@shared/types/trading').Order, 'id' | 'createdAt'> = {
      walletId: activeWallet.id,
      symbol,
      type: orderType,
      status: 'active',
      quantity: qty,
      entryPrice: entry,
      ...(stop !== undefined && { stopLoss: stop }),
      ...(target !== undefined && { takeProfit: target }),
    };

    addOrder(orderData);

    setQuantity('');
    setEntryPrice('');
    setStopLoss('');
    setTakeProfit('');
  };

  const handleUseCurrentPrice = () => {
    if (!currentPrice) return;
    setEntryPrice(currentPrice.toFixed(2));
  };

  const qty = Number(quantity) || 0;
  const entry = Number(entryPrice) || 0;
  const cost = qty * entry;
  const canAfford = activeWallet ? cost <= activeWallet.balance : false;
  const isValid = qty > 0 && entry > 0 && canAfford;

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.ticket.title')}
        </Text>
      </Flex>

      {!activeWallet ? (
        <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
          <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
            {t('trading.ticket.noWallet')}
          </Text>
        </Box>
      ) : (
        <>
          <Box p={3} bg="bg.muted" borderRadius="md">
            <Flex justify="space-between" fontSize="xs" mb={1}>
              <Text color="fg.muted">{t('trading.ticket.activeWallet')}</Text>
              <Text fontWeight="medium">{activeWallet.name}</Text>
            </Flex>
            <Flex justify="space-between" fontSize="xs">
              <Text color="fg.muted">{t('trading.wallets.balance')}</Text>
              <Text fontWeight="medium">
                {activeWallet.currency} {activeWallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Flex>
          </Box>

          <Stack gap={3}>
            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.orderType')}</ChakraField.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                  fontSize="sm"
                >
                  <option value="long">{t('trading.ticket.long')}</option>
                  <option value="short">{t('trading.ticket.short')}</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.quantity')}</ChakraField.Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                fontSize="sm"
                step="0.01"
                min="0"
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <Flex justify="space-between" align="center" mb={1}>
                <ChakraField.Label fontSize="xs" mb={0}>{t('trading.ticket.entryPrice')}</ChakraField.Label>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleUseCurrentPrice}
                  disabled={!currentPrice}
                  fontSize="xs"
                >
                  {t('trading.ticket.useCurrent')}
                </Button>
              </Flex>
              <Input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="0.00"
                fontSize="sm"
                step="0.01"
                min="0"
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.stopLoss')}</ChakraField.Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={t('trading.ticket.optional')}
                fontSize="sm"
                step="0.01"
                min="0"
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.takeProfit')}</ChakraField.Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder={t('trading.ticket.optional')}
                fontSize="sm"
                step="0.01"
                min="0"
              />
            </ChakraField.Root>

            {cost > 0 && (
              <Box p={3} bg="bg.muted" borderRadius="md">
                <Flex justify="space-between" fontSize="xs">
                  <Text color="fg.muted">{t('trading.ticket.totalCost')}</Text>
                  <Text fontWeight="medium" color={canAfford ? 'fg.default' : 'red.500'}>
                    {activeWallet.currency} {cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </Flex>
              </Box>
            )}

            <Button
              colorPalette={orderType === 'long' ? 'green' : 'red'}
              onClick={handleSubmit}
              disabled={!isValid}
              width="full"
            >
              {orderType === 'long' ? t('trading.ticket.buy') : t('trading.ticket.sell')}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
};
