import { Badge, Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { BrlValue } from '@renderer/components/ui/BrlValue';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Select } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { useChartContext } from '@renderer/context/ChartContext';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useToast } from '@renderer/hooks/useToast';
import { getKlineClose, roundTradingPrice, roundTradingQty } from '@shared/utils';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../utils/trpc';

type OrderDirection = 'long' | 'short';
type MarketType = 'SPOT' | 'FUTURES';

const OrderTicketComponent = () => {
  const { t } = useTranslation();
  const { error: toastError } = useToast();
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

  const { data: autoConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId: activeWalletId! },
    { enabled: !!activeWalletId }
  );

  const utils = trpc.useUtils();
  const updateConfig = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => { void utils.autoTrading.getConfig.invalidate(); },
  });

  const activeWallet = rawActiveWallet ? {
    id: rawActiveWallet.id,
    name: rawActiveWallet.name,
    balance: parseFloat(rawActiveWallet.currentBalance || '0'),
    initialBalance: parseFloat(rawActiveWallet.initialBalance || '0'),
    currency: (rawActiveWallet.currency || 'USDT') as 'USDT' | 'BTC' | 'ETH',
    createdAt: new Date(rawActiveWallet.createdAt),
  } : undefined;

  const calculateQtyFromPercent = (sizePercent: number, price: number, balance: number) =>
    balance > 0 && price > 0 ? (balance * sizePercent) / 100 / price : 0;

  const calculatePercentFromQty = (qty: number, price: number, balance: number) =>
    balance > 0 && price > 0 ? (qty * price * 100) / balance : 0;

  const [marketType, setMarketType] = useState<MarketType>('FUTURES');
  const [orderType, setOrderType] = useState<OrderDirection>('long');
  const [quantity, setQuantity] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSSED'>('CROSSED');
  const [autoTradePercent, setAutoTradePercent] = useState(10);
  const [manualPercent, setManualPercent] = useState(2.5);
  const manualPercentRef = useRef(2.5);

  useEffect(() => {
    if (isIB) setMarketType('SPOT');
  }, [isIB]);

  useEffect(() => {
    if (!autoConfig) return;
    if (autoConfig.leverage) setLeverage(autoConfig.leverage);
    if (autoConfig.marginType) setMarginType(autoConfig.marginType);
    setAutoTradePercent(Number(autoConfig.positionSizePercent ?? 10));
    const newManualPct = Number(autoConfig.manualPositionSizePercent ?? 2.5);
    manualPercentRef.current = newManualPct;
    setManualPercent(newManualPct);
  }, [autoConfig?.leverage, autoConfig?.marginType, autoConfig?.positionSizePercent, autoConfig?.manualPositionSizePercent]);

  useEffect(() => {
    const balance = activeWallet?.balance ?? 0;
    const price = currentPrice ?? 0;
    const qty = calculateQtyFromPercent(manualPercentRef.current, price, balance);
    if (qty > 0) setQuantity(roundTradingQty(qty));
  }, [symbol, activeWallet?.balance, currentPrice]);

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    const balance = activeWallet?.balance ?? 0;
    const price = currentPrice ?? 0;
    const pct = calculatePercentFromQty(Number(value) || 0, price, balance);
    if (pct > 0 && pct <= 100) {
      const rounded = Math.round(pct * 10) / 10;
      manualPercentRef.current = rounded;
      setManualPercent(rounded);
    }
  };

  const handleManualPercentChange = (value: number) => {
    manualPercentRef.current = value;
    setManualPercent(value);
    const balance = activeWallet?.balance ?? 0;
    const price = currentPrice ?? 0;
    const qty = calculateQtyFromPercent(value, price, balance);
    if (qty > 0) setQuantity(roundTradingQty(qty));
  };

  const handleSaveConfig = (patch: { positionSizePercent?: string; manualPositionSizePercent?: string }) => {
    if (!activeWalletId) return;
    updateConfig.mutate({ walletId: activeWalletId, ...patch });
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
    const submitEffectiveCost = marketType === 'FUTURES' ? cost / leverage : cost;
    if (submitEffectiveCost > activeWallet.balance) return;

    const roundedPrice = roundTradingPrice(entry);
    const roundedQty = roundTradingQty(qty);
    const roundedStop = stop !== undefined ? roundTradingPrice(stop) : undefined;

    try {
      if (marketType === 'FUTURES') {
        await futuresTrading.createOrder({
          walletId: activeWalletId,
          symbol,
          side: orderType === 'long' ? 'BUY' : 'SELL',
          type: 'LIMIT',
          quantity: roundedQty,
          price: roundedPrice,
          leverage,
          marginType,
          ...(roundedStop !== undefined && { stopPrice: roundedStop }),
          stopLoss: stopLoss ? roundTradingPrice(Number(stopLoss)) : undefined,
          takeProfit: takeProfit ? roundTradingPrice(Number(takeProfit)) : undefined,
        });
      } else {
        await spotTrading.createOrder({
          walletId: activeWalletId,
          symbol,
          side: orderType === 'long' ? 'BUY' : 'SELL',
          type: 'LIMIT',
          quantity: roundedQty,
          price: roundedPrice,
          ...(roundedStop !== undefined && { stopPrice: roundedStop }),
        });
      }

      setEntryPrice('');
      setStopLoss('');
      setTakeProfit('');
    } catch (err) {
      toastError(t('trading.order.failed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleUseCurrentPrice = () => {
    if (!currentPrice) return;
    setEntryPrice(roundTradingPrice(currentPrice));
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

            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="xs" fontWeight="medium">{t('watcherManager.positionSize.sizePercent')}</Text>
                <Text fontSize="xs" color="fg.muted">{autoTradePercent}%</Text>
              </Flex>
              <Slider
                value={[autoTradePercent]}
                onValueChange={(values) => setAutoTradePercent(values[0] ?? 10)}
                onValueChangeEnd={(values) => handleSaveConfig({ positionSizePercent: String(values[0] ?? 10) })}
                min={0.1}
                max={100}
                step={0.1}
              />
            </Box>

            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="xs" fontWeight="medium">{t('watcherManager.positionSize.manualSizePercent')}</Text>
                <Text fontSize="xs" color="fg.muted">{manualPercent}%</Text>
              </Flex>
              <Slider
                value={[manualPercent]}
                onValueChange={(values) => handleManualPercentChange(values[0] ?? 2.5)}
                onValueChangeEnd={(values) => handleSaveConfig({ manualPositionSizePercent: String(values[0] ?? 2.5) })}
                min={0.1}
                max={100}
                step={0.1}
              />
            </Box>

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
