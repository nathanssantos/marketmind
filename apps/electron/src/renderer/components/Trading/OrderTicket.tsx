import { Badge, Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { BrlValue } from '@renderer/components/ui/BrlValue';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useLocalStorage } from '@renderer/hooks/useLocalStorage';
import { getKlineClose } from '@shared/utils';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type OrderDirection = 'long' | 'short';
type MarketType = 'SPOT' | 'FUTURES';

const OrderTicketComponent = () => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();

  const { currentPrice, symbol } = useMemo(() => {
    const lastKline = chartData?.klines[chartData.klines.length - 1];
    return {
      currentPrice: lastKline ? getKlineClose(lastKline) : undefined,
      symbol: chartData?.symbol || 'UNKNOWN',
    };
  }, [chartData?.klines.length, chartData?.symbol]);

  const { activeWallet: rawActiveWallet, isIB } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;

  const spotTrading = useBackendTrading(activeWalletId || '', symbol);
  const futuresTrading = useBackendFuturesTrading(activeWalletId || '', symbol);

  const activeWallet = rawActiveWallet ? {
    id: rawActiveWallet.id,
    name: rawActiveWallet.name,
    balance: parseFloat(rawActiveWallet.currentBalance || '0'),
    initialBalance: parseFloat(rawActiveWallet.initialBalance || '0'),
    currency: (rawActiveWallet.currency || 'USDT') as 'USDT' | 'BTC' | 'ETH',
    createdAt: new Date(rawActiveWallet.createdAt),
  } : undefined;

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

  const [marketType, setMarketType] = useState<MarketType>('FUTURES');
  const [orderType, setOrderType] = useState<OrderDirection>('long');
  const [quantity, setQuantity] = useState(defaultQuantity.toFixed(8));
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSSED'>('ISOLATED');

  useEffect(() => {
    if (isIB) setMarketType('SPOT');
  }, [isIB]);

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

    if (marketType === 'FUTURES') {
      await futuresTrading.createOrder({
        walletId: activeWalletId,
        symbol,
        side: orderType === 'long' ? 'BUY' : 'SELL',
        type: 'LIMIT',
        quantity: qty.toString(),
        price: entry.toString(),
        leverage,
        marginType,
        ...(stop !== undefined && { stopPrice: stop.toString() }),
      });
    } else {
      await spotTrading.createOrder({
        walletId: activeWalletId,
        symbol,
        side: orderType === 'long' ? 'BUY' : 'SELL',
        type: 'LIMIT',
        quantity: qty.toString(),
        price: entry.toString(),
        ...(stop !== undefined && { stopPrice: stop.toString() }),
      });
    }

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
  const effectiveCost = marketType === 'FUTURES' ? cost / leverage : cost;
  const canAfford = activeWallet ? effectiveCost <= activeWallet.balance : false;
  const isValid = qty > 0 && entry > 0 && canAfford;

  const leverageOptions = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125].map((l) => ({
    value: l.toString(),
    label: `${l}x`,
  }));

  const getLeverageColor = () => {
    if (leverage <= 10) return 'green';
    if (leverage <= 50) return 'orange';
    return 'red';
  };

  return (
    <Stack gap={3} p={4}>
      {!isIB && (
        <Flex justify="flex-end" align="center" mb={1}>
          <HStack gap={1}>
            <Badge
              size="sm"
              colorPalette={marketType === 'SPOT' ? 'blue' : 'gray'}
              cursor="pointer"
              onClick={() => setMarketType('SPOT')}
              variant={marketType === 'SPOT' ? 'solid' : 'subtle'}
              px={3}
            >
              SPOT
            </Badge>
            <Badge
              size="sm"
              colorPalette={marketType === 'FUTURES' ? 'orange' : 'gray'}
              cursor="pointer"
              onClick={() => setMarketType('FUTURES')}
              variant={marketType === 'FUTURES' ? 'solid' : 'subtle'}
              px={3}
            >
              FUTURES
            </Badge>
          </HStack>
        </Flex>
      )}

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
              <Stack gap={0} align="flex-end">
                <Text fontWeight="medium">
                  {activeWallet.currency} {activeWallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <BrlValue usdtValue={activeWallet.balance} />
              </Stack>
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

            {marketType === 'FUTURES' && (
              <>
                <ChakraField.Root>
                  <Flex justify="space-between" align="center" mb={1} gap={2}>
                    <ChakraField.Label fontSize="xs" mb={0}>Leverage</ChakraField.Label>
                    <Badge size="sm" px={2} colorPalette={getLeverageColor()}>{leverage}x</Badge>
                  </Flex>
                  <Select
                    size="xs"
                    value={leverage.toString()}
                    onChange={(value) => setLeverage(Number(value))}
                    options={leverageOptions}
                    usePortal={false}
                  />
                </ChakraField.Root>

                <ChakraField.Root>
                  <ChakraField.Label fontSize="xs">Margin Type</ChakraField.Label>
                  <Select
                    size="xs"
                    value={marginType}
                    onChange={(value) => setMarginType(value as 'ISOLATED' | 'CROSSED')}
                    options={[
                      { value: 'ISOLATED', label: 'Isolated' },
                      { value: 'CROSSED', label: 'Cross' },
                    ]}
                    usePortal={false}
                  />
                </ChakraField.Root>

                {leverage > 20 && (
                  <Box p={2} bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
                    <Text fontSize="xs" color="orange.600" _dark={{ color: 'orange.300' }}>
                      ⚠️ High leverage ({leverage}x) increases liquidation risk
                    </Text>
                  </Box>
                )}
              </>
            )}

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
                <Flex justify="space-between" fontSize="xs" mb={marketType === 'FUTURES' ? 1 : 0}>
                  <Text color="fg.muted">{t('trading.ticket.totalCost')}</Text>
                  <Stack gap={0} align="flex-end">
                    <Text fontWeight="medium" color={canAfford ? 'fg.default' : 'red.500'}>
                      {activeWallet.currency} {cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <BrlValue usdtValue={cost} />
                  </Stack>
                </Flex>
                {marketType === 'FUTURES' && (
                  <Flex justify="space-between" fontSize="xs">
                    <Text color="fg.muted">Margin Required</Text>
                    <Stack gap={0} align="flex-end">
                      <Text fontWeight="medium" color={canAfford ? 'fg.default' : 'red.500'}>
                        {activeWallet.currency} {effectiveCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <BrlValue usdtValue={effectiveCost} />
                    </Stack>
                  </Flex>
                )}
              </Box>
            )}

            <Button
              size="xs"
              colorPalette={orderType === 'long' ? 'green' : 'red'}
              onClick={handleSubmit}
              disabled={!isValid}
              width="full"
            >
              {marketType === 'FUTURES' ? (
                orderType === 'long' ? `Long ${leverage}x` : `Short ${leverage}x`
              ) : (
                orderType === 'long' ? t('trading.ticket.buy') : t('trading.ticket.sell')
              )}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
};

export const OrderTicket = memo(OrderTicketComponent);
