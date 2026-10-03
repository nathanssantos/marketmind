import type { MarketType, PositionSide, ProtectionMode } from '@marketmind/types';
import { calculateLiquidationPrice } from '@marketmind/types';
import { calculateBreakevenPrice } from '@marketmind/utils';
import { Badge, Button, ConfirmationDialog, IconButton, Input, Menu, Slider, Switch, TooltipWrapper } from '@renderer/components/ui';
import { Box, Flex, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBookTicker } from '@renderer/hooks/useBookTicker';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useLeverageBrackets } from '@renderer/hooks/useLeverageBrackets';
import { useOrderQuantity } from '@renderer/hooks/useOrderQuantity';
import { useSymbolOpenPosition } from '@renderer/hooks/useSymbolOpenPosition';
import { useTicketAssetProfile } from '@renderer/hooks/useTicketAssetProfile';
import { useToast } from '@renderer/hooks/useToast';
import { useTradingMarketType } from '@renderer/hooks/useTradingMarketType';
import { useWalletFees } from '@renderer/hooks/useWalletFees';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { usePricesForSymbols } from '@renderer/store/priceStore';
import { useTradingPref, useUIPref } from '@renderer/store/preferencesStore';
import { trpc } from '@renderer/utils/trpc';
import { formatChartPrice } from '@renderer/utils/formatters';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuEllipsisVertical, LuGrid3X3, LuGripVertical, LuMinus, LuPlus, LuShield } from 'react-icons/lu';
import { PiBroom } from 'react-icons/pi';
import { GridOrderPopover } from './GridOrderPopover';
import { LeveragePopover } from './LeveragePopover';
import { MarketSessionStrip } from './MarketSessionStrip';
import { TrailingStopPopover } from './TrailingStopPopover';

type OrderSide = 'BUY' | 'SELL';
type OrderTypeChoice = 'MARKET' | 'LIMIT';
type DisplayedOrderType = 'MARKET' | 'LIMIT' | 'STOP';
type PositionEffect = 'OPEN' | 'CLOSE' | 'REDUCE' | 'REVERSE';

const PROTECTION_OCO_PREF_KEY = 'ticketProtectionOco';
const SKIP_MARKET_CONFIRM_PREF_KEY = 'ticketSkipMarketConfirm';
const SIZE_PRESETS = [10, 25, 50, 75, 100] as const;
const SIZE_STEP_PERCENT = 5;
const MIN_SIZE_PERCENT = 0.1;
const MAX_SIZE_PERCENT = 100;
const SNAP_THRESHOLD = 16;
const EDGE_PADDING = 8;
const DEFAULT_SL_PERCENT = 2;
const DEFAULT_TP_PERCENT = 3;
const PERCENT_DECIMALS = 2;
const QUANTITY_EPSILON = 1e-9;
const QUANTITY_TEMPLATE_MIN_DECIMALS = 0;
const CLOSE_SNAP_RATIO = 0.01;
const QUOTE_ASSET_SUFFIX = /(USDT|USDC|FDUSD|BUSD|BTC|ETH|BNB|BRL|EUR|TRY)$/;

interface PendingOrder {
  side: OrderSide;
  price: number;
  quantity: string;
  orderType: OrderTypeChoice;
  displayedType: DisplayedOrderType;
  effect: PositionEffect;
  stopLoss?: string;
  takeProfit?: string;
  protectionMode?: ProtectionMode;
}

const toPositionSide = (side: OrderSide): PositionSide => (side === 'BUY' ? 'LONG' : 'SHORT');

const formatQuantityLike = (quantity: number, template: string): string => {
  const decimals = template.includes('.') ? template.split('.')[1]!.length : 0;
  return quantity.toFixed(Math.max(decimals, QUANTITY_TEMPLATE_MIN_DECIMALS));
};

const baseAssetOf = (symbol: string, isStocks: boolean): string => (isStocks ? symbol : symbol.replace(QUOTE_ASSET_SUFFIX, ''));

const percentFromEntry = (entry: number, target: number, side: OrderSide): number => {
  if (!(entry > 0) || !(target > 0)) return NaN;
  const raw = ((target - entry) / entry) * 100;
  return side === 'BUY' ? raw : -raw;
};

const priceFromPercent = (entry: number, percent: number, side: OrderSide): number =>
  side === 'BUY' ? entry * (1 + percent / 100) : entry * (1 - percent / 100);

const ActionRow = ({ icon, label, onClick, loading, disabled }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
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
    {icon}
    <Text fontSize="xs" color="fg.muted">{label}</Text>
    {loading && <Spinner size="xs" />}
  </Flex>
);

const SummaryRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <Flex justify="space-between" gap={2}>
    <Text fontSize="2xs" color="fg.muted">{label}</Text>
    <Text fontSize="2xs" fontWeight="medium" color={valueColor ?? 'fg'} textAlign="right">{value}</Text>
  </Flex>
);

