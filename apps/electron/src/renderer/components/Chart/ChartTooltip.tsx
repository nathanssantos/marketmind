import { formatDateTimeTooltip, formatPrice } from '@/renderer/utils/formatters';
import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react';
import type { AIPattern, AITradingContext, Kline, Order, TradingSetup } from '@marketmind/types';
import {
  getKlineAverageTradeValue,
  getKlineBuyPressure,
  getKlineClose,
  getKlineHigh,
  getKlineLow,
  getKlineOpen,
  getKlinePressureType,
  getKlineQuoteVolume,
  getKlineTrades,
  getKlineVolume,
  getOrderCreatedAt,
  getOrderPrice,
  getOrderQuantity,
  getOrderType,
  isOrderActive,
  isOrderLong,
  isOrderPending
} from '@shared/utils';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export interface ChartTooltipProps {
  kline: Kline | null;
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
    klineCount: number;
    priceChange: number;
    percentChange: number;
    startPrice: number;
    endPrice: number;
  } | undefined;
  order?: Order | null | undefined;
  currentPrice?: number | undefined;
  setup?: TradingSetup | null | undefined;
  setupContext?: AITradingContext | null | undefined;
}

export const ChartTooltip = ({
  kline,
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
  setup,
  setupContext,
}: ChartTooltipProps): ReactElement | null => {
  const { t } = useTranslation();

  if (!visible || (!kline && !aiPattern && !movingAverage && !measurement && !order && !setup)) return null;

  const isBullish = kline ? getKlineClose(kline) >= getKlineOpen(kline) : false;
  const change = kline ? getKlineClose(kline) - getKlineOpen(kline) : 0;
  const changePercent = kline ? ((change / getKlineOpen(kline)) * 100).toFixed(2) : '0.00';

  const buyPressure = kline ? getKlineBuyPressure(kline) : 0.5;
  const pressureType = kline ? getKlinePressureType(kline) : 'neutral';
  const trades = kline ? getKlineTrades(kline) : 0;
  const quoteVolume = kline ? getKlineQuoteVolume(kline) : 0;
  const avgTradeValue = kline ? getKlineAverageTradeValue(kline) : 0;

  const tooltipWidth = 220;
  const tooltipHeight = measurement ? 120 : aiPattern ? 120 : 260;
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
            {kline ? formatDateTimeTooltip(kline.openTime) : ''}
          </Text>
          <HStack gap={1.5}>
            <Text>📏</Text>
            <Text fontWeight="semibold" color="blue.500">
              Measurement
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.muted">Klines:</Text>
            <Text fontWeight="medium">{measurement.klineCount}</Text>
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
    const metadata = (order as any).metadata as { isPosition?: boolean; positionData?: { symbol: string; type: 'long' | 'short'; avgPrice: number; totalQuantity: number; totalPnL: number; orders: Order[]; setupTypes?: string[] } } | undefined;
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
            <>
              <HStack justify="space-between">
                <Text color="fg.muted">{t('trading.portfolio.orderCount')}:</Text>
                <Text fontWeight="medium">{positionData.orders.length}x</Text>
              </HStack>
              {positionData.setupTypes && positionData.setupTypes.length > 0 && (
                <HStack justify="space-between" flexWrap="wrap" pt={1} borderTopWidth={1} borderColor="border">
                  <Text color="fg.muted">{t('trading.portfolio.setups')}:</Text>
                  <Stack gap={0.5} align="flex-end" bg="bg.subtle" p={1} borderRadius="sm">
                    {positionData.setupTypes.map((setup, idx) => (
                      <Badge key={idx} colorScheme="blue" fontSize="2xs">
                        {setup.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </Stack>
                </HStack>
              )}
            </>
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
          {aiPattern.openTime && (
            <Text fontSize="2xs" color="fg.muted" mb={1}>
              {formatDateTimeTooltip(aiPattern.openTime)}
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
            {kline ? formatDateTimeTooltip(kline.openTime) : ''}
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

  if (setup) {
    const isLong = setup.direction === 'LONG';
    const riskRewardRatio = setup.stopLoss && setup.takeProfit
      ? Math.abs((setup.takeProfit - setup.entryPrice) / (setup.entryPrice - setup.stopLoss))
      : null;

    const getUrgencyColor = (urgency: string) => {
      if (urgency === 'immediate') return 'red';
      if (urgency === 'wait_for_pullback') return 'orange';
      return 'green';
    };

    const getUrgencyLabel = (urgency: string) => {
      if (urgency === 'immediate') return 'Immediate';
      if (urgency === 'wait_for_pullback') return 'Wait for Pullback';
      return 'Wait for Confirmation';
    };

    const getSentimentColor = (sentiment: string) => {
      if (sentiment === 'bullish') return 'green';
      if (sentiment === 'bearish') return 'red';
      return 'gray';
    };

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
          {setup.openTime && (
            <Text fontSize="2xs" color="fg.muted" mb={1}>
              {new Date(setup.openTime).toLocaleString()}
            </Text>
          )}

          <HStack gap={1.5}>
            <Text>{isLong ? '📈' : '📉'}</Text>
            <Text fontWeight="semibold" color={isLong ? 'green.500' : 'red.500'}>
              {setup.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </HStack>

          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">{t('common.direction')}:</Text>
            <Text fontWeight="medium" color={isLong ? 'green.500' : 'red.500'}>
              {isLong ? t('common.long') : t('common.short')}
            </Text>
          </HStack>

          {setup.confidence !== undefined && (
            <HStack justify="space-between">
              <Text color="fg.muted">{t('aiTrading.confidence')}:</Text>
              <Text fontWeight="medium" color={setup.confidence >= 0.7 ? 'green.500' : setup.confidence >= 0.5 ? 'yellow.500' : 'orange.500'}>
                {Math.round(setup.confidence * 100)}%
              </Text>
            </HStack>
          )}

          {riskRewardRatio && (
            <HStack justify="space-between">
              <Text color="fg.muted">R:R {t('common.ratio')}:</Text>
              <Text fontWeight="medium" color="blue.500">
                1:{riskRewardRatio.toFixed(2)}
              </Text>
            </HStack>
          )}

          {setupContext && (
            <>
              <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
                <Text color="fg.muted">{t('context.sentiment')}:</Text>
                <Badge colorScheme={getSentimentColor(setupContext.marketSentiment)}>
                  {t(`context.sentiments.${setupContext.marketSentiment}`)}
                </Badge>
              </HStack>

              {setupContext.fearGreedIndex !== undefined && (
                <HStack justify="space-between">
                  <Text color="fg.muted">{t('context.fearGreed')}:</Text>
                  <Text fontWeight="medium">
                    {setupContext.fearGreedIndex}
                  </Text>
                </HStack>
              )}
            </>
          )}

          {setup.urgency && (
            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">{t('aiTrading.urgency')}:</Text>
              <Badge colorScheme={getUrgencyColor(setup.urgency)}>
                {getUrgencyLabel(setup.urgency)}
              </Badge>
            </HStack>
          )}

          <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
            <Text color="fg.muted">{t('common.entry')}:</Text>
            <Text fontWeight="medium">{formatPrice(setup.entryPrice)}</Text>
          </HStack>

          {setup.stopLoss && (
            <HStack justify="space-between">
              <Text color="fg.muted">{t('common.stopLoss')}:</Text>
              <Text fontWeight="medium" color="red.500">{formatPrice(setup.stopLoss)}</Text>
            </HStack>
          )}

          {setup.takeProfit && (
            <HStack justify="space-between">
              <Text color="fg.muted">{t('common.takeProfit')}:</Text>
              <Text fontWeight="medium" color="green.500">{formatPrice(setup.takeProfit)}</Text>
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
          {kline ? formatDateTimeTooltip(kline.openTime) : ''}
        </Text>

        {kline && (
          <Stack gap={0.5}>
            <HStack justify="space-between">
              <Text color="fg.muted">Open:</Text>
              <Text fontWeight="medium">{formatPrice(getKlineOpen(kline))}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">High:</Text>
              <Text fontWeight="medium" color="green.500">
                {formatPrice(getKlineHigh(kline))}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">Low:</Text>
              <Text fontWeight="medium" color="red.500">
                {formatPrice(getKlineLow(kline))}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="fg.muted">Close:</Text>
              <Text fontWeight="medium">{formatPrice(getKlineClose(kline))}</Text>
            </HStack>
          </Stack>
        )}

        {kline && (
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
              <Text fontWeight="medium">{getKlineVolume(kline).toLocaleString()}</Text>
            </HStack>

            <HStack justify="space-between">
              <Text color="fg.muted">Quote Vol:</Text>
              <Text fontWeight="medium">${quoteVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </HStack>

            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">Trades:</Text>
              <Text fontWeight="medium">{trades.toLocaleString()}</Text>
            </HStack>

            <HStack justify="space-between">
              <Text color="fg.muted">Avg Trade:</Text>
              <Text fontWeight="medium">${avgTradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
            </HStack>

            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
              <Text color="fg.muted">Pressure:</Text>
              <HStack gap={1}>
                <Text
                  fontWeight="semibold"
                  color={
                    pressureType === 'buy'
                      ? 'green.500'
                      : pressureType === 'sell'
                        ? 'red.500'
                        : 'gray.500'
                  }
                >
                  {pressureType === 'buy' ? '🟢' : pressureType === 'sell' ? '🔴' : '⚪'}
                </Text>
                <Text fontWeight="medium">
                  {(buyPressure * 100).toFixed(0)}% Buy
                </Text>
              </HStack>
            </HStack>
          </>
        )}
      </Stack>
    </Box>
  );
};
