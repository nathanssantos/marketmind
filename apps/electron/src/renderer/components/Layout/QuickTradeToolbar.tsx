import { Button, ConfirmationDialog, IconButton, Menu, Slider, TooltipWrapper } from '@renderer/components/ui';
import { Box, Flex, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBookTicker } from '@renderer/hooks/useBookTicker';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useToast } from '@renderer/hooks/useToast';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { useUIPref } from '@renderer/store/preferencesStore';
import { trpc } from '@renderer/utils/trpc';
import { formatChartPrice } from '@renderer/utils/formatters';
import { roundTradingQty } from '@shared/utils';
import { calculateLiquidationPrice } from '@marketmind/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuChevronDown, LuChevronUp, LuEllipsisVertical, LuGrid3X3, LuGripVertical, LuShield, LuX } from 'react-icons/lu';
import { PiBroom } from 'react-icons/pi';
import { GridOrderPopover } from './GridOrderPopover';
import { LeveragePopover } from './LeveragePopover';
import { TrailingStopPopover } from './TrailingStopPopover';

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

const SIZE_PRESETS = [0.5, 1, 5, 10, 50, 100] as const;
const SNAP_THRESHOLD = 16;
const EDGE_PADDING = 8;

export type QuickTradeMode = 'sidebar' | 'chart';

interface QuickTradeActionsProps {
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
  showDragHandle?: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  onMenuAction?: (mode: QuickTradeMode) => void;
  currentMode?: QuickTradeMode;
  onClose?: () => void;
}