interface ProtectionFieldProps {
  testId: string;
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  price: string;
  onPriceChange: (price: string) => void;
  percent: string;
  onPercentChange: (percent: string) => void;
  placeholder: string;
  invalid: boolean;
  dimmed: boolean;
  onPriceKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ProtectionField = ({ testId, label, enabled, onEnabledChange, price, onPriceChange, percent, onPercentChange, placeholder, invalid, dimmed, onPriceKeyDown }: ProtectionFieldProps) => (
  <HStack gap={1.5} opacity={dimmed ? 0.4 : 1}>
    <Switch checked={enabled} onCheckedChange={onEnabledChange} size="sm" aria-label={label} data-testid={`${testId}-switch`} disabled={dimmed} />
    <Text fontSize="2xs" color="fg.muted" minW="20px">{label}</Text>
    <Input
      size="xs"
      aria-label={label}
      value={price}
      onChange={(e) => onPriceChange(e.target.value)}
      onKeyDown={onPriceKeyDown}
      placeholder={placeholder}
      type="number"
      disabled={!enabled || dimmed}
      flex={1}
      borderColor={invalid ? 'trading.loss' : undefined}
      data-testid={`${testId}-input`}
    />
    <Input
      size="xs"
      aria-label={`${label} %`}
      value={percent}
      onChange={(e) => onPercentChange(e.target.value)}
      type="number"
      disabled={!enabled || dimmed}
      w="76px"
      flexShrink={0}
      textAlign="right"
      data-testid={`${testId}-percent`}
    />
  </HStack>
);

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
  const sizePercent = useQuickTradeStore((s) => s.sizePercent);
  const setSizePercent = useQuickTradeStore((s) => s.setSizePercent);
  const pendingPrefill = useQuickTradeStore((s) => s.pendingPrefill);
  const consumePrefill = useQuickTradeStore((s) => s.consumePrefill);
  const { cancelAllOrders, isCancellingAllOrders } = useBackendFuturesTrading(activeWallet?.id ?? '');

