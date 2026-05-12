import type { MarketType } from '@marketmind/types';
import { Button, ConfirmationDialog, IconButton, Input, Menu, Slider, Switch } from '@renderer/components/ui';
import { Box, Flex, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBookTicker } from '@renderer/hooks/useBookTicker';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useOrderQuantity } from '@renderer/hooks/useOrderQuantity';
import { useToast } from '@renderer/hooks/useToast';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { useUIPref } from '@renderer/store/preferencesStore';
import { formatChartPrice } from '@renderer/utils/formatters';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { calculateLiquidationPrice } from '@marketmind/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuEllipsisVertical, LuGrid3X3, LuGripVertical, LuMinus, LuPlus, LuShield } from 'react-icons/lu';
import { PiBroom } from 'react-icons/pi';
import { GridOrderPopover } from './GridOrderPopover';
import { LeveragePopover } from './LeveragePopover';
import { TrailingStopPopover } from './TrailingStopPopover';

type OrderTypeChoice = 'MARKET' | 'LIMIT';

const ActionRow = ({ icon, label, onClick, loading, disabled, children }: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) => (
  <Flex
    align="center"
    gap={2}
    px={2}
    py={1}
    cursor={disabled ? 'default' : 'pointer'}
    borderRadius="sm"
    opacity={disabled ? 0.4 : 1}
    _hover={disabled ? {} : { bg: 'bg.muted' }}
    onClick={disabled || loading ? undefined : onClick}
  >
    {children ?? icon}
    <Text fontSize="xs" color="fg.muted">{label}</Text>
    {loading && <Spinner size="xs" />}
  </Flex>
);

const SIZE_PRESETS = [10, 25, 50, 75, 100] as const;
const SNAP_THRESHOLD = 16;
const EDGE_PADDING = 8;

interface BuySellButtonsProps {
  symbol: string;
  currentPrice: number;
  isCreatingOrder: boolean;
  onPlaceOrder: (side: 'BUY' | 'SELL', price: number) => void;
  buyLabel: string;
  sellLabel: string;
}

const BuySellButtons = memo(({ symbol, currentPrice, isCreatingOrder, onPlaceOrder, buyLabel, sellLabel }: BuySellButtonsProps) => {
  const { bidPrice, askPrice } = useBookTicker(symbol);
  const buyPrice = askPrice > 0 ? askPrice : currentPrice;
  const sellPrice = bidPrice > 0 ? bidPrice : currentPrice;
  const spread = askPrice > 0 && bidPrice > 0 ? askPrice - bidPrice : 0;
  const onBuy = useCallback(() => onPlaceOrder('BUY', buyPrice), [onPlaceOrder, buyPrice]);
  const onSell = useCallback(() => onPlaceOrder('SELL', sellPrice), [onPlaceOrder, sellPrice]);

  return (
    <>
      <Button size="2xs" fontSize="2xs" h="34px" colorPalette="green" variant="solid" onClick={onBuy} loading={isCreatingOrder} flex={1}>
        <VStack gap={0} lineHeight="1">
          <Text fontSize="2xs">{buyLabel}</Text>
          <Text fontSize="2xs" fontWeight="bold">{buyPrice > 0 ? formatChartPrice(buyPrice) : '—'}</Text>
        </VStack>
      </Button>
      <Box
        h="34px"
        w="32px"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
      >
        <Text fontSize="2xs" color="fg.muted" lineHeight="1" whiteSpace="nowrap">
          {spread > 0 ? spread.toFixed(2) : '—'}
        </Text>
      </Box>
      <Button size="2xs" fontSize="2xs" h="34px" colorPalette="red" variant="solid" onClick={onSell} loading={isCreatingOrder} flex={1}>
        <VStack gap={0} lineHeight="1">
          <Text fontSize="2xs">{sellLabel}</Text>
          <Text fontSize="2xs" fontWeight="bold">{sellPrice > 0 ? formatChartPrice(sellPrice) : '—'}</Text>
        </VStack>
      </Button>
    </>
  );
});
BuySellButtons.displayName = 'BuySellButtons';

interface TradeTicketActionsProps {
  symbol: string;
  marketType?: MarketType;
  showDragHandle?: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  onClose?: () => void;
}