export const QuickTradeActions = memo(({ symbol, marketType = 'FUTURES', showDragHandle, onDragStart, isDragging, onMenuAction, currentMode, onClose }: QuickTradeActionsProps) => {
  const { t } = useTranslation();
  const { warning, error: toastError } = useToast();
  const { activeWallet } = useActiveWallet();
  const { createOrder, isCreatingOrder } = useBackendTradingMutations();
  const { sizePercent, setSizePercent } = useQuickTradeStore();

  const {
    positions,
    reversePosition,
    isReversingPosition,
    closePositionAndCancelOrders,
    isClosingPositionAndCancellingOrders,
    cancelAllOrders,
    isCancellingAllOrders,
  } = useBackendFuturesTrading(activeWallet?.id || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCancelOrdersConfirm, setShowCancelOrdersConfirm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ side: 'BUY' | 'SELL'; price: number; quantity: string } | null>(null);

  const currentPosition = useMemo(() => {
    if (marketType !== 'FUTURES' || !Array.isArray(positions)) return null;
    const found = positions.find((p) => {
      if (p === null || typeof p !== 'object' || !('symbol' in p)) return false;
      if ((p as { symbol: string }).symbol !== symbol) return false;
      if ('status' in p && 'id' in p) return (p as { status: string }).status === 'open';
      if ('positionAmt' in p) return parseFloat(String((p as { positionAmt: string }).positionAmt)) !== 0;
      return false;
    });
    if (!found) return null;
    return found as { id?: string; side?: string; positionAmt?: string };
  }, [positions, symbol, marketType]);

  const positionSide = useMemo(() => {
    if (!currentPosition) return '';
    if ('side' in currentPosition && currentPosition.side) return String(currentPosition.side).toUpperCase();
    if ('positionAmt' in currentPosition) return parseFloat(String(currentPosition.positionAmt)) > 0 ? 'LONG' : 'SHORT';
    return '';
  }, [currentPosition]);

  const positionQty = useMemo(() => {
    if (!currentPosition) return '0';
    if ('positionAmt' in currentPosition) return Math.abs(parseFloat(String(currentPosition.positionAmt))).toFixed(4);
    return '0';
  }, [currentPosition]);

  const handleReverseClick = useCallback(() => {
    if (!currentPosition) return;
    setShowReverseConfirm(true);
  }, [currentPosition]);

  const handleReverseConfirm = useCallback(async () => {
    if (!activeWallet?.id || !currentPosition) return;
    try {
      const result = await reversePosition({
        walletId: activeWallet.id,
        symbol,
        positionId: 'id' in currentPosition ? String(currentPosition.id) : undefined,
      });
      if (result && 'success' in result && !result.success) {
        const errorMsg = 'error' in result && typeof result.error === 'string' ? result.error : undefined;
        toastError(t('futures.reverseFailed', 'Failed to reverse position'), errorMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.reverseFailed', 'Failed to reverse position'), msg);
    } finally {
      setShowReverseConfirm(false);
    }
  }, [activeWallet?.id, currentPosition, symbol, reversePosition, toastError, t]);

  const handleClosePositionClick = useCallback(() => {
    if (!currentPosition) return;
    setShowCloseConfirm(true);
  }, [currentPosition]);

  const handleClosePositionConfirm = useCallback(async () => {
    if (!activeWallet?.id || !currentPosition) return;
    try {
      await closePositionAndCancelOrders({
        walletId: activeWallet.id,
        symbol,
        positionId: 'id' in currentPosition ? String(currentPosition.id) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.closePositionFailed', 'Failed to close position'), msg);
    } finally {
      setShowCloseConfirm(false);
    }
  }, [activeWallet?.id, currentPosition, symbol, closePositionAndCancelOrders, toastError, t]);

  const handleCancelOrdersClick = useCallback(() => {
    setShowCancelOrdersConfirm(true);
  }, []);

  const handleCancelOrdersConfirm = useCallback(async () => {
    if (!activeWallet?.id) return;
    try {
      await cancelAllOrders({ walletId: activeWallet.id, symbol });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.cancelOrdersFailed', 'Failed to cancel orders'), msg);
    } finally {
      setShowCancelOrdersConfirm(false);
    }
  }, [activeWallet?.id, symbol, cancelAllOrders, toastError, t]);

  const balance = parseFloat(activeWallet?.currentBalance ?? '0');
  const currentPrice = usePriceStore((s) => s.prices[symbol]?.price ?? 0);
  const { bidPrice, askPrice } = useBookTicker(symbol);
  const buyPrice = askPrice > 0 ? askPrice : currentPrice;
  const sellPrice = bidPrice > 0 ? bidPrice : currentPrice;

  const { data: symbolLeverage } = trpc.futuresTrading.getSymbolLeverage.useQuery(
    { walletId: activeWallet?.id!, symbol },
    { enabled: !!activeWallet?.id && !!symbol && marketType === 'FUTURES' },
  );
  const leverage = symbolLeverage?.leverage ?? 1;

  const getQuantity = useCallback((price: number): string => {
    const pct = sizePercent / 100;
    const marginPower = balance * leverage;
    const qty = marginPower > 0 && price > 0 ? (marginPower * pct) / price : 0;
    return roundTradingQty(qty);
  }, [balance, sizePercent, leverage]);

  const handleQuickOrder = useCallback((side: 'BUY' | 'SELL') => {
    if (!activeWallet?.id) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;
    const price = side === 'BUY' ? buyPrice : sellPrice;
    if (!price || price <= 0) {
      toastError(t('chart.quickTrade.noPriceError'));
      return;
    }
    const quantity = getQuantity(price);
    if (!quantity || parseFloat(quantity) <= 0) {
      toastError(t('chart.quickTrade.invalidQuantityError'));
      return;
    }
    setPendingOrder({ side, price, quantity });
  }, [activeWallet?.id, symbol, buyPrice, sellPrice, getQuantity, warning, toastError, t]);

  const handleConfirmOrder = useCallback(async () => {
    if (!activeWallet?.id || !pendingOrder) return;
    try {
      await createOrder({ walletId: activeWallet.id, symbol, side: pendingOrder.side, type: 'MARKET', quantity: pendingOrder.quantity });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
    } finally {
      setPendingOrder(null);
    }
  }, [activeWallet?.id, symbol, pendingOrder, createOrder, toastError, t]);

  const handleBuy = useCallback(() => handleQuickOrder('BUY'), [handleQuickOrder]);
  const handleSell = useCallback(() => handleQuickOrder('SELL'), [handleQuickOrder]);
  const handleSliderChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined && v !== sizePercent) setSizePercent(v);
  }, [setSizePercent, sizePercent]);

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
              <Button key={pct} size="2xs" fontSize="xs" px={1} minW={0} h="20px" variant="outline" color={sizePercent === pct ? 'blue.500' : 'fg.muted'} onClick={() => setSizePercent(pct)}>
                {pct}%
              </Button>
            ))}
          </HStack>
          {(onMenuAction || onClose) && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton size="2xs" variant="ghost" color="fg.muted" aria-label="Options" flexShrink={0}>
                  <LuEllipsisVertical />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px">
                  {onMenuAction && currentMode && (
                    <Menu.Item value="toggle-mode" onClick={() => onMenuAction(currentMode === 'sidebar' ? 'chart' : 'sidebar')}>
                      {currentMode === 'sidebar'
                        ? t('chart.quickTrade.moveToChart')
                        : t('chart.quickTrade.moveToSidebar')}
                    </Menu.Item>
                  )}
                  {onClose && (
                    <Menu.Item value="close" onClick={onClose}>
                      {t('common.close', 'Close')}
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          )}
        </HStack>

        <HStack gap={1.5} px={0.5}>
          <Slider value={[sizePercent]} onValueChange={handleSliderChange} min={0.1} max={100} step={0.1} />
          <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="right" lineHeight="1" whiteSpace="nowrap">
            {`${Math.round(sizePercent * 10) / 10}%`}
          </Text>
          {marketType === 'FUTURES' && <LeveragePopover symbol={symbol} />}
        </HStack>

        <HStack gap={1.5}>
          <Button size="2xs" fontSize="2xs" h="34px" colorPalette="green" variant="solid" onClick={handleBuy} loading={isCreatingOrder} flex={1}>
            <VStack gap={0} lineHeight="1">
              <Text fontSize="2xs">{t('chart.quickTrade.buy')}</Text>
              <Text fontSize="2xs" fontWeight="bold">{buyPrice > 0 ? formatChartPrice(buyPrice) : '—'}</Text>
            </VStack>
          </Button>
          <Button size="2xs" fontSize="2xs" h="34px" colorPalette="red" variant="solid" onClick={handleSell} loading={isCreatingOrder} flex={1}>
            <VStack gap={0} lineHeight="1">
              <Text fontSize="2xs">{t('chart.quickTrade.sell')}</Text>
              <Text fontSize="2xs" fontWeight="bold">{sellPrice > 0 ? formatChartPrice(sellPrice) : '—'}</Text>
            </VStack>
          </Button>
          <TooltipWrapper label={showAdvanced ? t('common.hideActions', 'Hide actions') : t('common.moreActions', 'More actions')} showArrow>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Toggle advanced"
              onClick={() => setShowAdvanced((prev) => !prev)}
              h="34px"
            >
              {showAdvanced ? <LuChevronUp /> : <LuChevronDown />}
            </IconButton>
          </TooltipWrapper>
        </HStack>

        {showAdvanced && (
          <VStack gap={0.5} align="stretch" pt={0.5} borderTop="1px solid" borderColor="border">
            {marketType === 'FUTURES' && (
              <>
                <ActionRow icon={<LuArrowUpDown />} label={t('futures.reversePosition', 'Reverse Position')} onClick={handleReverseClick} loading={isReversingPosition} disabled={!currentPosition} />
                <ActionRow icon={<LuX />} label={t('futures.closePosition', 'Close Position')} onClick={handleClosePositionClick} loading={isClosingPositionAndCancellingOrders} disabled={!currentPosition} />
                <ActionRow icon={<PiBroom />} label={t('futures.cancelOrders', 'Cancel Orders')} onClick={handleCancelOrdersClick} loading={isCancellingAllOrders} />
              </>
            )}
            <GridOrderPopover triggerElement={
              <ActionRow icon={<LuGrid3X3 />} label={t('chart.quickTrade.gridOrders', 'Grid Orders')} />
            } />
            <TrailingStopPopover symbol={symbol} triggerElement={
              <ActionRow icon={<LuShield />} label={t('chart.quickTrade.trailingStop', 'Trailing Stop')} />
            } />
          </VStack>
        )}
      </VStack>

      <ConfirmationDialog
        isOpen={showReverseConfirm}
        onClose={() => setShowReverseConfirm(false)}
        onConfirm={handleReverseConfirm}
        title={t('futures.reverseConfirmTitle', 'Reverse Position?')}
        description={t('futures.reverseConfirmDescription', 'Close {{side}} {{quantity}} {{symbol}} and open {{newSide}} {{quantity}} {{symbol}} at market price?', {
          side: positionSide,
          quantity: positionQty,
          symbol,
          newSide: positionSide === 'LONG' ? 'SHORT' : 'LONG',
        })}
        confirmLabel={t('futures.reversePosition', 'Reverse Position')}
        colorPalette="blue"
        isLoading={isReversingPosition}
      />

      <ConfirmationDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleClosePositionConfirm}
        title={t('futures.closePositionConfirmTitle', 'Close Position?')}
        description={t('futures.closePositionConfirmDescription', 'Close {{side}} {{quantity}} {{symbol}} at market price and cancel all orders (SL, TP, entries)?', {
          side: positionSide,
          quantity: positionQty,
          symbol,
        })}
        confirmLabel={t('futures.closePosition', 'Close Position')}
        colorPalette="red"
        isLoading={isClosingPositionAndCancellingOrders}
      />

      <ConfirmationDialog
        isOpen={showCancelOrdersConfirm}
        onClose={() => setShowCancelOrdersConfirm(false)}
        onConfirm={handleCancelOrdersConfirm}
        title={t('futures.cancelOrdersConfirmTitle', 'Cancel All Orders?')}
        description={t('futures.cancelOrdersConfirmDescription', 'Cancel all pending entry orders for {{symbol}}? SL and TP orders will not be affected.', { symbol })}
        confirmLabel={t('futures.cancelOrders', 'Cancel Orders')}
        colorPalette="orange"
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
            onConfirm={handleConfirmOrder}
            title={t('chart.quickTrade.confirmOrder', 'Confirm Order')}
            confirmLabel={isBuy ? t('chart.quickTrade.confirmBuy', 'Confirm Buy') : t('chart.quickTrade.confirmSell', 'Confirm Sell')}
            colorPalette={isBuy ? 'green' : 'red'}
            isLoading={isCreatingOrder}
            description={
              <VStack align="stretch" gap={2} fontSize="sm" w="100%">
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.symbol', 'Symbol')}</Text>
                  <Text fontWeight="bold">{symbol}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.side', 'Side')}</Text>
                  <Text fontWeight="bold" color={isBuy ? 'green.500' : 'red.500'}>{isBuy ? 'LONG' : 'SHORT'}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.price', 'Price')}</Text>
                  <Text>{formatChartPrice(pendingOrder.price)}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('common.quantity', 'Quantity')}</Text>
                  <Text>{pendingOrder.quantity}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('futures.leverage', 'Leverage')}</Text>
                  <Text color="orange.500" fontWeight="bold">{leverage}x</Text>
                </Flex>
                <Box h="1px" bg="border" />
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.totalValue', 'Total Value')}</Text>
                  <Text fontWeight="bold">{formatChartPrice(totalValue)} USDT</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.margin', 'Margin Required')}</Text>
                  <Text>{formatChartPrice(margin)} USDT</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="fg.muted">{t('chart.quickTrade.liquidation', 'Liq. Price')}</Text>
                  <Text color="red.400">{formatChartPrice(liqPrice)} ({liqPct.toFixed(1)}%)</Text>
                </Flex>
              </VStack>
            }
          />
        );
      })()}
    </>
  );
});

QuickTradeActions.displayName = 'QuickTradeActions';

interface QuickTradeToolbarProps {
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
  onMenuAction?: (mode: QuickTradeMode) => void;
  currentMode?: QuickTradeMode;
  onClose?: () => void;
}

export const QuickTradeToolbar = memo(({ symbol, marketType = 'FUTURES', onMenuAction, currentMode, onClose }: QuickTradeToolbarProps) => {
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
        <QuickTradeActions
          symbol={symbol}
          marketType={marketType}
          showDragHandle
          onDragStart={handleDragStart}
          isDragging={isDragging}
          onMenuAction={onMenuAction}
          currentMode={currentMode}
          onClose={onClose}
        />
      </Box>
    </Box>
  );
});

QuickTradeToolbar.displayName = 'QuickTradeToolbar';