  const profile = useTicketAssetProfile(marketType);
  const fees = useWalletFees(activeWallet?.id, profile.marketType);
  const isPaperWallet = activeWallet?.walletType === 'paper';

  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderTypeChoice>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [slEnabled, setSlEnabled] = useState(false);
  const [slPrice, setSlPrice] = useState('');
  const [slPercent, setSlPercent] = useState('');
  const [tpEnabled, setTpEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [tpPercent, setTpPercent] = useState('');
  const [protectionOco, setProtectionOco] = useTradingPref<boolean>(PROTECTION_OCO_PREF_KEY, true);
  const [skipMarketConfirm] = useTradingPref<boolean>(SKIP_MARKET_CONFIRM_PREF_KEY, false);
  const [drawingSource, setDrawingSource] = useState<PositionSide | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [showCancelOrdersConfirm, setShowCancelOrdersConfirm] = useState(false);

  const { bidPrice, askPrice } = useBookTicker(symbol);
  const priceSymbols = useMemo(() => [symbol], [symbol]);
  const currentPrice = usePricesForSymbols(priceSymbols)[symbol] ?? 0;
  const midPrice = bidPrice > 0 && askPrice > 0 ? (bidPrice + askPrice) / 2 : currentPrice;
  const marketPriceForSide = side === 'BUY' ? (askPrice > 0 ? askPrice : currentPrice) : (bidPrice > 0 ? bidPrice : currentPrice);
  const limitPriceNum = parseFloat(limitPrice);
  const referencePrice = orderType === 'LIMIT' ? limitPriceNum : marketPriceForSide;
  const hasReferencePrice = Number.isFinite(referencePrice) && referencePrice > 0;

  const { getQuantity, leverage, isReady, notReadyReason, tickSize, stepSize, minNotional, balance } = useOrderQuantity(symbol, profile.marketType, { exchange: profile.exchange, takerFee: fees.taker });
  const leverageBrackets = useLeverageBrackets(symbol, profile.isFutures);
  const openPosition = useSymbolOpenPosition(symbol, profile.marketType);

  const { data: marketStatus } = trpc.stocks.marketStatus.useQuery(undefined, { enabled: profile.isStocks, refetchInterval: 60_000 });
  const { data: shortability } = trpc.stocks.shortability.useQuery({ symbol }, { enabled: profile.isStocks && side === 'SELL' && !openPosition });

  const intendedSide = toPositionSide(side);
  const reducesPosition = !!openPosition && openPosition.side !== intendedSide;
  const sizedQuantity = hasReferencePrice ? getQuantity(referencePrice) : '0';
  const sizedQuantityNum = parseFloat(sizedQuantity);
  const closeTolerance = Math.max(stepSize, (openPosition?.quantity ?? 0) * CLOSE_SNAP_RATIO) + QUANTITY_EPSILON;
  const spotSellBeyondHolding = reducesPosition && profile.sellOnlyWhatIsHeld && sizedQuantityNum > openPosition.quantity;
  const flattensPosition = reducesPosition && (spotSellBeyondHolding || Math.abs(sizedQuantityNum - openPosition.quantity) <= closeTolerance);
  const quantity = flattensPosition ? formatQuantityLike(openPosition.quantity, sizedQuantity) : sizedQuantity;
  const quantityNum = parseFloat(quantity);
  const effect: PositionEffect = !reducesPosition
    ? 'OPEN'
    : flattensPosition
      ? 'CLOSE'
      : quantityNum < openPosition.quantity
        ? 'REDUCE'
        : 'REVERSE';
  const limitCrossesMarket = orderType === 'LIMIT' && hasReferencePrice && marketPriceForSide > 0
    && (side === 'BUY' ? limitPriceNum > marketPriceForSide : limitPriceNum < marketPriceForSide);
  const displayedType: DisplayedOrderType = orderType === 'MARKET' ? 'MARKET' : limitCrossesMarket ? 'STOP' : 'LIMIT';

  const slPriceNum = parseFloat(slPrice);
  const tpPriceNum = parseFloat(tpPrice);
  const slInvalid = slEnabled && !reducesPosition && (!(slPriceNum > 0) || (side === 'BUY' ? slPriceNum >= referencePrice : slPriceNum <= referencePrice));
  const tpInvalid = tpEnabled && !reducesPosition && (!(tpPriceNum > 0) || (side === 'BUY' ? tpPriceNum <= referencePrice : tpPriceNum >= referencePrice));
  const protectionActive = (slEnabled || tpEnabled) && !reducesPosition;

  const sellBlockedBySpotHoldings = profile.sellOnlyWhatIsHeld && side === 'SELL' && !reducesPosition;
  const sellBlockedByShortability = profile.isStocks && side === 'SELL' && !reducesPosition && shortability?.known === true && !shortability.info.available;
  const marketClosedForMarketOrder = profile.isStocks && orderType === 'MARKET' && !!marketStatus && !marketStatus.isOpen;

  const baseAsset = baseAssetOf(symbol, profile.isStocks);
  const disabledReason = useMemo((): string | null => {
    if (!activeWallet?.id) return t('trading.ticket.noWallet');
    if (!isReady) return notReadyReason ?? t('chart.quickTrade.invalidQuantityError');
    if (!hasReferencePrice) return t('chart.quickTrade.noPriceError');
    if (!(quantityNum > 0) && stepSize > 0) return t('chart.quickTrade.reason.sizeBelowStep', { percent: Math.round(sizePercent * 10) / 10, step: stepSize, asset: baseAsset });
    if (!(quantityNum > 0)) return t('chart.quickTrade.invalidQuantityError');
    if (!reducesPosition && minNotional > 0 && quantityNum * referencePrice < minNotional) return t('chart.quickTrade.reason.belowMinNotional', { min: minNotional, currency: profile.quoteCurrency });
    if (sellBlockedBySpotHoldings) return t('trading.spot.nothingToSell');
    if (sellBlockedByShortability) return t('chart.quickTrade.reason.notShortable');
    if (marketClosedForMarketOrder) return t('chart.quickTrade.reason.marketClosed');
    if (slInvalid) return t('chart.quickTrade.slInvalid');
    if (tpInvalid) return t('chart.quickTrade.tpInvalid');
    return null;
  }, [activeWallet?.id, isReady, notReadyReason, hasReferencePrice, quantityNum, stepSize, sizePercent, baseAsset, reducesPosition, minNotional, referencePrice, profile.quoteCurrency, sellBlockedBySpotHoldings, sellBlockedByShortability, marketClosedForMarketOrder, slInvalid, tpInvalid, t]);

  const totalValue = hasReferencePrice ? quantityNum * referencePrice : 0;
  const marginRequired = profile.isFutures ? totalValue / leverage : totalValue;
  const liquidationPrice = profile.showsLiquidation && hasReferencePrice && leverage > 1
    ? calculateLiquidationPrice({ entryPrice: referencePrice, quantity: quantityNum, leverage, side: intendedSide, brackets: leverageBrackets })
    : 0;
  const estimatedEntryFee = totalValue * fees.taker;
  const riskPercent = slEnabled && !slInvalid && balance > 0 && hasReferencePrice
    ? ((Math.abs(referencePrice - slPriceNum) * quantityNum + (totalValue + slPriceNum * quantityNum) * fees.taker) / balance) * 100
    : NaN;
  const riskReward = slEnabled && tpEnabled && !slInvalid && !tpInvalid && Math.abs(referencePrice - slPriceNum) > 0
    ? Math.abs(tpPriceNum - referencePrice) / Math.abs(referencePrice - slPriceNum)
    : NaN;

  const { data: commission } = trpc.stocks.commissionEstimate.useQuery(
    { shares: Math.max(1, Math.floor(quantityNum)), price: referencePrice > 0 ? referencePrice : 1 },
    { enabled: profile.isStocks && quantityNum > 0 && hasReferencePrice },
  );
  const estimatedFeeLabel = profile.isStocks
    ? commission ? `${commission.commission.toFixed(2)} ${profile.quoteCurrency}` : '—'
    : `${formatChartPrice(estimatedEntryFee)} ${profile.quoteCurrency}`;

  const syncPercentsFromPrices = useCallback((entry: number, nextSide: OrderSide) => {
    const sl = parseFloat(slPrice);
    const tp = parseFloat(tpPrice);
    if (sl > 0) setSlPercent(percentFromEntry(entry, sl, nextSide).toFixed(PERCENT_DECIMALS));
    if (tp > 0) setTpPercent(percentFromEntry(entry, tp, nextSide).toFixed(PERCENT_DECIMALS));
  }, [slPrice, tpPrice]);

  const handleSideChange = useCallback((nextSide: OrderSide) => {
    if (nextSide === side) return;
    setSide(nextSide);
    setDrawingSource(null);
    if (hasReferencePrice) syncPercentsFromPrices(referencePrice, nextSide);
  }, [side, hasReferencePrice, referencePrice, syncPercentsFromPrices]);

  const handleSelectOrderType = useCallback((next: OrderTypeChoice) => {
    setOrderType((prev) => {
      if (prev === 'MARKET' && next === 'LIMIT' && midPrice > 0) setLimitPrice(midPrice.toString());
      return next;
    });
  }, [midPrice]);

  const handleSlPriceChange = useCallback((value: string) => {
    setSlPrice(value);
    const price = parseFloat(value);
    setSlPercent(price > 0 && hasReferencePrice ? percentFromEntry(referencePrice, price, side).toFixed(PERCENT_DECIMALS) : '');
  }, [hasReferencePrice, referencePrice, side]);

  const handleTpPriceChange = useCallback((value: string) => {
    setTpPrice(value);
    const price = parseFloat(value);
    setTpPercent(price > 0 && hasReferencePrice ? percentFromEntry(referencePrice, price, side).toFixed(PERCENT_DECIMALS) : '');
  }, [hasReferencePrice, referencePrice, side]);

  const handleSlPercentChange = useCallback((value: string) => {
    setSlPercent(value);
    const percent = parseFloat(value);
    if (Number.isFinite(percent) && hasReferencePrice) setSlPrice(formatChartPrice(priceFromPercent(referencePrice, percent, side)));
  }, [hasReferencePrice, referencePrice, side]);

  const handleTpPercentChange = useCallback((value: string) => {
    setTpPercent(value);
    const percent = parseFloat(value);
    if (Number.isFinite(percent) && hasReferencePrice) setTpPrice(formatChartPrice(priceFromPercent(referencePrice, percent, side)));
  }, [hasReferencePrice, referencePrice, side]);

  const stepPriceWithArrows = useCallback((onChange: (value: string) => void, current: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (!(tickSize > 0)) return;
    event.preventDefault();
    const base = parseFloat(current) || referencePrice;
    if (!(base > 0)) return;
    const next = event.key === 'ArrowUp' ? base + tickSize : base - tickSize;
    onChange(formatChartPrice(next));
  }, [tickSize, referencePrice]);

  useEffect(() => {
    if (!pendingPrefill) return;
    const payload = consumePrefill();
    if (!payload) return;
    const prefillSide: OrderSide = payload.side;
    const entry = parseFloat(payload.entryPrice);
    setSide(prefillSide);
    setOrderType('LIMIT');
    setLimitPrice(payload.entryPrice);
    setSlEnabled(true);
    setSlPrice(payload.stopLoss);
    setSlPercent(percentFromEntry(entry, parseFloat(payload.stopLoss), prefillSide).toFixed(PERCENT_DECIMALS));
    setTpEnabled(true);
    setTpPrice(payload.takeProfit);
    setTpPercent(percentFromEntry(entry, parseFloat(payload.takeProfit), prefillSide).toFixed(PERCENT_DECIMALS));
    setDrawingSource(toPositionSide(prefillSide));
  }, [pendingPrefill, consumePrefill]);

  const clearDrawingPrefill = useCallback(() => {
    setDrawingSource(null);
    setOrderType('MARKET');
    setLimitPrice('');
    setSlEnabled(false);
    setSlPrice('');
    setSlPercent('');
    setTpEnabled(false);
    setTpPrice('');
    setTpPercent('');
  }, []);

  const submitOrder = useCallback(async (order: PendingOrder) => {
    if (!activeWallet?.id) return;
    try {
      const result = await createOrder({
        walletId: activeWallet.id,
        symbol,
        side: order.side,
        type: order.orderType,
        quantity: order.quantity,
        referencePrice: order.price,
        marketType: profile.marketType,
        ...(order.orderType === 'LIMIT' ? { price: order.price.toString() } : {}),
        ...(order.stopLoss ? { stopLoss: order.stopLoss } : {}),
        ...(order.takeProfit ? { takeProfit: order.takeProfit } : {}),
        ...(order.protectionMode ? { protectionMode: order.protectionMode } : {}),
      });
      const protectionErrors = (result as { protectionErrors?: string[] }).protectionErrors ?? [];
      for (const protectionError of protectionErrors) toastError(t('trading.order.protectionFailed'), protectionError);
      setDrawingSource(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
    } finally {
      setPendingOrder(null);
    }
  }, [activeWallet?.id, symbol, profile.marketType, createOrder, toastError, t]);

  const handlePlaceOrder = useCallback(() => {
    if (!activeWallet?.id) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (disabledReason) {
      toastError(disabledReason);
      return;
    }
    const order: PendingOrder = {
      side,
      price: referencePrice,
      quantity,
      orderType,
      displayedType,
      effect,
      ...(protectionActive && slEnabled ? { stopLoss: slPriceNum.toString() } : {}),
      ...(protectionActive && tpEnabled ? { takeProfit: tpPriceNum.toString() } : {}),
      ...(protectionActive ? { protectionMode: protectionOco ? 'OCO' as const : 'INDEPENDENT' as const } : {}),
    };
    if (orderType === 'MARKET' && skipMarketConfirm) {
      void submitOrder(order);
      return;
    }
    setPendingOrder(order);
  }, [activeWallet?.id, disabledReason, side, referencePrice, quantity, orderType, displayedType, effect, protectionActive, slEnabled, slPriceNum, tpEnabled, tpPriceNum, protectionOco, skipMarketConfirm, submitOrder, warning, toastError, t]);

  const handleInputEnter = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handlePlaceOrder();
  }, [handlePlaceOrder]);

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