export const TradeTicketActions = memo(({ symbol, marketType = 'FUTURES', showDragHandle, onDragStart, isDragging, onClose }: TradeTicketActionsProps) => {
  if (perfMonitor.isEnabled()) perfMonitor.recordComponentRender('TradeTicket');
  const { t } = useTranslation();
  const { warning, error: toastError } = useToast();
  const { activeWallet } = useActiveWallet();
  const { createOrder, isCreatingOrder } = useBackendTradingMutations();
  const { sizePercent, setSizePercent } = useQuickTradeStore();

  const {
    cancelAllOrders,
    isCancellingAllOrders,
  } = useBackendFuturesTrading(activeWallet?.id ?? '');
  const [showCancelOrdersConfirm, setShowCancelOrdersConfirm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ side: 'BUY' | 'SELL'; price: number; quantity: string; orderType: OrderTypeChoice; stopLoss?: string; takeProfit?: string } | null>(null);

  const [orderType, setOrderType] = useState<OrderTypeChoice>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [slEnabled, setSlEnabled] = useState(false);
  const [slPrice, setSlPrice] = useState<string>('');
  const [tpEnabled, setTpEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState<string>('');
  const { bidPrice: tickerBid, askPrice: tickerAsk } = useBookTicker(symbol);
  const midPrice = useMemo(() => {
    if (tickerBid > 0 && tickerAsk > 0) return (tickerBid + tickerAsk) / 2;
    return 0;
  }, [tickerBid, tickerAsk]);

  const handleSelectOrderType = useCallback((next: OrderTypeChoice) => {
    setOrderType((prev) => {
      // Auto-fill the limit price ONCE per Market→Limit transition. The
      // user is then free to clear the field and submit (which raises a
      // noPriceError); otherwise the auto-fill would keep restoring the
      // mid price after every clear.
      if (prev === 'MARKET' && next === 'LIMIT' && midPrice > 0) {
        setLimitPrice(midPrice.toString());
      }
      return next;
    });
  }, [midPrice]);

  const handleCancelOrdersClick = useCallback(() => {
    setShowCancelOrdersConfirm(true);
  }, []);

  const handleCancelOrdersConfirm = useCallback(async () => {
    if (!activeWallet?.id) return;
    try {
      await cancelAllOrders({ walletId: activeWallet.id, symbol });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.cancelOrdersFailed'), msg);
    } finally {
      setShowCancelOrdersConfirm(false);
    }
  }, [activeWallet?.id, symbol, cancelAllOrders, toastError, t]);

  const priceSymbols = useMemo(() => [symbol], [symbol]);
  const currentPrice = usePricesForSymbols(priceSymbols)[symbol] ?? 0;

  const { getQuantity, leverage, isReady, notReadyReason } = useOrderQuantity(symbol, marketType);

  const slPriceNum = useMemo(() => (slEnabled ? parseFloat(slPrice) : NaN), [slEnabled, slPrice]);
  const tpPriceNum = useMemo(() => (tpEnabled ? parseFloat(tpPrice) : NaN), [tpEnabled, tpPrice]);

  const isSlInvalidFor = useCallback((side: 'BUY' | 'SELL', entry: number): boolean => {
    if (!slEnabled) return false;
    if (Number.isNaN(slPriceNum) || slPriceNum <= 0) return true;
    return side === 'BUY' ? slPriceNum >= entry : slPriceNum <= entry;
  }, [slEnabled, slPriceNum]);

  const isTpInvalidFor = useCallback((side: 'BUY' | 'SELL', entry: number): boolean => {
    if (!tpEnabled) return false;
    if (Number.isNaN(tpPriceNum) || tpPriceNum <= 0) return true;
    return side === 'BUY' ? tpPriceNum <= entry : tpPriceNum >= entry;
  }, [tpEnabled, tpPriceNum]);

  const handleQuickOrder = useCallback((side: 'BUY' | 'SELL', tickerPrice: number) => {
    if (!activeWallet?.id) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;
    const limitPriceNum = orderType === 'LIMIT' ? parseFloat(limitPrice) : NaN;
    const effectivePrice = orderType === 'LIMIT' ? limitPriceNum : tickerPrice;
    if (!effectivePrice || effectivePrice <= 0 || Number.isNaN(effectivePrice)) {
      toastError(t('chart.quickTrade.noPriceError'));
      return;
    }
    // Refuse to size when leverage / wallet aren't fully loaded.
    // Falling back to leverage=1 has historically shipped scalp-killer
    // 0.006 BTC orders when the user intended ~1 BTC at 15×.
    if (!isReady) {
      toastError(notReadyReason ?? t('chart.quickTrade.invalidQuantityError'));
      return;
    }
    if (isSlInvalidFor(side, effectivePrice)) {
      toastError(t('chart.quickTrade.slInvalid'));
      return;
    }
    if (isTpInvalidFor(side, effectivePrice)) {
      toastError(t('chart.quickTrade.tpInvalid'));
      return;
    }
    const previewQty = getQuantity(effectivePrice);
    if (!previewQty || parseFloat(previewQty) <= 0) {
      toastError(t('chart.quickTrade.invalidQuantityError'));
      return;
    }
    setPendingOrder({
      side,
      price: effectivePrice,
      quantity: previewQty,
      orderType,
      ...(slEnabled && !Number.isNaN(slPriceNum) ? { stopLoss: slPriceNum.toString() } : {}),
      ...(tpEnabled && !Number.isNaN(tpPriceNum) ? { takeProfit: tpPriceNum.toString() } : {}),
    });
  }, [activeWallet?.id, symbol, orderType, limitPrice, getQuantity, isReady, notReadyReason, warning, toastError, t, isSlInvalidFor, isTpInvalidFor, slEnabled, slPriceNum, tpEnabled, tpPriceNum]);

  const handleConfirmOrder = useCallback(async () => {
    if (!activeWallet?.id || !pendingOrder) return;
    try {
      // Send the previewed quantity directly — NOT `percent`.
      // The previous behaviour sent `percent: sizePercent` and let the
      // backend recompute the quantity using `accountInfo.availableBalance`,
      // which differs from the frontend's `wallet.currentBalance` whenever
      // the user has open positions consuming margin. The result was that
      // a user picking 10% saw a preview based on total wallet balance
      // but Binance executed 10% of the live available margin — surprising
      // smaller fills. Sending the quantity guarantees preview == actual.
      await createOrder({
        walletId: activeWallet.id,
        symbol,
        side: pendingOrder.side,
        type: pendingOrder.orderType,
        quantity: pendingOrder.quantity,
        referencePrice: pendingOrder.price,
        ...(pendingOrder.orderType === 'LIMIT' ? { price: pendingOrder.price.toString() } : {}),
        ...(pendingOrder.stopLoss ? { stopLoss: pendingOrder.stopLoss } : {}),
        ...(pendingOrder.takeProfit ? { takeProfit: pendingOrder.takeProfit } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
    } finally {
      setPendingOrder(null);
    }
  }, [activeWallet?.id, symbol, pendingOrder, createOrder, toastError, t]);

  const handleSliderChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined && v !== sizePercent) setSizePercent(v);
  }, [setSizePercent, sizePercent]);
  const handleDecrement = useCallback(() => {
    const next = Math.max(0.1, Math.ceil(sizePercent / 5) * 5 - 5);
    if (next !== sizePercent) setSizePercent(next);
  }, [sizePercent, setSizePercent]);
  const handleIncrement = useCallback(() => {
    const next = Math.min(100, Math.floor(sizePercent / 5) * 5 + 5);
    if (next !== sizePercent) setSizePercent(next);
  }, [sizePercent, setSizePercent]);

  return (
    <>
      <VStack gap={1.5} align="stretch">
        <HStack gap={1} alignItems="center">
          {showDragHandle && (
            <Box
              onMouseDown={onDragStart}
              cursor={isDragging ? 'grabbing' : 'grab'}
              display="flex"
              alignItems="center"
              px={0.5}
              color="fg.muted"
              _hover={{ color: 'fg' }}
              flexShrink={0}
            >
              <LuGripVertical size={12} />
            </Box>
          )}
          <HStack gap={1} flex={1}>
            {SIZE_PRESETS.map((pct) => (
              <Button key={pct} size="2xs" fontSize="xs" px={1} minW={0} h="20px" variant="outline" color={sizePercent === pct ? 'accent.solid' : 'fg.muted'} onClick={() => setSizePercent(pct)}>
                {pct}%
              </Button>
            ))}
            {marketType === 'FUTURES' && (
              <Box ml="auto">
                <LeveragePopover symbol={symbol} />
              </Box>
            )}
          </HStack>
          {onClose && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton size="2xs" variant="outline" color="fg.muted" aria-label="Options" flexShrink={0} h="20px" minW="20px">
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px">
                  <Menu.Item value="close" onClick={onClose}>
                    {t('common.close')}
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          )}
        </HStack>

        <HStack gap={1.5} px={0.5}>
          <Slider value={[sizePercent]} onValueChange={handleSliderChange} min={0.1} max={100} step={0.1} />
          <IconButton
            size="2xs"
            variant="outline"
            aria-label="Decrease size 5%"
            onClick={handleDecrement}
            disabled={sizePercent <= 0.1}
            h="20px"
            minW="20px"
          >
            <LuMinus />
          </IconButton>
          <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="center" lineHeight="1" whiteSpace="nowrap">
            {`${Math.round(sizePercent * 10) / 10}%`}
          </Text>
          <IconButton
            size="2xs"
            variant="outline"
            aria-label="Increase size 5%"
            onClick={handleIncrement}
            disabled={sizePercent >= 100}
            h="20px"
            minW="20px"
          >
            <LuPlus />
          </IconButton>
        </HStack>

        <HStack gap={1} role="tablist" aria-label={t('chart.quickTrade.orderType')}>
          <Button
            size="2xs"
            fontSize="xs"
            h="22px"
            flex={1}
            variant={orderType === 'MARKET' ? 'solid' : 'outline'}
            colorPalette={orderType === 'MARKET' ? 'accent' : undefined}
            onClick={() => handleSelectOrderType('MARKET')}
            role="tab"
            aria-selected={orderType === 'MARKET'}
          >
            {t('chart.quickTrade.orderTypeMarket')}
          </Button>
          <Button
            size="2xs"
            fontSize="xs"
            h="22px"
            flex={1}
            variant={orderType === 'LIMIT' ? 'solid' : 'outline'}
            colorPalette={orderType === 'LIMIT' ? 'accent' : undefined}
            onClick={() => handleSelectOrderType('LIMIT')}
            role="tab"
            aria-selected={orderType === 'LIMIT'}
          >
            {t('chart.quickTrade.orderTypeLimit')}
          </Button>
        </HStack>

        {orderType === 'LIMIT' && (
          <HStack gap={1.5}>
            <Text fontSize="2xs" color="fg.muted" minW="60px">{t('chart.quickTrade.limitPrice')}</Text>
            <Input
              size="xs"
              aria-label={t('chart.quickTrade.limitPrice')}
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={midPrice > 0 ? midPrice.toString() : ''}
              type="number"
              flex={1}
            />
          </HStack>
        )}

        <HStack gap={1.5}>
          <BuySellButtons
            symbol={symbol}
            currentPrice={currentPrice}
            isCreatingOrder={isCreatingOrder}
            onPlaceOrder={handleQuickOrder}
            buyLabel={t('chart.quickTrade.buy')}
            sellLabel={t('chart.quickTrade.sell')}
          />
        </HStack>

        <VStack gap={1} align="stretch">
          <HStack gap={1.5}>
            <Switch
              checked={slEnabled}
              onCheckedChange={setSlEnabled}
              size="sm"
              aria-label={t('chart.quickTrade.stopLoss')}
              data-testid="trade-ticket-sl-switch"
            />
            <Text fontSize="2xs" color="fg.muted" minW="20px">{t('chart.quickTrade.stopLoss')}</Text>
            <Input
              size="xs"
              aria-label={t('chart.quickTrade.stopLoss')}
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              type="number"
              disabled={!slEnabled}
              flex={1}
              data-testid="trade-ticket-sl-input"
            />
          </HStack>
          <HStack gap={1.5}>
            <Switch
              checked={tpEnabled}
              onCheckedChange={setTpEnabled}
              size="sm"
              aria-label={t('chart.quickTrade.takeProfit')}
              data-testid="trade-ticket-tp-switch"
            />
            <Text fontSize="2xs" color="fg.muted" minW="20px">{t('chart.quickTrade.takeProfit')}</Text>
            <Input
              size="xs"
              aria-label={t('chart.quickTrade.takeProfit')}
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value)}
              type="number"
              disabled={!tpEnabled}
              flex={1}
              data-testid="trade-ticket-tp-input"
            />
          </HStack>
        </VStack>

        <Flex justify="space-between" align="center" px={0.5}>
          <Text fontSize="2xs" color="fg.muted">{t('chart.quickTrade.totalValue')}</Text>
          <Text fontSize="xs" fontWeight="semibold" color="fg" data-testid="trade-ticket-total-value">
            {(() => {
              const referencePrice = orderType === 'LIMIT'
                ? parseFloat(limitPrice)
                : (midPrice > 0 ? midPrice : currentPrice);
              if (!referencePrice || referencePrice <= 0 || !isReady) return '—';
              const previewQty = parseFloat(getQuantity(referencePrice));
              if (!previewQty || previewQty <= 0) return '—';
              return `${formatChartPrice(previewQty * referencePrice)} USDT`;
            })()}
          </Text>
        </Flex>

        <VStack gap={0.5} align="stretch">
          {marketType === 'FUTURES' && (
            <ActionRow icon={<PiBroom />} label={t('futures.cancelOrders')} onClick={handleCancelOrdersClick} loading={isCancellingAllOrders} />
          )}
          <GridOrderPopover triggerElement={
            <ActionRow icon={<LuGrid3X3 />} label={t('chart.quickTrade.gridOrders')} />
          } />
          <TrailingStopPopover symbol={symbol} triggerElement={
            <ActionRow icon={<LuShield />} label={t('chart.quickTrade.trailingStop')} />
          } />
        </VStack>
      </VStack>

      <ConfirmationDialog
        isOpen={showCancelOrdersConfirm}
        onClose={() => setShowCancelOrdersConfirm(false)}
        onConfirm={() => { void handleCancelOrdersConfirm(); }}
        title={t('futures.cancelOrdersConfirmTitle')}
        description={t('futures.cancelOrdersConfirmDescription', { symbol })}
        confirmLabel={t('futures.cancelOrders')}
        isDestructive
        isLoading={isCancellingAllOrders}
      />

      {pendingOrder && (() => {
        const isBuy = pendingOrder.side === 'BUY';
        const totalValue = parseFloat(pendingOrder.quantity) * pendingOrder.price;
        const margin = totalValue / leverage;
        const liqPrice = calculateLiquidationPrice(pendingOrder.price, leverage, isBuy ? 'LONG' : 'SHORT');
        const liqPct = Math.abs((liqPrice - pendingOrder.price) / pendingOrder.price * 100);

        return (
          <ConfirmationDialog
            isOpen
            onClose={() => setPendingOrder(null)}
            onConfirm={() => { void handleConfirmOrder(); }}
            title={t('chart.quickTrade.confirmOrder')}
            confirmLabel={isBuy ? t('chart.quickTrade.confirmBuy') : t('chart.quickTrade.confirmSell')}
            colorPalette={isBuy ? 'green' : 'red'}
            isLoading={isCreatingOrder}
            description={
              <VStack align="stretch" gap={2} fontSize="sm" w="100%">
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.symbol')}</Text>
                  <Text fontWeight="bold">{symbol}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.side')}</Text>
                  <Text fontWeight="bold" color={isBuy ? 'trading.long' : 'trading.short'}>{isBuy ? 'LONG' : 'SHORT'}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.orderType')}</Text>
                  <Text fontWeight="medium">{pendingOrder.orderType === 'LIMIT' ? t('chart.quickTrade.orderTypeLimit') : t('chart.quickTrade.orderTypeMarket')}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.price')}</Text>
                  <Text>{formatChartPrice(pendingOrder.price)}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.quantity')}</Text>
                  <Text>{pendingOrder.quantity}</Text>
                </Flex>
                {pendingOrder.stopLoss && (
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('chart.quickTrade.stopLoss')}</Text>
                    <Text color="trading.loss">{formatChartPrice(parseFloat(pendingOrder.stopLoss))}</Text>
                  </Flex>
                )}
                {pendingOrder.takeProfit && (
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('chart.quickTrade.takeProfit')}</Text>
                    <Text color="trading.profit">{formatChartPrice(parseFloat(pendingOrder.takeProfit))}</Text>
                  </Flex>
                )}
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('futures.leverage')}</Text>
                  <Text color="orange.fg" fontWeight="bold">{leverage}x</Text>
                </Flex>
                <Box h="1px" bg="border" />
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.totalValue')}</Text>
                  <Text fontWeight="bold">{formatChartPrice(totalValue)} USDT</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.margin')}</Text>
                  <Text>{formatChartPrice(margin)} USDT</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.liquidation')}</Text>
                  <Text color="trading.loss">{formatChartPrice(liqPrice)} ({liqPct.toFixed(1)}%)</Text>
                </Flex>
              </VStack>
            }
          />
        );
      })()}
    </>
  );
});

