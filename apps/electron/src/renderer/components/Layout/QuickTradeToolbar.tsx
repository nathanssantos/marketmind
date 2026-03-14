import { Button, ConfirmationDialog, IconButton, Slider, TooltipWrapper } from '@renderer/components/ui';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useToast } from '@renderer/hooks/useToast';
import { useQuickTradeStore } from '@renderer/store/quickTradeStore';
import { usePriceStore } from '@renderer/store/priceStore';
import { useUIPref } from '@renderer/store/preferencesStore';
import { trpc } from '@renderer/utils/trpc';
import { formatChartPrice } from '@renderer/utils/formatters';
import { roundTradingQty } from '@shared/utils';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuBan, LuGripVertical, LuX } from 'react-icons/lu';
import { GridOrderPopover } from './GridOrderPopover';
import { TrailingStopPopover } from './TrailingStopPopover';

const SIZE_PRESETS = [0.3, 0.5, 1, 2.5, 5, 10] as const;
const SNAP_THRESHOLD = 16;
const EDGE_PADDING = 8;

interface QuickTradeToolbarProps {
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
}

export const QuickTradeToolbar = memo(({ symbol, marketType = 'FUTURES' }: QuickTradeToolbarProps) => {
  const { t } = useTranslation();
  const { warning, error: toastError } = useToast();
  const { activeWallet } = useActiveWallet();
  const { createOrder, isCreatingOrder } = useBackendTradingMutations();
  const { sizePercent, useMinNotional, setSizePercent, setMinNotional } = useQuickTradeStore();
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

  const {
    positions,
    reversePosition,
    isReversingPosition,
    closePositionAndCancelOrders,
    isClosingPositionAndCancellingOrders,
    cancelAllOrders,
    isCancellingAllOrders,
  } = useBackendFuturesTrading(activeWallet?.id || '');
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCancelOrdersConfirm, setShowCancelOrdersConfirm] = useState(false);

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

  const { data: symbolFilters } = trpc.trading.getSymbolFilters.useQuery(
    { symbol, marketType },
    { enabled: !!symbol, staleTime: 60 * 60 * 1000 }
  );
  const minNotional = symbolFilters?.minNotional ?? (marketType === 'FUTURES' ? 5 : 10);
  const stepSize = symbolFilters?.stepSize ?? 0;
  const balance = parseFloat(activeWallet?.currentBalance ?? '0');
  const currentPrice = usePriceStore((s) => s.prices[symbol]?.price ?? 0);

  const minNotionalPercent = useMemo(() => {
    if (balance <= 0 || currentPrice <= 0) return 0.1;
    const rawQty = minNotional / currentPrice;
    let qtyStep: number;
    if (rawQty >= 100) qtyStep = 1;
    else if (rawQty >= 1) qtyStep = 0.01;
    else if (rawQty >= 0.001) qtyStep = 0.0001;
    else qtyStep = 0.000001;
    const minQty = Math.ceil(rawQty / qtyStep) * qtyStep;
    const requiredBalance = minQty * currentPrice;
    return Math.max(0.1, Math.ceil((requiredBalance / balance) * 1000) / 10);
  }, [balance, currentPrice, minNotional]);

  const roundQtyUp = useMemo(() => {
    if (stepSize <= 0) return roundTradingQty;
    return (qty: number): string => {
      const rounded = Math.ceil(qty / stepSize) * stepSize;
      const decimals = stepSize.toString().split('.')[1]?.length ?? 0;
      return rounded.toFixed(decimals);
    };
  }, [stepSize]);

  const getQuantity = useCallback((price: number): string => {
    if (useMinNotional) {
      const qty = price > 0 ? (minNotional * 1.01) / price : 0;
      return roundQtyUp(qty);
    }
    const pct = sizePercent / 100;
    const qty = balance > 0 && price > 0 ? (balance * pct) / price : 0;
    return roundTradingQty(qty);
  }, [balance, sizePercent, useMinNotional, minNotional, roundQtyUp]);

  const handleQuickOrder = useCallback(async (side: 'BUY' | 'SELL') => {
    if (!activeWallet?.id) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;
    const price = usePriceStore.getState().getPrice(symbol);
    if (!price || price <= 0) {
      toastError(t('chart.quickTrade.noPriceError'));
      return;
    }
    const quantity = getQuantity(price);
    if (!quantity || parseFloat(quantity) <= 0) {
      toastError(t('chart.quickTrade.invalidQuantityError'));
      return;
    }
    try {
      await createOrder({ walletId: activeWallet.id, symbol, side, type: 'MARKET', quantity });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('trading.order.failed'), msg);
    }
  }, [activeWallet?.id, symbol, getQuantity, createOrder, warning, toastError, t]);

  const handleBuy = useCallback(() => handleQuickOrder('BUY'), [handleQuickOrder]);
  const handleSell = useCallback(() => handleQuickOrder('SELL'), [handleQuickOrder]);
  const handleSliderChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined && v !== sizePercent) setSizePercent(v);
  }, [setSizePercent, sizePercent]);
  const handleMinClick = useCallback(() => setMinNotional(minNotionalPercent), [setMinNotional, minNotionalPercent]);

  return (
    <Box ref={containerRef} position="absolute" inset={0} zIndex={10} pointerEvents="none">
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
        <VStack gap={1.5} align="stretch">
          <HStack gap={1} justify="center">
            <Box
              onMouseDown={handleDragStart}
              cursor={isDragging ? 'grabbing' : 'grab'}
              display="flex"
              alignItems="center"
              px={0.5}
              color="fg.muted"
              _hover={{ color: 'fg' }}
            >
              <LuGripVertical size={12} />
            </Box>
            <Button size="2xs" fontSize="xs" px={1} minW={0} h="20px" variant="outline" color={useMinNotional ? 'blue.500' : 'fg.muted'} onClick={handleMinClick}>
              {t('chart.quickTrade.min')}
            </Button>
            {SIZE_PRESETS.map((pct) => (
              <Button key={pct} size="2xs" fontSize="xs" px={1} minW={0} h="20px" variant="outline" color={!useMinNotional && sizePercent === pct ? 'blue.500' : 'fg.muted'} onClick={() => setSizePercent(pct)}>
                {pct}%
              </Button>
            ))}
          </HStack>

          <HStack gap={1.5} px={0.5}>
            <Slider value={[sizePercent]} onValueChange={handleSliderChange} min={0.3} max={25} step={0.1} />
            <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="right" lineHeight="1" whiteSpace="nowrap">
              {`${Math.round(sizePercent * 10) / 10}%`}
            </Text>
            <GridOrderPopover />
            <TrailingStopPopover symbol={symbol} />
          </HStack>

          <HStack gap={1.5}>
            {marketType === 'FUTURES' && (
              <>
                <TooltipWrapper label={t('futures.reversePosition', 'Reverse Position')}>
                  <IconButton
                    size="2xs"
                    h="34px"
                    w="34px"
                    variant="solid"
                    colorPalette="blue"
                    color="white"
                    onClick={handleReverseClick}
                    loading={isReversingPosition}
                    disabled={!currentPosition}
                    aria-label={t('futures.reversePosition', 'Reverse Position')}
                  >
                    <LuArrowUpDown size={12} />
                  </IconButton>
                </TooltipWrapper>
                <TooltipWrapper label={t('futures.closePosition', 'Close Position')}>
                  <IconButton
                    size="2xs"
                    h="34px"
                    w="34px"
                    variant="solid"
                    colorPalette="red"
                    color="white"
                    onClick={handleClosePositionClick}
                    loading={isClosingPositionAndCancellingOrders}
                    disabled={!currentPosition}
                    aria-label={t('futures.closePosition', 'Close Position')}
                  >
                    <LuX size={12} />
                  </IconButton>
                </TooltipWrapper>
                <TooltipWrapper label={t('futures.cancelOrders', 'Cancel Orders')}>
                  <IconButton
                    size="2xs"
                    h="34px"
                    w="34px"
                    variant="solid"
                    colorPalette="orange"
                    color="white"
                    onClick={handleCancelOrdersClick}
                    loading={isCancellingAllOrders}
                    aria-label={t('futures.cancelOrders', 'Cancel Orders')}
                  >
                    <LuBan size={12} />
                  </IconButton>
                </TooltipWrapper>
              </>
            )}
            <Button size="2xs" fontSize="2xs" h="34px" colorPalette="green" variant="solid" onClick={handleBuy} loading={isCreatingOrder} flex={1}>
              <VStack gap={0} lineHeight="1">
                <Text fontSize="2xs">{t('chart.quickTrade.buy')}</Text>
                <Text fontSize="2xs" fontWeight="bold">{currentPrice > 0 ? formatChartPrice(currentPrice) : '—'}</Text>
              </VStack>
            </Button>
            <Button size="2xs" fontSize="2xs" h="34px" colorPalette="red" variant="solid" onClick={handleSell} loading={isCreatingOrder} flex={1}>
              <VStack gap={0} lineHeight="1">
                <Text fontSize="2xs">{t('chart.quickTrade.sell')}</Text>
                <Text fontSize="2xs" fontWeight="bold">{currentPrice > 0 ? formatChartPrice(currentPrice) : '—'}</Text>
              </VStack>
            </Button>
          </HStack>
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
      </Box>
    </Box>
  );
});

QuickTradeToolbar.displayName = 'QuickTradeToolbar';
