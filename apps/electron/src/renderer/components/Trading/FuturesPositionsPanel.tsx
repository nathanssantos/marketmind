import type { MarketType } from '@marketmind/types';
import { Badge, Button, Callout, ConfirmationDialog, CryptoIcon, EmptyState, IconButton, ProgressBar, ProgressRoot, TooltipWrapper } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { Box, Flex, Stack, Text, VStack } from '@chakra-ui/react';
import { wouldLiquidate } from '@marketmind/types';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import type { RouterOutputs } from '@renderer/services/trpc';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeftRight, LuBot, LuTrendingDown, LuTrendingUp, LuTriangleAlert, LuX } from 'react-icons/lu';

type FuturesPosition = Extract<
  RouterOutputs['futuresTrading']['getPositions'][number],
  { id: string }
>;

const FuturesPositionCard = memo(({
  position,
  currentPrice,
  onClose,
  isClosing,
  onReverse,
  isReversing,
  onNavigateToSymbol,
}: {
  position: FuturesPosition;
  currentPrice?: number;
  onClose: () => void;
  isClosing: boolean;
  onReverse: () => void;
  isReversing: boolean;
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}) => {
  const { t } = useTranslation();
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = currentPrice ?? parseFloat(position.currentPrice ?? position.entryPrice);
  const liquidationPrice = parseFloat(position.liquidationPrice ?? '0');
  const quantity = parseFloat(position.entryQty);
  const leverage = position.leverage ?? 1;
  const accumulatedFunding = parseFloat(position.accumulatedFunding ?? '0');
  const side = position.side;

  const { pnlPercent, unrealizedPnl, liquidationDistance, isInDanger, isWarning, wouldBeLiquidated } = useMemo(() => {
    const positionValue = entryPrice * quantity;
    const currentValue = markPrice * quantity;

    const grossPnl = side === 'LONG'
      ? currentValue - positionValue
      : positionValue - currentValue;

    const marginValue = positionValue / leverage;
    const pnlPct = (grossPnl / marginValue) * 100;

    let liqDistance = 100;
    if (liquidationPrice > 0 && markPrice > 0) {
      liqDistance = side === 'LONG'
        ? ((markPrice - liquidationPrice) / markPrice) * 100
        : ((liquidationPrice - markPrice) / markPrice) * 100;
      liqDistance = Math.max(0, Math.min(100, liqDistance));
    }

    return {
      pnlPercent: pnlPct,
      unrealizedPnl: grossPnl,
      liquidationDistance: liqDistance,
      isInDanger: liqDistance < 10,
      isWarning: liqDistance < 20,
      wouldBeLiquidated: liquidationPrice > 0 && wouldLiquidate(markPrice, liquidationPrice, side),
    };
  }, [entryPrice, markPrice, liquidationPrice, quantity, leverage, side]);

  const getLiquidationColor = (): string => {
    if (isInDanger || wouldBeLiquidated) return 'red';
    if (isWarning) return 'orange';
    return 'green';
  };

  const getLiquidationTextColor = (): string => {
    if (isInDanger || wouldBeLiquidated) return 'trading.loss';
    if (isWarning) return 'trading.warning';
    return 'trading.profit';
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={side === 'LONG' ? 'trading.long' : 'trading.short'}
    >
      <VStack gap={2} align="stretch">
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={2}>
            <CryptoIcon
              symbol={position.symbol}
              size={16}
              onClick={() => onNavigateToSymbol?.(position.symbol, 'FUTURES')}
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
            />
            <Text
              fontWeight="bold"
              fontSize="sm"
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              _hover={onNavigateToSymbol ? { color: 'accent.solid', textDecoration: 'underline' } : undefined}
              onClick={() => onNavigateToSymbol?.(position.symbol, 'FUTURES')}
            >
              {position.symbol}
            </Text>
            <Badge colorPalette={side === 'LONG' ? 'green' : 'red'} size="sm">
              <Flex align="center" gap={1}>
                {side === 'LONG' ? <LuTrendingUp size={10} /> : <LuTrendingDown size={10} />}
                {side}
              </Flex>
            </Badge>
            <Badge colorPalette="purple" size="sm" px={2}>{leverage}x</Badge>
            <Badge colorPalette="orange" size="sm" variant="outline">FUT</Badge>
            <Badge colorPalette="blue" size="sm">
              <Flex align="center" gap={1}>
                <LuBot size={10} />
                AUTO
              </Flex>
            </Badge>
          </Flex>
          <Flex gap={1}>
            <TooltipWrapper label={t('futures.reversePosition', 'Reverse Position')}>
              <IconButton
                size="2xs"
                variant="ghost"
                colorPalette="orange"
                onClick={() => setShowReverseConfirm(true)}
                loading={isReversing}
                aria-label={t('futures.reversePosition', 'Reverse Position')}
              >
                <LuArrowLeftRight size={12} />
              </IconButton>
            </TooltipWrapper>
            <Button
              size="2xs"
              variant="ghost"
              colorPalette="red"
              onClick={onClose}
              loading={isClosing}
            >
              <LuX size={12} />
            </Button>
          </Flex>
        </Flex>

        <Stack gap={1} fontSize="xs">
          <Flex justify="space-between">
            <Text color="fg.muted">{t('futures.entryPrice', 'Entry Price')}</Text>
            <Stack gap={0} align="flex-end">
              <Text>${formatPrice(entryPrice)}</Text>
              <BrlValue usdtValue={entryPrice} />
            </Stack>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('futures.markPrice', 'Mark Price')}</Text>
            <Stack gap={0} align="flex-end">
              <Text fontWeight="medium">${formatPrice(markPrice)}</Text>
              <BrlValue usdtValue={markPrice} />
            </Stack>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('futures.size', 'Size')}</Text>
            <Text>{quantity.toFixed(4)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('futures.unrealizedPnl', 'Unrealized PnL')}</Text>
            <Stack gap={0} align="flex-end">
              <Text fontWeight="medium" color={unrealizedPnl >= 0 ? 'trading.profit' : 'trading.loss'}>
                {unrealizedPnl >= 0 ? '+' : ''}${Math.abs(unrealizedPnl).toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
              </Text>
              <BrlValue usdtValue={unrealizedPnl} />
            </Stack>
          </Flex>
          {accumulatedFunding !== 0 && (
            <Flex justify="space-between">
              <Text color="fg.muted">{t('futures.accumulatedFunding', 'Accumulated Funding')}</Text>
              <Stack gap={0} align="flex-end">
                <Text color={accumulatedFunding >= 0 ? 'trading.profit' : 'trading.loss'}>
                  {accumulatedFunding >= 0 ? '+' : ''}${accumulatedFunding.toFixed(4)}
                </Text>
                <BrlValue usdtValue={accumulatedFunding} />
              </Stack>
            </Flex>
          )}
        </Stack>

        {liquidationPrice > 0 && (
          <Box>
            <Flex justify="space-between" align="center" mb={1}>
              <Flex align="center" gap={1}>
                <Text fontSize="2xs" color="fg.muted">{t('futures.liquidationPrice', 'Liquidation Price')}</Text>
                {(isWarning || wouldBeLiquidated) && (
                  <Box color={isInDanger || wouldBeLiquidated ? 'trading.loss' : 'trading.warning'}>
                    <LuTriangleAlert size={10} />
                  </Box>
                )}
              </Flex>
              <Text fontSize="xs" fontWeight="bold" color={getLiquidationTextColor()}>
                ${formatPrice(liquidationPrice)}
              </Text>
            </Flex>

            <ProgressRoot
              value={100 - liquidationDistance}
              max={100}
              size="xs"
              colorPalette={getLiquidationColor()}
            >
              <ProgressBar />
            </ProgressRoot>

            <Flex justify="space-between" mt={0.5}>
              <Text fontSize="2xs" color="fg.muted">{t('futures.distanceToLiq', 'Distance to liquidation')}</Text>
              <Text fontSize="2xs" fontWeight="medium" color={getLiquidationTextColor()}>
                {liquidationDistance.toFixed(1)}%
              </Text>
            </Flex>
          </Box>
        )}

        {(isInDanger || wouldBeLiquidated) && (
          <Callout tone="danger" compact>
            {wouldBeLiquidated
              ? t('futures.liquidated', 'Position would be liquidated at current price!')
              : t('futures.liquidationWarning', 'Warning: Position is close to liquidation.')}
          </Callout>
        )}
      </VStack>

      <ConfirmationDialog
        isOpen={showReverseConfirm}
        onClose={() => setShowReverseConfirm(false)}
        onConfirm={() => {
          setShowReverseConfirm(false);
          onReverse();
        }}
        title={t('futures.reverseConfirmTitle', 'Reverse Position?')}
        description={t('futures.reverseConfirmDescription', 'Close {{side}} {{quantity}} {{symbol}} and open {{newSide}} {{quantity}} {{symbol}} at market price?', {
          side,
          quantity: quantity.toFixed(4),
          symbol: position.symbol,
          newSide: side === 'LONG' ? 'SHORT' : 'LONG',
        })}
        confirmLabel={t('futures.reversePosition', 'Reverse Position')}
        colorPalette="orange"
        isLoading={isReversing}
      />
    </Box>
  );
});