TradeTicketActions.displayName = 'TradeTicketActions';

interface TradeTicketProps {
  symbol: string;
  marketType?: MarketType;
  onClose?: () => void;
}

export const TradeTicket = memo(({ symbol, marketType = 'FUTURES', onClose }: TradeTicketProps) => {
  const [savedPosition, setSavedPosition] = useUIPref<{ x: number; y: number }>('quickTradeToolbarPosition', { x: EDGE_PADDING, y: EDGE_PADDING });

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const [position, setPosition] = useState(savedPosition);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!dragState.current.dragging) setPosition(savedPosition);
  }, [savedPosition]);

  const snapToEdges = useCallback((x: number, y: number, containerW: number, containerH: number, panelW: number, panelH: number) => {
    let snappedX = x;
    let snappedY = y;
    if (x < SNAP_THRESHOLD + EDGE_PADDING) snappedX = EDGE_PADDING;
    else if (x + panelW > containerW - SNAP_THRESHOLD - EDGE_PADDING) snappedX = containerW - panelW - EDGE_PADDING;
    if (y < SNAP_THRESHOLD + EDGE_PADDING) snappedY = EDGE_PADDING;
    else if (y + panelH > containerH - SNAP_THRESHOLD - EDGE_PADDING) snappedY = containerH - panelH - EDGE_PADDING;
    snappedX = Math.max(EDGE_PADDING, Math.min(snappedX, containerW - panelW - EDGE_PADDING));
    snappedY = Math.max(EDGE_PADDING, Math.min(snappedY, containerH - panelH - EDGE_PADDING));
    return { x: snappedX, y: snappedY };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds.dragging || !containerRef.current || !panelRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const rawX = ds.originX + (e.clientX - ds.startX);
      const rawY = ds.originY + (e.clientY - ds.startY);
      const snapped = snapToEdges(rawX, rawY, containerRect.width, containerRect.height, panelRect.width, panelRect.height);
      setPosition(snapped);
    };

    const handleMouseUp = () => {
      dragState.current.dragging = false;
      setIsDragging(false);
      setPosition((pos) => {
        setSavedPosition(pos);
        return pos;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, snapToEdges, setSavedPosition]);

  return (
    <Box ref={containerRef} position="absolute" top="56px" left={0} right={0} bottom={0} zIndex={10} pointerEvents="none">
      <Box
        ref={panelRef}
        position="absolute"
        top={`${position.y}px`}
        left={`${position.x}px`}
        zIndex={10}
        bg="bg.panel"
        borderRadius="md"
        border="1px solid"
        borderColor="border"
        boxShadow="sm"
        p={1.5}
        pointerEvents="auto"
        userSelect={isDragging ? 'none' : 'auto'}
      >
        <TradeTicketActions
          symbol={symbol}
          marketType={marketType}
          showDragHandle
          onDragStart={handleDragStart}
          isDragging={isDragging}
          onClose={onClose}
        />
      </Box>
    </Box>
  );
});

TradeTicket.displayName = 'TradeTicket';