  const handleSliderChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined && v !== sizePercent) setSizePercent(v);
  }, [setSizePercent, sizePercent]);
  const handleDecrement = useCallback(() => {
    const next = Math.max(MIN_SIZE_PERCENT, Math.ceil(sizePercent / SIZE_STEP_PERCENT) * SIZE_STEP_PERCENT - SIZE_STEP_PERCENT);
    if (next !== sizePercent) setSizePercent(next);
  }, [sizePercent, setSizePercent]);
  const handleIncrement = useCallback(() => {
    const next = Math.min(MAX_SIZE_PERCENT, Math.floor(sizePercent / SIZE_STEP_PERCENT) * SIZE_STEP_PERCENT + SIZE_STEP_PERCENT);
    if (next !== sizePercent) setSizePercent(next);
  }, [sizePercent, setSizePercent]);

  const sideLabels = profile.isFutures
    ? { BUY: t('chart.quickTrade.sideBuyLong'), SELL: t('chart.quickTrade.sideSellShort') }
    : { BUY: t('trading.ticket.buy'), SELL: t('trading.ticket.sell') };
  const sideWord = profile.isFutures ? (side === 'BUY' ? 'Long' : 'Short') : sideLabels[side];
  const oppositeWord = profile.isFutures ? (side === 'BUY' ? 'Long' : 'Short') : sideLabels[side];
  const quantityLabel = `${quantityNum > 0 ? quantity : '—'} ${baseAsset}`;
  const actionLabelByEffect: Record<PositionEffect, string> = {
    OPEN: t('chart.quickTrade.action.open', { side: sideWord, quantity: quantityLabel, price: hasReferencePrice ? formatChartPrice(referencePrice) : '—' }),
    CLOSE: t('chart.quickTrade.action.close', { quantity: quantityLabel }),
    REDUCE: t('chart.quickTrade.action.reduce', { quantity: quantityLabel }),
    REVERSE: t('chart.quickTrade.action.reverse', { side: oppositeWord, quantity: `${openPosition ? formatChartPrice(Math.abs(quantityNum - openPosition.quantity)) : '—'} ${baseAsset}` }),
  };
  const orderTypeLabels: Record<DisplayedOrderType, string> = {
    MARKET: t('chart.quickTrade.orderTypeMarket'),
    LIMIT: t('chart.quickTrade.orderTypeLimit'),
    STOP: t('chart.quickTrade.orderTypeStop'),
  };
  const slPlaceholder = hasReferencePrice ? formatChartPrice(priceFromPercent(referencePrice, -DEFAULT_SL_PERCENT, side)) : '';
  const tpPlaceholder = hasReferencePrice ? formatChartPrice(priceFromPercent(referencePrice, DEFAULT_TP_PERCENT, side)) : '';
  const sideColor = side === 'BUY' ? 'green' : 'red';

  return (
    <>
      <VStack gap={1.5} align="stretch" data-testid="trade-ticket">
        <HStack gap={1} alignItems="center">
          {showDragHandle && (
            <Box onMouseDown={onDragStart} cursor={isDragging ? 'grabbing' : 'grab'} display="flex" alignItems="center" px={0.5} color="fg.muted" _hover={{ color: 'fg' }} flexShrink={0}>
              <LuGripVertical size={12} />
            </Box>
          )}
          <HStack gap={1} flex={1}>
            {SIZE_PRESETS.map((pct) => (
              <Button key={pct} size="2xs" fontSize="xs" px={1} minW={0} h="20px" variant="outline" color={sizePercent === pct ? 'accent.solid' : 'fg.muted'} onClick={() => setSizePercent(pct)}>
                {pct}%
              </Button>
            ))}
            {profile.showsLeverage && (
              <Box ml="auto">
                <LeveragePopover symbol={symbol} />
              </Box>
            )}
          </HStack>
          {onClose && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton size="2xs" variant="outline" color="fg.muted" aria-label={t('common.options')} flexShrink={0} h="20px" minW="20px">
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px">
                  <Menu.Item value="close" onClick={onClose}>{t('common.close')}</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          )}
        </HStack>

        <HStack gap={1.5} px={0.5}>
          <Slider value={[sizePercent]} onValueChange={handleSliderChange} min={MIN_SIZE_PERCENT} max={MAX_SIZE_PERCENT} step={MIN_SIZE_PERCENT} />
          <IconButton size="2xs" variant="outline" aria-label={t('chart.quickTrade.decreaseSize')} onClick={handleDecrement} disabled={sizePercent <= MIN_SIZE_PERCENT} h="20px" minW="20px">
            <LuMinus />
          </IconButton>
          <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="center" lineHeight="1" whiteSpace="nowrap">
            {`${Math.round(sizePercent * 10) / 10}%`}
          </Text>
          <IconButton size="2xs" variant="outline" aria-label={t('chart.quickTrade.increaseSize')} onClick={handleIncrement} disabled={sizePercent >= MAX_SIZE_PERCENT} h="20px" minW="20px">
            <LuPlus />
          </IconButton>
        </HStack>

        {profile.isStocks && marketStatus && <MarketSessionStrip status={marketStatus} />}

        <HStack gap={1.5} role="radiogroup" aria-label={t('common.side')}>
          <Button
            size="2xs" fontSize="xs" h="24px" flex={1}
            role="radio" aria-checked={side === 'BUY'}
            variant={side === 'BUY' ? 'solid' : 'outline'}
            colorPalette={side === 'BUY' ? 'green' : undefined}
            onClick={() => handleSideChange('BUY')}
            data-testid="trade-ticket-side-buy"
          >
            {sideLabels.BUY}
          </Button>
          <Button
            size="2xs" fontSize="xs" h="24px" flex={1}
            role="radio" aria-checked={side === 'SELL'}
            variant={side === 'SELL' ? 'solid' : 'outline'}
            colorPalette={side === 'SELL' ? 'red' : undefined}
            onClick={() => handleSideChange('SELL')}
            data-testid="trade-ticket-side-sell"
          >
            {sideLabels.SELL}
          </Button>
          <TooltipWrapper label={slEnabled && tpEnabled ? (protectionOco ? t('chart.quickTrade.ocoOn') : t('chart.quickTrade.ocoOff')) : t('chart.quickTrade.ocoNeedsBoth')} showArrow>
            <HStack gap={1} flexShrink={0}>
              <Switch checked={protectionOco} onCheckedChange={setProtectionOco} size="sm" disabled={!(slEnabled && tpEnabled)} aria-label={t('chart.quickTrade.oco')} data-testid="trade-ticket-oco-switch" />
              <Text fontSize="2xs" color="fg.muted">{t('chart.quickTrade.oco')}</Text>
            </HStack>
          </TooltipWrapper>
        </HStack>

        <HStack gap={1} role="tablist" aria-label={t('chart.quickTrade.orderType')}>
          <Button size="2xs" fontSize="xs" h="22px" flex={orderType === 'LIMIT' ? '0 0 auto' : 1} px={orderType === 'LIMIT' ? 3 : undefined} variant={orderType === 'MARKET' ? 'solid' : 'outline'} colorPalette={orderType === 'MARKET' ? 'accent' : undefined} onClick={() => handleSelectOrderType('MARKET')} role="tab" aria-selected={orderType === 'MARKET'}>
            {orderTypeLabels.MARKET}
          </Button>
          <Button size="2xs" fontSize="xs" h="22px" flex={orderType === 'LIMIT' ? '0 0 auto' : 1} px={orderType === 'LIMIT' ? 3 : undefined} variant={orderType === 'LIMIT' ? 'solid' : 'outline'} colorPalette={orderType === 'LIMIT' ? 'accent' : undefined} onClick={() => handleSelectOrderType('LIMIT')} role="tab" aria-selected={orderType === 'LIMIT'}>
            {orderType === 'LIMIT' && limitCrossesMarket ? orderTypeLabels.STOP : orderTypeLabels.LIMIT}
          </Button>
          {orderType === 'LIMIT' && (
            <>
              <Input
                size="xs" h="22px" flex={1} type="number"
                aria-label={t('chart.quickTrade.limitPrice')}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                onKeyDown={(e) => { stepPriceWithArrows(setLimitPrice, limitPrice)(e); handleInputEnter(e); }}
                placeholder={midPrice > 0 ? midPrice.toString() : ''}
              />
              <Button size="2xs" fontSize="xs" h="22px" variant="outline" color="fg.muted" onClick={() => midPrice > 0 && setLimitPrice(midPrice.toString())} disabled={!(midPrice > 0)}>
                {t('chart.quickTrade.mid')}
              </Button>
            </>
          )}
        </HStack>

        <VStack gap={1} align="stretch">
          <ProtectionField
            testId="trade-ticket-sl"
            label={t('chart.quickTrade.stopLoss')}
            enabled={slEnabled}
            onEnabledChange={setSlEnabled}
            price={slPrice}
            onPriceChange={handleSlPriceChange}
            percent={slPercent}
            onPercentChange={handleSlPercentChange}
            placeholder={slPlaceholder}
            invalid={slInvalid}
            dimmed={reducesPosition}
            onPriceKeyDown={(e) => { stepPriceWithArrows(handleSlPriceChange, slPrice)(e); handleInputEnter(e); }}
          />
          <ProtectionField
            testId="trade-ticket-tp"
            label={t('chart.quickTrade.takeProfit')}
            enabled={tpEnabled}
            onEnabledChange={setTpEnabled}
            price={tpPrice}
            onPriceChange={handleTpPriceChange}
            percent={tpPercent}
            onPercentChange={handleTpPercentChange}
            placeholder={tpPlaceholder}
            invalid={tpInvalid}
            dimmed={reducesPosition}
            onPriceKeyDown={(e) => { stepPriceWithArrows(handleTpPriceChange, tpPrice)(e); handleInputEnter(e); }}
          />
          {reducesPosition && (
            <Text fontSize="2xs" color="fg.muted" px={0.5}>{t('chart.quickTrade.reduceNote')}</Text>
          )}
        </VStack>

        <VStack gap={0.5} align="stretch" px={0.5}>
          <SummaryRow label={t('chart.quickTrade.totalValue')} value={hasReferencePrice && quantityNum > 0 ? `${formatChartPrice(totalValue)} ${profile.quoteCurrency}` : '—'} />
          {profile.showsMargin && (
            <SummaryRow label={t('chart.quickTrade.margin')} value={hasReferencePrice && quantityNum > 0 ? `${formatChartPrice(marginRequired)} ${profile.quoteCurrency}` : '—'} />
          )}
          {profile.showsLiquidation && (
            <SummaryRow label={t('chart.quickTrade.liquidation')} value={liquidationPrice > 0 ? formatChartPrice(liquidationPrice) : '—'} valueColor="trading.loss" />
          )}
          {slEnabled && !reducesPosition && (
            <SummaryRow label={t('chart.quickTrade.risk')} value={Number.isFinite(riskPercent) ? `${riskPercent.toFixed(PERCENT_DECIMALS)}% ${t('chart.quickTrade.ofBalance')}` : '—'} valueColor="trading.loss" />
          )}
          {slEnabled && tpEnabled && !reducesPosition && (
            <SummaryRow label={t('chart.quickTrade.riskReward')} value={Number.isFinite(riskReward) ? `1 : ${riskReward.toFixed(PERCENT_DECIMALS)}` : '—'} />
          )}
        </VStack>

        {drawingSource && (
          <Flex align="center" justify="space-between" px={1} py={0.5} bg="bg.muted" borderRadius="sm" gap={2}>
            <Text fontSize="2xs" color="fg.muted">
              {t('chart.quickTrade.fromDrawing', { tool: drawingSource === 'LONG' ? t('chart.tools.longPosition') : t('chart.tools.shortPosition') })}
            </Text>
            <Button size="2xs" fontSize="2xs" h="16px" variant="ghost" color="fg.muted" onClick={clearDrawingPrefill}>{t('common.clear')}</Button>
          </Flex>
        )}

        <VStack gap={0.5} align="stretch">
          <Button
            size="sm" h="36px" colorPalette={sideColor} variant="solid"
            onClick={handlePlaceOrder}
            loading={isCreatingOrder}
            disabled={!!disabledReason}
            position="relative"
            data-testid="trade-ticket-submit"
          >
            <Text fontSize="xs" fontWeight="bold">{actionLabelByEffect[effect]}</Text>
            {activeWallet && (
              <Badge position="absolute" top="2px" right="4px" size="xs" variant="subtle" colorPalette={isPaperWallet ? 'blue' : 'orange'}>
                {isPaperWallet ? t('chart.quickTrade.paper') : t('chart.quickTrade.live')}
              </Badge>
            )}
          </Button>
          {disabledReason && (
            <Text fontSize="2xs" color="fg.muted" textAlign="center" data-testid="trade-ticket-disabled-reason">{disabledReason}</Text>
          )}
        </VStack>

        <VStack gap={0.5} align="stretch">
          {profile.isFutures && (
            <ActionRow icon={<PiBroom />} label={t('futures.cancelOrders')} onClick={() => setShowCancelOrdersConfirm(true)} loading={isCancellingAllOrders} />
          )}
          <GridOrderPopover triggerElement={<ActionRow icon={<LuGrid3X3 />} label={t('chart.quickTrade.gridOrders')} />} />
          <TrailingStopPopover symbol={symbol} triggerElement={<ActionRow icon={<LuShield />} label={t('chart.quickTrade.trailingStop')} />} />
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
        const confirmTotal = parseFloat(pendingOrder.quantity) * pendingOrder.price;
        const confirmMargin = confirmTotal / leverage;
        const confirmLiq = profile.showsLiquidation && leverage > 1
          ? calculateLiquidationPrice({ entryPrice: pendingOrder.price, quantity: parseFloat(pendingOrder.quantity), leverage, side: toPositionSide(pendingOrder.side), brackets: leverageBrackets })
          : 0;
        const confirmBreakeven = calculateBreakevenPrice({ entryPrice: pendingOrder.price, side: toPositionSide(pendingOrder.side), takerRate: fees.taker });
        const futuresSideLabel = isBuy ? 'LONG' : 'SHORT';
        const confirmSideLabel = profile.isFutures ? futuresSideLabel : sideLabels[pendingOrder.side];

        return (
          <ConfirmationDialog
            isOpen
            onClose={() => setPendingOrder(null)}
            onConfirm={() => { void submitOrder(pendingOrder); }}
            title={t('chart.quickTrade.confirmOrder')}
            confirmLabel={isBuy ? t('chart.quickTrade.confirmBuy') : t('chart.quickTrade.confirmSell')}
            colorPalette={isBuy ? 'green' : 'red'}
            isLoading={isCreatingOrder}
            description={
              <VStack align="stretch" gap={2} fontSize="sm" w="100%">
                <Flex justify="space-between"><Text color="fg.muted">{t('common.symbol')}</Text><Text fontWeight="bold">{symbol}</Text></Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.side')}</Text>
                  <Text fontWeight="bold" color={isBuy ? 'trading.long' : 'trading.short'}>{confirmSideLabel}</Text>
                </Flex>
                <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.orderType')}</Text><Text fontWeight="medium">{orderTypeLabels[pendingOrder.displayedType]}</Text></Flex>
                <Flex justify="space-between"><Text color="fg.muted">{t('common.price')}</Text><Text>{formatChartPrice(pendingOrder.price)}</Text></Flex>
                <Flex justify="space-between"><Text color="fg.muted">{t('common.quantity')}</Text><Text>{pendingOrder.quantity}</Text></Flex>
                {pendingOrder.effect !== 'OPEN' && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.effect')}</Text><Text fontWeight="medium">{t(`chart.quickTrade.effectLabel.${pendingOrder.effect}`)}</Text></Flex>
                )}
                {pendingOrder.stopLoss && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.stopLoss')}</Text><Text color="trading.loss">{formatChartPrice(parseFloat(pendingOrder.stopLoss))}</Text></Flex>
                )}
                {pendingOrder.takeProfit && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.takeProfit')}</Text><Text color="trading.profit">{formatChartPrice(parseFloat(pendingOrder.takeProfit))}</Text></Flex>
                )}
                {pendingOrder.stopLoss && pendingOrder.takeProfit && (
                  <Flex justify="space-between">
                    <Text color="fg.muted">{t('chart.quickTrade.protection')}</Text>
                    <Text fontWeight="medium">{pendingOrder.protectionMode === 'INDEPENDENT' ? t('chart.quickTrade.protectionIndependent') : t('chart.quickTrade.protectionOco')}</Text>
                  </Flex>
                )}
                {pendingOrder.effect !== 'OPEN' && (
                  <Text fontSize="xs" color="fg.muted">{t('chart.quickTrade.reduceNote')}</Text>
                )}
                {profile.showsLeverage && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('futures.leverage')}</Text><Text color="orange.fg" fontWeight="bold">{leverage}x</Text></Flex>
                )}
                <Box h="1px" bg="border" />
                <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.totalValue')}</Text><Text fontWeight="bold">{formatChartPrice(confirmTotal)} {profile.quoteCurrency}</Text></Flex>
                {profile.showsMargin && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.margin')}</Text><Text>{formatChartPrice(confirmMargin)} {profile.quoteCurrency}</Text></Flex>
                )}
                {profile.showsLiquidation && confirmLiq > 0 && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.liquidation')}</Text><Text color="trading.loss">{formatChartPrice(confirmLiq)}</Text></Flex>
                )}
                <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.estimatedFee')}</Text><Text>{estimatedFeeLabel}</Text></Flex>
                {pendingOrder.effect === 'OPEN' && (
                  <Flex justify="space-between"><Text color="fg.muted">{t('chart.quickTrade.breakeven')}</Text><Text>{formatChartPrice(confirmBreakeven)}</Text></Flex>
                )}
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

export const TradeTicket = memo(({ symbol, marketType: chartMarketType, onClose }: TradeTicketProps) => {
  const marketType = useTradingMarketType(chartMarketType);
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
      setPosition(snapToEdges(rawX, rawY, containerRect.width, containerRect.height, panelRect.width, panelRect.height));
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
