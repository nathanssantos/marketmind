import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useLocalStorage } from '@renderer/hooks/useLocalStorage';
import { getKlineClose } from '@shared/utils';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type OrderDirection = 'long' | 'short';

export const OrderTicket = () => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();

  const lastKline = chartData?.klines[chartData.klines.length - 1];
  const currentPrice = lastKline ? getKlineClose(lastKline) : undefined;
  const symbol = chartData?.symbol || 'UNKNOWN';

  const { wallets: backendWallets } = useBackendWallet();
  const activeWalletId = backendWallets[0]?.id;
  const { createOrder } = useBackendTrading(activeWalletId || '', symbol);

  const wallets = backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance || '0'),
    initialBalance: parseFloat(w.initialBalance || '0'),
    currency: (w.currency || 'USDT') as any,
    createdAt: new Date(w.createdAt),
  }));

  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  const [quantityBySymbol, setQuantityBySymbol] = useLocalStorage<Record<string, number>>('marketmind:quantityBySymbol', {});

  const getQuantityForSymbol = (sym: string) => quantityBySymbol[sym] ?? 0;
  const setQuantityForSymbol = (sym: string, qty: number) => {
    setQuantityBySymbol((prev) => ({ ...prev, [sym]: qty }));
  };

  const calculateDefaultQuantity = () => {
    if (!activeWallet || !currentPrice) return 0;
    const tenPercentBalance = activeWallet.balance * 0.1;
    return tenPercentBalance / currentPrice;
  };

  const symbolQuantity = getQuantityForSymbol(symbol);
  const defaultQuantity = symbolQuantity > 0 ? symbolQuantity : calculateDefaultQuantity();

  const [orderType, setOrderType] = useState<OrderDirection>('long');
  const [quantity, setQuantity] = useState(defaultQuantity.toFixed(8));
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  useEffect(() => {
    const storedQty = getQuantityForSymbol(symbol);
    const newQty = storedQty > 0 ? storedQty : calculateDefaultQuantity();
    setQuantity(newQty.toFixed(8));
  }, [symbol, activeWallet?.balance, currentPrice]);

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    const numValue = Number(value);
    if (!isNaN(numValue) && numValue > 0) {
      setQuantityForSymbol(symbol, numValue);
    }
  };

  const handleSubmit = async () => {
    if (!activeWallet || !quantity || !entryPrice || !activeWalletId) return;

    const qty = Number(quantity);
    const entry = Number(entryPrice);
    const stop = stopLoss ? Number(stopLoss) : undefined;

    if (isNaN(qty) || qty <= 0) return;
    if (isNaN(entry) || entry <= 0) return;
    if (stop !== undefined && (isNaN(stop) || stop <= 0)) return;

    const cost = qty * entry;
    if (cost > activeWallet.balance) return;

    await createOrder({
      walletId: activeWalletId,
      symbol,
      side: orderType === 'long' ? 'BUY' : 'SELL',
      type: 'LIMIT',
      quantity: qty.toString(),
      price: entry.toString(),
      ...(stop !== undefined && { stopPrice: stop.toString() }),
    });

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
                onChange={(value) => setOrderType(value as OrderDirection)}
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