FuturesPositionCard.displayName = 'FuturesPositionCard';

const FuturesPositionsPanelComponent = () => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const { activeWallet } = useActiveWallet();
  const activeWalletId = activeWallet?.id;

  const {
    positions,
    realtimePrices,
    isLoadingPositions,
    closePosition,
    isClosingPosition,
    reversePosition,
    isReversingPosition,
  } = useBackendFuturesTrading(activeWalletId ?? '');

  const openPositions = useMemo((): FuturesPosition[] => {
    if (!Array.isArray(positions)) return [];
    return positions.filter(
      (p): p is FuturesPosition => p !== null && typeof p === 'object' && 'id' in p && p.status === 'open'
    );
  }, [positions]);

  const handleClosePosition = async (positionId: string, symbol: string) => {
    if (!activeWalletId) return;
    await closePosition({ walletId: activeWalletId, symbol, positionId });
  };

  const handleReversePosition = async (positionId: string, positionSymbol: string) => {
    if (!activeWalletId) return;
    const result = await reversePosition({ walletId: activeWalletId, symbol: positionSymbol, positionId });
    if (result && 'success' in result && !result.success && 'error' in result && typeof result.error === 'string') {
      throw new Error(result.error);
    }
  };

  if (!activeWalletId) return null;

  if (isLoadingPositions) {
    return <EmptyState size="sm" title={t('common.loading')} />;
  }

  if (openPositions.length === 0) return null;

  return (
    <Stack gap={3}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold">
            {t('futures.positions', 'Futures Positions')}
          </Text>
          <Badge colorPalette="purple" size="sm">{openPositions.length}</Badge>
        </Flex>
      </Flex>

      <Stack gap={2}>
        {openPositions.map((position) => (
          <FuturesPositionCard
            key={position.id}
            position={position}
            currentPrice={realtimePrices[position.symbol]}
            onClose={() => { void handleClosePosition(position.id, position.symbol); }}
            isClosing={isClosingPosition}
            onReverse={() => { void handleReversePosition(position.id, position.symbol); }}
            isReversing={isReversingPosition}
            onNavigateToSymbol={globalActions?.navigateToSymbol}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export const FuturesPositionsPanel = memo(FuturesPositionsPanelComponent);
