import { Badge, Box, Flex, Progress, Skeleton, Stack, Text } from '@chakra-ui/react';
import type { TimeInterval } from '@marketmind/types';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { trpc } from '@renderer/utils/trpc';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuMinus, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';

const POPULAR_FUNDING_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
const TIMEFRAME_OPTIONS: TimeInterval[] = ['1h', '4h', '1d'];

const formatFundingRate = (rate: number | null): string => {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(4)}%`;
};

const formatPrice = (price: number): string => {
  if (price >= 10000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 100) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatLargeNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

const getFearGreedColor = (value: number): string => {
  if (value <= 25) return 'red';
  if (value <= 45) return 'orange';
  if (value <= 55) return 'gray';
  if (value <= 75) return 'green';
  return 'green';
};

const MarketIndicatorsTabComponent = () => {
  const { t } = useTranslation();
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeInterval>('1h');

  const { data: btcTrendStatus, isLoading: isBtcTrendLoading } = trpc.autoTrading.getBtcTrendStatus.useQuery(
    { interval: selectedTimeframe },
    { staleTime: 60000, refetchInterval: 60000 }
  );

  const { data: fundingRates, isLoading: isFundingLoading } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: POPULAR_FUNDING_SYMBOLS },
    { staleTime: 60000, refetchInterval: 60000 }
  );

  const { data: fearGreed, isLoading: isFearGreedLoading } = trpc.autoTrading.getFearGreedIndex.useQuery(
    undefined,
    { staleTime: 300000, refetchInterval: 300000 }
  );

  const { data: btcDominance, isLoading: isBtcDominanceLoading } = trpc.autoTrading.getBtcDominance.useQuery(
    undefined,
    { staleTime: 120000, refetchInterval: 120000 }
  );

  const { data: openInterest, isLoading: isOpenInterestLoading } = trpc.autoTrading.getOpenInterest.useQuery(
    { symbol: 'BTCUSDT' },
    { staleTime: 60000, refetchInterval: 60000 }
  );

  const { data: longShortRatio, isLoading: isLongShortLoading } = trpc.autoTrading.getLongShortRatio.useQuery(
    { symbol: 'BTCUSDT', period: '1h' },
    { staleTime: 60000, refetchInterval: 60000 }
  );

  const trendColor = btcTrendStatus?.trend === 'BULLISH' ? 'green' : btcTrendStatus?.trend === 'BEARISH' ? 'red' : 'gray';
  const TrendIcon = btcTrendStatus?.trend === 'BULLISH' ? LuTrendingUp : btcTrendStatus?.trend === 'BEARISH' ? LuTrendingDown : LuMinus;

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="bold">
          {t('marketSidebar.indicators.title')}
        </Text>
        <Flex gap={1}>
          {TIMEFRAME_OPTIONS.map((tf) => (
            <Badge
              key={tf}
              size="xs"
              px={2}
              cursor="pointer"
              colorPalette={selectedTimeframe === tf ? 'blue' : 'gray'}
              variant={selectedTimeframe === tf ? 'solid' : 'outline'}
              onClick={() => setSelectedTimeframe(tf)}
            >
              {tf}
            </Badge>
          ))}
        </Flex>
      </Flex>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          {t('marketSidebar.indicators.fearGreed')}
        </Text>

        {isFearGreedLoading ? (
          <Skeleton height="60px" />
        ) : fearGreed?.current ? (
          <Stack gap={2}>
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={2}>
                <Box
                  w="40px"
                  h="40px"
                  borderRadius="full"
                  bg={`${getFearGreedColor(fearGreed.current.value)}.100`}
                  _dark={{ bg: `${getFearGreedColor(fearGreed.current.value)}.900` }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize="md"
                    fontWeight="bold"
                    color={`${getFearGreedColor(fearGreed.current.value)}.600`}
                    _dark={{ color: `${getFearGreedColor(fearGreed.current.value)}.300` }}
                  >
                    {fearGreed.current.value}
                  </Text>
                </Box>
                <Stack gap={0}>
                  <Text fontSize="sm" fontWeight="medium">
                    {fearGreed.current.valueClassification}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    {t('marketSidebar.indicators.today')}
                  </Text>
                </Stack>
              </Flex>
              {fearGreed.yesterday && (
                <Stack gap={0} textAlign="right">
                  <Text fontSize="xs" color="fg.muted">
                    {t('marketSidebar.indicators.yesterday')}: {fearGreed.yesterday.value}
                  </Text>
                  {fearGreed.lastWeek && (
                    <Text fontSize="2xs" color="fg.muted">
                      {t('marketSidebar.indicators.lastWeek')}: {fearGreed.lastWeek.value}
                    </Text>
                  )}
                </Stack>
              )}
            </Flex>
            <Progress.Root value={fearGreed.current.value} max={100} size="xs">
              <Progress.Track>
                <Progress.Range
                  bg={`${getFearGreedColor(fearGreed.current.value)}.500`}
                />
              </Progress.Track>
            </Progress.Root>
          </Stack>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Flex gap={3} wrap="wrap">
        <Box flex={1} minW="140px" p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" color="fg.muted" mb={1}>
            {t('marketSidebar.indicators.btcDominance')}
          </Text>
          {isBtcDominanceLoading ? (
            <Skeleton height="24px" />
          ) : btcDominance && btcDominance.current !== null ? (
            <Flex align="center" gap={1}>
              <Text fontSize="lg" fontWeight="bold">
                {btcDominance.current.toFixed(1)}%
              </Text>
              {btcDominance.change24h !== null && (
                <Badge
                  size="xs"
                  px={2}
                  colorPalette={btcDominance.change24h >= 0 ? 'green' : 'red'}
                >
                  {btcDominance.change24h >= 0 ? '+' : ''}{btcDominance.change24h.toFixed(2)}%
                </Badge>
              )}
            </Flex>
          ) : (
            <Text fontSize="xs" color="fg.muted">-</Text>
          )}
        </Box>

        <Box flex={1} minW="140px" p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" color="fg.muted" mb={1}>
            {t('marketSidebar.indicators.openInterest')}
          </Text>
          {isOpenInterestLoading ? (
            <Skeleton height="24px" />
          ) : openInterest && openInterest.current !== null ? (
            <Flex align="center" gap={1}>
              <Text fontSize="lg" fontWeight="bold">
                {formatLargeNumber(openInterest.current)}
              </Text>
              {openInterest.change24h !== null && (
                <Badge
                  size="xs"
                  px={2}
                  colorPalette={openInterest.change24h >= 0 ? 'green' : 'red'}
                >
                  {openInterest.change24h >= 0 ? '+' : ''}{openInterest.change24h.toFixed(1)}%
                </Badge>
              )}
            </Flex>
          ) : (
            <Text fontSize="xs" color="fg.muted">-</Text>
          )}
        </Box>
      </Flex>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <Text fontSize="xs" color="fg.muted" mb={2}>
          {t('marketSidebar.indicators.longShortRatio')} (BTC)
        </Text>
        {isLongShortLoading ? (
          <Skeleton height="40px" />
        ) : longShortRatio?.global ? (
          <Stack gap={2}>
            <Flex justify="space-between" align="center">
              <Flex align="center" gap={1}>
                <Box w="8px" h="8px" borderRadius="full" bg="green.500" />
                <Text fontSize="sm" fontWeight="medium" color="green.600" _dark={{ color: 'green.400' }}>
                  {(longShortRatio.global.longAccount * 100).toFixed(1)}% Long
                </Text>
              </Flex>
              <Flex align="center" gap={1}>
                <Text fontSize="sm" fontWeight="medium" color="red.600" _dark={{ color: 'red.400' }}>
                  {(longShortRatio.global.shortAccount * 100).toFixed(1)}% Short
                </Text>
                <Box w="8px" h="8px" borderRadius="full" bg="red.500" />
              </Flex>
            </Flex>
            <Box h="6px" bg="gray.200" borderRadius="full" overflow="hidden" _dark={{ bg: 'gray.700' }}>
              <Box
                h="full"
                w={`${longShortRatio.global.longAccount * 100}%`}
                bg="green.500"
              />
            </Box>
            {longShortRatio.topTraders && (
              <Text fontSize="2xs" color="fg.muted">
                {t('marketSidebar.indicators.topTraders')}: {(longShortRatio.topTraders.longAccount * 100).toFixed(1)}% / {(longShortRatio.topTraders.shortAccount * 100).toFixed(1)}%
              </Text>
            )}
          </Stack>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <Flex align="center" gap={2} mb={2}>
          <CryptoIcon symbol="BTCUSDT" size={18} />
          <Text fontSize="sm" fontWeight="medium">BTC EMA21 Trend</Text>
        </Flex>

        {isBtcTrendLoading ? (
          <Stack gap={2}>
            <Skeleton height="24px" />
            <Skeleton height="16px" />
          </Stack>
        ) : btcTrendStatus ? (
          <Stack gap={2}>
            <Flex align="center" gap={2}>
              <Box
                px={2}
                py={1}
                bg={`${trendColor}.100`}
                borderRadius="md"
                _dark={{ bg: `${trendColor}.900` }}
              >
                <Flex align="center" gap={1}>
                  <TrendIcon size={14} />
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color={`${trendColor}.700`}
                    _dark={{ color: `${trendColor}.200` }}
                  >
                    {btcTrendStatus.trend}
                  </Text>
                </Flex>
              </Box>
              {!btcTrendStatus.canLong && (
                <Badge colorPalette="red" size="xs" px={2}>LONG blocked</Badge>
              )}
              {!btcTrendStatus.canShort && (
                <Badge colorPalette="red" size="xs" px={2}>SHORT blocked</Badge>
              )}
            </Flex>

            {btcTrendStatus.btcPrice !== null && btcTrendStatus.btcEma21 !== null && (
              <>
                <Flex justify="space-between" fontSize="xs" color="fg.muted">
                  <Text>Price: ${formatPrice(btcTrendStatus.btcPrice)}</Text>
                  <Text>EMA21: ${formatPrice(btcTrendStatus.btcEma21)}</Text>
                </Flex>

                <Box h="4px" bg="gray.200" borderRadius="full" overflow="hidden" _dark={{ bg: 'gray.700' }}>
                  <Box
                    h="full"
                    w={`${Math.min(100, Math.max(0, ((btcTrendStatus.btcPrice - btcTrendStatus.btcEma21) / btcTrendStatus.btcEma21 * 100 + 5) * 10))}%`}
                    bg={trendColor === 'green' ? 'green.500' : trendColor === 'red' ? 'red.500' : 'gray.400'}
                    transition="width 0.3s"
                  />
                </Box>
              </>
            )}
          </Stack>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <Text fontSize="sm" fontWeight="medium" mb={3}>
          {t('marketSidebar.indicators.fundingRates')}
        </Text>

        {isFundingLoading ? (
          <Stack gap={2}>
            {POPULAR_FUNDING_SYMBOLS.map((symbol) => (
              <Skeleton key={symbol} height="28px" />
            ))}
          </Stack>
        ) : fundingRates && fundingRates.length > 0 ? (
          <Stack gap={2}>
            {fundingRates.map((fr) => {
              const isPositive = fr.rate !== null && fr.rate > 0;
              const isNegative = fr.rate !== null && fr.rate < 0;
              const RateIcon = isPositive ? LuArrowUp : isNegative ? LuArrowDown : LuMinus;
              const rateColor = isPositive ? 'green' : isNegative ? 'red' : 'gray';

              return (
                <Flex key={fr.symbol} justify="space-between" align="center" py={1}>
                  <Flex align="center" gap={2}>
                    <CryptoIcon symbol={fr.symbol} size={16} />
                    <Text fontSize="xs" fontWeight="medium">
                      {fr.symbol.replace('USDT', '')}
                    </Text>
                  </Flex>
                  <Flex align="center" gap={1}>
                    {fr.isExtreme && (
                      <Badge colorPalette="orange" size="xs" px={2} mr={1}>!</Badge>
                    )}
                    <RateIcon size={12} color={`var(--chakra-colors-${rateColor}-500)`} />
                    <Text
                      fontSize="xs"
                      fontWeight="medium"
                      color={`${rateColor}.600`}
                      _dark={{ color: `${rateColor}.400` }}
                    >
                      {formatFundingRate(fr.rate)}
                    </Text>
                  </Flex>
                </Flex>
              );
            })}
          </Stack>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}

        <Text fontSize="2xs" color="fg.muted" mt={2}>
          Positive = longs pay shorts | Negative = shorts pay longs
        </Text>
      </Box>
    </Stack>
  );
};

export const MarketIndicatorsTab = memo(MarketIndicatorsTabComponent);
