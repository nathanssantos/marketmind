import { Badge, CryptoIcon, ProgressBar, ProgressRoot } from '@renderer/components/ui';
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
  const markPrice = currentPrice || parseFloat(position.markPrice);
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

  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  const formatPnl = (pnl: number): string => formatWalletCurrencyWithSign(pnl, currency);

  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
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
            color={pnlPercent >= 0 ? 'green.500' : 'red.500'}
          >
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
          </Text>
        </Flex>

        <Flex gap={4} flexWrap="wrap">
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.entryPrice', 'Entry Price')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              ${formatPrice(entryPrice)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.markPrice', 'Mark Price')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              ${formatPrice(markPrice)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.size', 'Size')}
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg">
              {positionAmt.toFixed(4)}
            </Text>
          </VStack>
          <VStack gap={0} align="start">
            <Text fontSize="2xs" color="fg.muted">
              {t('futures.unrealizedPnl', 'Unrealized PnL')}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={unrealizedPnl >= 0 ? 'green.500' : 'red.500'}
            >
              {formatPnl(unrealizedPnl)}
            </Text>
          </VStack>
        </Flex>

        <Box>
          <Flex justify="space-between" align="center" mb={1}>
            <Flex align="center" gap={1}>
              <Text fontSize="2xs" color="fg.muted">
                {t('futures.liquidationPrice', 'Liquidation Price')}
              </Text>
              {isWarning && (
                <Box color={isInDanger ? 'red.500' : 'orange.500'}>
                  <LuTriangleAlert size={12} />
                </Box>
              )}
            </Flex>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color={`${getLiquidationColor()}.500`}
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
              {t('futures.distanceToLiq', 'Distance to liquidation')}
            </Text>
            <Text
              fontSize="2xs"
              fontWeight="medium"
              color={`${getLiquidationColor()}.500`}
            >
              {liquidationDistance.toFixed(1)}%
            </Text>
          </Flex>
        </Box>

        {isInDanger && (
          <Box p={2} bg="red.subtle" borderRadius="md" borderWidth="1px" borderColor="red.emphasized">
            <Flex align="center" gap={2}>
              <Box color="red.fg">
                <LuTriangleAlert size={14} />
              </Box>
              <Text fontSize="2xs" color="red.fg" fontWeight="medium">
                {t('futures.liquidationWarning', 'Warning: Position is close to liquidation. Consider reducing position size or adding margin.')}
              </Text>
            </Flex>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
