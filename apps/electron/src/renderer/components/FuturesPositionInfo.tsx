import { Badge, Callout, CryptoIcon, ProgressBar, ProgressRoot, RecordRow } from '@renderer/components/ui';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { DEFAULT_CURRENCY, type FuturesPosition } from '@marketmind/types';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTrendingDown, LuTrendingUp, LuTriangleAlert } from 'react-icons/lu';
import { formatWalletCurrencyWithSign } from '../utils/currencyFormatter';

interface FuturesPositionInfoProps {
  position: FuturesPosition;
  currentPrice?: number;
  currency?: string;
}

export function FuturesPositionInfo({ position, currentPrice, currency = DEFAULT_CURRENCY }: FuturesPositionInfoProps) {
  const { t } = useTranslation();

  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = currentPrice ?? parseFloat(position.markPrice);
  const liquidationPrice = parseFloat(position.liquidationPrice);
  const positionAmt = Math.abs(parseFloat(position.positionAmt));
  const unrealizedPnl = parseFloat(position.unrealizedPnl);
  const side = parseFloat(position.positionAmt) > 0 ? 'LONG' : 'SHORT';

  const pnlPercent = useMemo(() => {
    if (entryPrice === 0) return 0;
    const pnl = side === 'LONG'
      ? ((markPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - markPrice) / entryPrice) * 100;
    return pnl * position.leverage;
  }, [entryPrice, markPrice, side, position.leverage]);

  const liquidationDistance = useMemo(() => {
    if (liquidationPrice === 0 || markPrice === 0) return 100;
    const distance = side === 'LONG'
      ? ((markPrice - liquidationPrice) / markPrice) * 100
      : ((liquidationPrice - markPrice) / markPrice) * 100;
    return Math.max(0, Math.min(100, distance));
  }, [markPrice, liquidationPrice, side]);

  const isInDanger = liquidationDistance < 10;
  const isWarning = liquidationDistance < 20;

  const getLiquidationColor = (): string => {
    if (isInDanger) return 'red';
    if (isWarning) return 'orange';
    return 'green';
  };

  const getLiquidationTextColor = (): string => {
    if (isInDanger) return 'trading.loss';
    if (isWarning) return 'trading.warning';
    return 'trading.profit';
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  const formatPnl = (pnl: number): string => formatWalletCurrencyWithSign(pnl, currency);

  return (
    <RecordRow density="card">
      <VStack gap={3} align="stretch">
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={2}>
            <CryptoIcon symbol={position.symbol} size={18} />
            <Text fontWeight="bold" color="fg">
              {position.symbol}
            </Text>
            <Badge
              colorPalette={side === 'LONG' ? 'green' : 'red'}
              size="sm"
            >
              <Flex align="center" gap={1}>
                {side === 'LONG' ? <LuTrendingUp size={12} /> : <LuTrendingDown size={12} />}
                {side}
              </Flex>
            </Badge>
            <Badge colorPalette="blue" size="sm">
              {position.leverage}x
            </Badge>
            <Badge
              colorPalette={position.marginType === 'ISOLATED' ? 'gray' : 'orange'}
              size="sm"
              variant="outline"
            >
              {position.marginType}
            </Badge>
          </Flex>
          <Text
            fontWeight="bold"
            color={pnlPercent >= 0 ? 'trading.profit' : 'trading.loss'}
          >
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
          </Text>
        </Flex>

        <Flex gap={4} flexWrap="wrap">
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.entryPrice')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              ${formatPrice(entryPrice)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.markPrice')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              ${formatPrice(markPrice)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.size')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              {positionAmt.toFixed(4)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.unrealizedPnl')}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={unrealizedPnl >= 0 ? 'trading.profit' : 'trading.loss'}
            >
              {formatPnl(unrealizedPnl)}
            </Text>
          </VStack>
        </Flex>

        <Box>
          <Flex justify="space-between" align="center" mb={1}>
            <Flex align="center" gap={1}>
              <Text fontSize="2xs" color="fg.muted">
                {t('futures.liquidationPrice')}
              </Text>
              {isWarning && (
                <Box color={isInDanger ? 'trading.loss' : 'trading.warning'}>
                  <LuTriangleAlert size={12} />
                </Box>
              )}
            </Flex>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color={getLiquidationTextColor()}
            >
              ${formatPrice(liquidationPrice)}
            </Text>
          </Flex>

          <ProgressRoot
            value={100 - liquidationDistance}
            max={100}
            size="sm"
            colorPalette={getLiquidationColor()}
          >
            <ProgressBar />
          </ProgressRoot>

          <Flex justify="space-between" mt={1}>
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.distanceToLiq')}
            </Text>
            <Text
              fontSize="2xs"
              fontWeight="medium"
              color={getLiquidationTextColor()}
            >
              {liquidationDistance.toFixed(1)}%
            </Text>
          </Flex>
        </Box>

        {isInDanger && (
          <Callout tone="danger" compact>
            {t('futures.liquidationWarning')}
          </Callout>
        )}
      </VStack>
    </RecordRow>
  );
}
