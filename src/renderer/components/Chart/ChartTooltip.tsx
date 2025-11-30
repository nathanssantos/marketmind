import { formatDateTimeTooltip, formatPrice } from '@/renderer/utils/formatters';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import type { AIPattern, Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import type { Order } from '@shared/types/trading';
import {
  getOrderCreatedAt,
  getOrderPrice,
  getOrderQuantity,
  getOrderType,
  isOrderActive,
  isOrderLong,
  isOrderPending,
} from '@shared/utils';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export interface ChartTooltipProps {
  candle: Kline | null;
  x: number;
  y: number;
  visible: boolean;
  containerWidth?: number;
  containerHeight?: number;
  aiPattern?: AIPattern | null | undefined;
  movingAverage?: {
    period: number;
    type: 'SMA' | 'EMA';
    color: string;
    value?: number;
  } | undefined;
  measurement?: {
    candleCount: number;
    priceChange: number;
    percentChange: number;
    startPrice: number;
    endPrice: number;
  } | undefined;
  order?: Order | null | undefined;
  currentPrice?: number | undefined;
}

export const ChartTooltip = ({
  candle,
  x,
  y,
  visible,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
  aiPattern,
  movingAverage,
  measurement,
  order,
  currentPrice,
}: ChartTooltipProps): ReactElement | null => {
  const { t } = useTranslation();

  if (!visible || (!candle && !aiPattern && !movingAverage && !measurement && !order)) return null;

  const isBullish = candle ? getKlineClose(candle) >= getKlineOpen(candle) : false;
  const change = candle ? getKlineClose(candle) - getKlineOpen(candle) : 0;
  const changePercent = candle ? ((change / getKlineOpen(candle)) * 100).toFixed(2) : '0.00';

  const tooltipWidth = 220;
  const tooltipHeight = measurement ? 120 : aiPattern ? 120 : 200;
  const offset = 10;

  let leftPos = x + offset;
  let topPos = y + offset;

  if (leftPos + tooltipWidth > containerWidth) {
    leftPos = x - tooltipWidth - offset;
  }

  if (topPos + tooltipHeight > containerHeight) {
    topPos = y - tooltipHeight - offset;
  }

  if (leftPos < 0) {
    leftPos = offset;
  }

  if (topPos < 0) {
    topPos = offset;
  }

  if (measurement) {
    const isPositive = measurement.priceChange >= 0;

    return (
      <Box
        position="absolute"
        left={`${leftPos}px`}
        top={`${topPos}px`}
        bg="bg.muted"
        color="fg"
        p={3}
        borderRadius="md"
        boxShadow="lg"
        fontSize="xs"
        zIndex={1000}
        pointerEvents="none"
        opacity={0.95}
        minW={`${tooltipWidth}px`}
        borderWidth={1}
        borderColor="border"
      >
        <Stack gap={1.5}>
          <Text fontSize="2xs" color="fg.muted" mb={1}>
            {candle ? formatDateTimeTooltip(candle.openTime) : ''}
          </Text>
          <HStack gap={1.5}>
            <Text>📏</Text>
            <Text fontWeight="semibold" color="blue.500">
              Measurement
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.muted">Candles:</Text>
            <Text fontWeight="medium">{measurement.candleCount}</Text>
          </HStack>
          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">Price Change:</Text>
            <Text
              fontWeight="semibold"
              color={isPositive ? 'green.500' : 'red.500'}
            >
              {isPositive ? '+' : ''}
              {formatPrice(measurement.priceChange)}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.muted">Percentage:</Text>
            <Text
              fontWeight="semibold"
              color={isPositive ? 'green.500' : 'red.500'}
            >
              {isPositive ? '+' : ''}
              {measurement.percentChange.toFixed(2)}%
            </Text>
          </HStack>
        </Stack>
      </Box>
    );
  }

  if (order) {
    const isLong = isOrderLong(order);
    const isActive = isOrderActive(order);
    const isPending = isOrderPending(order);
    const metadata = (order as any).metadata as { isPosition?: boolean; positionData?: { symbol: string; type: 'long' | 'short'; avgPrice: number; totalQuantity: number; totalPnL: number; orders: Order[] } } | undefined;
    const isPosition = metadata?.isPosition ?? false;
    const positionData = isPosition ? metadata?.positionData : null;

    let pnl = 0;
    let pnlPercent = 0;

    if (isActive && currentPrice) {
      if (isPosition && positionData) {
        pnl = positionData.totalPnL;
        const totalInvestment = positionData.avgPrice * positionData.totalQuantity;
        pnlPercent = (pnl / totalInvestment) * 100;
      } else {
        const entryPrice = getOrderPrice(order);
        const quantity = getOrderQuantity(order);
        const priceChange = currentPrice - entryPrice;
        pnl = priceChange * quantity * (isLong ? 1 : -1);
        pnlPercent = (pnl / (entryPrice * quantity)) * 100;
      }
    }

    const isProfitable = pnl >= 0;

    return (
      <Box
        position="absolute"
        left={`${leftPos}px`}
        top={`${topPos}px`}
        bg="bg.muted"
        color="fg"
        p={3}
        borderRadius="md"
        boxShadow="lg"
        fontSize="xs"
        zIndex={1000}
        pointerEvents="none"
        opacity={0.95}
        minW={`${tooltipWidth}px`}
        borderWidth={1}
        borderColor="border"
      >
        <Stack gap={1.5}>
          <Text fontSize="2xs" color="fg.muted" mb={1}>
            {formatDateTimeTooltip(getOrderCreatedAt(order))}
          </Text>
          <HStack gap={1.5}>
            <Text>{isLong ? '📈' : '📉'}</Text>
            <Text fontWeight="semibold" color={isLong ? 'green.500' : 'red.500'}>
              {t(`trading.ticket.${getOrderType(order)}`)} {isPosition ? '' : isPending ? `(${t('trading.orders.statusPending')})` : ''}
            </Text>
          </HStack>

          {isPosition && positionData && (
            <HStack justify="space-between">
              <Text color="fg.muted">{t('trading.portfolio.orderCount')}:</Text>
              <Text fontWeight="medium">{positionData.orders.length}x</Text>
            </HStack>
          )}

          <HStack justify="space-between">
            <Text color="fg.muted">{t('trading.ticket.symbol')}:</Text>
            <Text fontWeight="medium">{order.symbol}</Text>
          </HStack>

          <HStack justify="space-between">
            <Text color="fg.muted">{isPosition ? t('trading.portfolio.totalQuantity') : t('trading.ticket.quantity')}:</Text>
            <Text fontWeight="medium">{getOrderQuantity(order).toFixed(8)}</Text>
          </HStack>

          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">{isPosition ? t('trading.portfolio.avgPrice') : t('trading.ticket.entryPrice')}:</Text>
            <Text fontWeight="medium">{getOrderPrice(order).toFixed(2)}</Text>
          </HStack>

          {isActive && currentPrice && (
            <>
              <HStack justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.currentPrice')}:</Text>
                <Text fontWeight="medium">{currentPrice.toFixed(2)}</Text>
              </HStack>

              <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
                <Text color="fg.muted">{t('trading.portfolio.pnl')}:</Text>
                <Text
                  fontWeight="semibold"
                  color={isProfitable ? 'green.500' : 'red.500'}
                >
                  {isProfitable ? '+' : ''}
                  {pnl.toFixed(2)} ({isProfitable ? '+' : ''}
                  {pnlPercent.toFixed(2)}%)
                </Text>
              </HStack>
            </>
          )}

          {order.stopLoss !== undefined && order.stopLoss > 0 && (
            <HStack justify="space-between">
              <Text color="fg.muted">Stop Loss:</Text>
              <Text fontWeight="medium" color="red.500">{order.stopLoss.toFixed(2)}</Text>
            </HStack>
          )}

          {order.takeProfit !== undefined && order.takeProfit > 0 && (
            <HStack justify="space-between">
              <Text color="fg.muted">Take Profit:</Text>
              <Text fontWeight="medium" color="green.500">{order.takeProfit.toFixed(2)}</Text>
            </HStack>
          )}

          {order.totalFees !== undefined && parseFloat(order.totalFees) > 0 && (
            <>
              <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
                <Text color="fg.muted">Trading Fees:</Text>
                <Text fontWeight="medium" color="orange.500">
                  {parseFloat(order.totalFees).toFixed(4)}
                </Text>
              </HStack>
              {order.entryFee !== undefined && (
                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="2xs" pl={2}>• Entry:</Text>
                  <Text fontSize="2xs" color="fg.muted">{parseFloat(order.entryFee).toFixed(4)}</Text>
                </HStack>
              )}
              {order.exitFee !== undefined && (
                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="2xs" pl={2}>• Exit (est):</Text>
                  <Text fontSize="2xs" color="fg.muted">{parseFloat(order.exitFee).toFixed(4)}</Text>
                </HStack>
              )}
            </>
          )}

          {order.netPnl !== undefined && isActive && currentPrice && (
            <HStack justify="space-between">
              <Text color="fg.muted">Net P&L:</Text>
              <Text
                fontWeight="semibold"
                color={parseFloat(order.netPnl) >= 0 ? 'green.500' : 'red.500'}
              >
                {parseFloat(order.netPnl) >= 0 ? '+' : ''}
                {parseFloat(order.netPnl).toFixed(2)}
                {order.netPnlPercent !== undefined && ` (${parseFloat(order.netPnl) >= 0 ? '+' : ''}${parseFloat(order.netPnlPercent).toFixed(2)}%)`}
              </Text>
            </HStack>
          )}
        </Stack>
      </Box>
    );
  }

  if (aiPattern) {
    const patternTypeLabel = aiPattern.type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const isLine = 'points' in aiPattern;

    let priceValue: number | undefined;
    let topPriceValue: number | undefined;
    let bottomPriceValue: number | undefined;

    if (isLine && 'points' in aiPattern && aiPattern.points.length >= 2) {
      priceValue = (aiPattern.points[0].price + aiPattern.points[1].price) / 2;
    } else if ('topPrice' in aiPattern && 'bottomPrice' in aiPattern) {
      topPriceValue = aiPattern.topPrice;
      bottomPriceValue = aiPattern.bottomPrice;
    }

    return (
      <Box
        position="absolute"
        left={`${leftPos}px`}
        top={`${topPos}px`}
        bg="bg.muted"
        color="fg"
        p={3}
        borderRadius="md"
        boxShadow="lg"
        fontSize="xs"
        zIndex={1000}
        pointerEvents="none"
        opacity={0.95}
        minW={`${tooltipWidth}px`}
        borderWidth={1}
        borderColor="border"
      >
        <Stack gap={1.5}>
          {aiPattern.timestamp && (
            <Text fontSize="2xs" color="fg.muted" mb={1}>
              {formatDateTimeTooltip(aiPattern.timestamp)}
            </Text>
          )}
          <HStack gap={1.5}>
            <Text>🤖</Text>
            <Text fontWeight="semibold" color="blue.500">
              {patternTypeLabel}
            </Text>
          </HStack>
          {aiPattern.label && (
            <Text color="fg.muted" fontSize="xs">
              {aiPattern.label}
            </Text>
          )}
          {aiPattern.confidence !== undefined && (
            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">Confidence:</Text>
              <Text fontWeight="medium" color={aiPattern.confidence >= 0.7 ? 'green.500' : aiPattern.confidence >= 0.5 ? 'yellow.500' : 'orange.500'}>
                {Math.round(aiPattern.confidence * 100)}%
              </Text>
            </HStack>
          )}
          {isLine && priceValue !== undefined ? (
            <HStack justify="space-between" pt={aiPattern.confidence === undefined ? 1 : 0} borderTopWidth={aiPattern.confidence === undefined ? 1 : 0} borderColor="border">
              <Text color="fg.muted">Price Level:</Text>
              <Text fontWeight="medium">{formatPrice(priceValue)}</Text>
            </HStack>
          ) : topPriceValue !== undefined && bottomPriceValue !== undefined ? (
            <>
              <HStack justify="space-between" pt={aiPattern.confidence === undefined ? 1 : 0} borderTopWidth={aiPattern.confidence === undefined ? 1 : 0} borderColor="border">
                <Text color="fg.muted">Top:</Text>
                <Text fontWeight="medium">{formatPrice(topPriceValue)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="fg.muted">Bottom:</Text>
                <Text fontWeight="medium">{formatPrice(bottomPriceValue)}</Text>
              </HStack>
            </>
          ) : null}
        </Stack>
      </Box>
    );
  }

  if (movingAverage) {
    const maTypeLabel = movingAverage.type === 'SMA' ? 'Simple Moving Average' : 'Exponential Moving Average';

    return (
      <Box
        position="absolute"
        left={`${leftPos}px`}
        top={`${topPos}px`}
        bg="bg.muted"
        color="fg"
        p={3}
        borderRadius="md"
        boxShadow="lg"
        fontSize="xs"
        zIndex={1000}
        pointerEvents="none"
        opacity={0.95}
        minW={`${tooltipWidth}px`}
        borderWidth={1}
        borderColor="border"
      >
        <Stack gap={1.5}>
          <Text fontSize="2xs" color="fg.muted" mb={1}>
            {candle ? formatDateTimeTooltip(candle.openTime) : ''}
          </Text>
          <HStack gap={1.5}>
            <Box w={3} h={3} bg={movingAverage.color} borderRadius="sm" />
            <Text fontWeight="semibold">
              {movingAverage.type}({movingAverage.period})
            </Text>
          </HStack>
          <Text color="fg.muted" fontSize="2xs">{maTypeLabel}</Text>
          {movingAverage.value !== undefined && (
            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">Value:</Text>
              <Text fontWeight="medium">{formatPrice(movingAverage.value)}</Text>
            </HStack>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      position="absolute"
      left={`${leftPos}px`}
      top={`${topPos}px`}
      bg="bg.muted"
      color="fg"
      p={3}
      borderRadius="md"
      boxShadow="lg"
      fontSize="xs"
      zIndex={1000}
      pointerEvents="none"
      opacity={0.95}
      minW={`${tooltipWidth}px`}
      borderWidth={1}
      borderColor="border"
    >
      <Stack gap={1.5}>
        <Text fontSize="2xs" color="fg.muted" mb={1}>
          {candle ? formatDateTimeTooltip(candle.openTime) : ''}
        </Text>

        {candle && (
          <Stack gap={0.5}>
            <HStack justify="space-between">
              <Text color="fg.muted">Open:</Text>
              <Text fontWeight="medium">{formatPrice(getKlineOpen(candle))}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">High:</Text>
              <Text fontWeight="medium" color="green.500">
                {formatPrice(getKlineHigh(candle))}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">Low:</Text>
              <Text fontWeight="medium" color="red.500">
                {formatPrice(getKlineLow(candle))}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">Close:</Text>
              <Text fontWeight="medium">{formatPrice(getKlineClose(candle))}</Text>
            </HStack>
          </Stack>
        )}

        {candle && (
          <>
            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">Change:</Text>
              <Text
                fontWeight="semibold"
                color={isBullish ? 'green.500' : 'red.500'}
              >
                {isBullish ? '+' : ''}
                {formatPrice(change)} ({changePercent}%)
              </Text>
            </HStack>

            <HStack justify="space-between">
              <Text color="fg.muted">Volume:</Text>
              <Text fontWeight="medium">{getKlineVolume(candle).toLocaleString()}</Text>
            </HStack>
          </>
        )}
      </Stack>
    </Box>
  );
};
