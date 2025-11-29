import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import { useChartContext } from '@renderer/context/ChartContext';
import { useTradingStore } from '@renderer/store/tradingStore';
import type { OrderType } from '@shared/types/trading';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const OrderTicket = () => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();

  const currentPrice = chartData?.candles[chartData.candles.length - 1]?.close;
  const symbol = chartData?.symbol || 'UNKNOWN';

  const wallets = useTradingStore((state) => state.wallets);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const addOrder = useTradingStore((state) => state.addOrder);
  const getQuantityForSymbol = useTradingStore((state) => state.getQuantityForSymbol);
  const setQuantityForSymbol = useTradingStore((state) => state.setQuantityForSymbol);

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const symbolQuantity = getQuantityForSymbol(symbol);

  const [orderType, setOrderType] = useState<OrderType>('long');
  const [quantity, setQuantity] = useState(symbolQuantity.toString());
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  useEffect(() => {
    setQuantity(getQuantityForSymbol(symbol).toString());
  }, [symbol, getQuantityForSymbol]);

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    const numValue = Number(value);
    if (!isNaN(numValue) && numValue > 0) {
      setQuantityForSymbol(symbol, numValue);
    }
  };

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

    const subType: 'limit' | 'stop' = currentPrice !== undefined
      ? (orderType === 'long'
        ? (entry < currentPrice ? 'limit' : 'stop')
        : (entry > currentPrice ? 'limit' : 'stop'))
      : 'limit';

    const orderData: Omit<import('@shared/types/trading').Order, 'id' | 'createdAt'> = {
      walletId: activeWallet.id,
      symbol,
      type: orderType,
      subType,
      status: 'pending',
      quantity: qty,
      entryPrice: entry,
      ...(stop !== undefined && { stopLoss: stop }),
      ...(target !== undefined && { takeProfit: target }),
      ...(currentPrice !== undefined && { currentPrice }),
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
      <Flex justify="space-between" align="center" mb={1}>
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
              <Select
                size="xs"
                value={orderType}
                onChange={(value) => setOrderType(value as OrderType)}
                options={[
                  { value: 'long', label: t('trading.ticket.long') },
                  { value: 'short', label: t('trading.ticket.short') },
                ]}
                usePortal={false}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.quantity')}</ChakraField.Label>
              <NumberInput
                size="xs"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="0.00"
                step={0.01}
                min={0}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <HStack justify="space-between" mb={1}>
                <ChakraField.Label fontSize="xs" mb={0}>{t('trading.ticket.entryPrice')}</ChakraField.Label>
                <Button
                  size="2xs"
                  variant="ghost"
                  onClick={handleUseCurrentPrice}
                  disabled={!currentPrice}
                  fontSize="xs"
                  colorPalette="blue"
                >
                  {t('trading.ticket.useCurrent')}
                </Button>
              </HStack>
              <NumberInput
                size="xs"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="0.00"
                step={0.01}
                min={0}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.stopLoss')}</ChakraField.Label>
              <NumberInput
                size="xs"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={t('trading.ticket.optional')}
                step={0.01}
                min={0}
              />
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">{t('trading.ticket.takeProfit')}</ChakraField.Label>
              <NumberInput
                size="xs"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder={t('trading.ticket.optional')}
                step={0.01}
                min={0}
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
              size="xs"
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
