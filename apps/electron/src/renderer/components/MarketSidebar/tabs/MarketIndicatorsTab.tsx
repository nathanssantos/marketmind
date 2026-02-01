import { Badge, Box, Flex, Skeleton, Stack, Text } from '@chakra-ui/react';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuMinus } from 'react-icons/lu';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

const useContainerWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [hasWidth, setHasWidth] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setHasWidth(width > 10);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, hasWidth };
};

const POPULAR_FUNDING_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

const DEFAULT_HALF_INTERVAL = 2 * 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000;

const getRefreshIntervals = (halfIntervalMs: number) => ({
  fearGreed: Math.max(halfIntervalMs, 30 * 60 * 1000),
  btcDominance: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  openInterest: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  longShortRatio: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  fundingRates: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  altcoinSeason: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  adxTrendStrength: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  orderBook: Math.max(Math.floor(halfIntervalMs / 4), 60 * 1000),
});

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--chakra-colors-bg-muted)',
  border: '1px solid var(--chakra-colors-border)',
  borderRadius: '6px',
  fontSize: '11px',
} as const;

const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 };

type TooltipPayload = { payload?: { timestamp?: number } };

const formatTooltipDate = (_: unknown, payload: readonly TooltipPayload[]): string => {
  const timestamp = payload?.[0]?.payload?.timestamp;
  return timestamp ? new Date(timestamp).toLocaleDateString() : '';
};

const formatFundingRate = (rate: number | null): string => {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(4)}%`;
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

const getAltSeasonColor = (seasonType: string): string => {
  if (seasonType === 'ALT_SEASON') return 'green';
  if (seasonType === 'BTC_SEASON') return 'orange';
  return 'gray';
};

const getAdxColor = (adx: number | null): string => {
  if (adx === null) return 'gray';
  if (adx >= 25) return 'green';
  if (adx >= 20) return 'yellow';
  return 'red';
};

const getOrderBookPressureColor = (pressure: string): string => {
  if (pressure === 'BUYING') return 'green';
  if (pressure === 'SELLING') return 'red';
  return 'gray';
};

const SectionTitle = ({ children, mb = 2 }: { children: React.ReactNode; mb?: number }) => (
  <Text fontSize="sm" fontWeight="medium" mb={mb}>
    {children}
  </Text>
);

interface MiniAreaChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  color: string;
  gradientId: string;
  height?: number;
  formatter: (value: number) => string;
  label: string;
  yDomain?: [number | string, number | string];
  referenceLine?: number;
}

const MiniAreaChart = memo(({ data, dataKey, color, gradientId, height = 60, formatter, label, yDomain, referenceLine }: MiniAreaChartProps) => (
  <Box h={`${height}px`} mx={-2}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yDomain && <YAxis domain={yDomain} hide />}
        {referenceLine !== undefined && (
          <ReferenceLine y={referenceLine} stroke="var(--chakra-colors-gray-500)" strokeDasharray="3 3" strokeOpacity={0.5} />
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={formatTooltipDate}
          formatter={(value) => [formatter(value as number), label]}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  </Box>
));

const MarketIndicatorsTabComponent = () => {
  const { t } = useTranslation();
  const { ref: containerRef, hasWidth } = useContainerWidth();

  const { data: watcherInterval } = trpc.autoTrading.getMinActiveWatcherInterval.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const halfIntervalMs = watcherInterval?.halfIntervalMs ?? DEFAULT_HALF_INTERVAL;
  const REFRESH_INTERVALS = getRefreshIntervals(halfIntervalMs);

  const { data: fundingRates, isLoading: isFundingLoading } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: POPULAR_FUNDING_SYMBOLS },
    { staleTime: REFRESH_INTERVALS.fundingRates, refetchInterval: REFRESH_INTERVALS.fundingRates }
  );

  const { data: fearGreed, isLoading: isFearGreedLoading } = trpc.autoTrading.getFearGreedIndex.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.fearGreed, refetchInterval: REFRESH_INTERVALS.fearGreed }
  );

  const { data: btcDominance, isLoading: isBtcDominanceLoading } = trpc.autoTrading.getBtcDominance.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.btcDominance, refetchInterval: REFRESH_INTERVALS.btcDominance }
  );

  const { data: openInterest, isLoading: isOpenInterestLoading } = trpc.autoTrading.getOpenInterest.useQuery(
    { symbol: 'BTCUSDT' },
    { staleTime: REFRESH_INTERVALS.openInterest, refetchInterval: REFRESH_INTERVALS.openInterest }
  );

  const { data: longShortRatio, isLoading: isLongShortLoading } = trpc.autoTrading.getLongShortRatio.useQuery(
    { symbol: 'BTCUSDT', period: '1h' },
    { staleTime: REFRESH_INTERVALS.longShortRatio, refetchInterval: REFRESH_INTERVALS.longShortRatio }
  );

  const { data: altcoinSeason, isLoading: isAltcoinSeasonLoading } = trpc.autoTrading.getAltcoinSeasonIndex.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.altcoinSeason, refetchInterval: REFRESH_INTERVALS.altcoinSeason }
  );

  const { data: adxTrendStrength, isLoading: isAdxLoading } = trpc.autoTrading.getBtcAdxTrendStrength.useQuery(
    { interval: '12h' },
    { staleTime: REFRESH_INTERVALS.adxTrendStrength, refetchInterval: REFRESH_INTERVALS.adxTrendStrength }
  );

  const { data: orderBook, isLoading: isOrderBookLoading } = trpc.autoTrading.getOrderBookAnalysis.useQuery(
    { symbol: 'BTCUSDT', marketType: 'FUTURES' },
    { staleTime: REFRESH_INTERVALS.orderBook, refetchInterval: REFRESH_INTERVALS.orderBook }
  );

  return (
    <Stack gap={3} p={4} ref={containerRef}>
      <Flex align="center" gap={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('marketSidebar.indicators.title')}
        </Text>
        <Badge size="xs" variant="outline" colorPalette="gray">31d</Badge>
      </Flex>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>{t('marketSidebar.indicators.fearGreed')}</SectionTitle>
        {fearGreed?.current && (
          <Flex gap={2} mb={2}>
            <Badge colorPalette={getFearGreedColor(fearGreed.current.value)} size="xs" px={2}>
              {fearGreed.current.value} - {fearGreed.current.valueClassification}
            </Badge>
          </Flex>
        )}

        {isFearGreedLoading || !hasWidth ? (
          <Skeleton height="80px" />
        ) : fearGreed?.history && fearGreed.history.length > 0 ? (
          <Box h="80px" mx={-2}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fearGreed.history} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--chakra-colors-${getFearGreedColor(fearGreed.current?.value ?? 50)}-500)`} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={`var(--chakra-colors-${getFearGreedColor(fearGreed.current?.value ?? 50)}-500)`} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[0, 100]} hide />
                <ReferenceLine y={50} stroke="var(--chakra-colors-gray-500)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={formatTooltipDate}
                  formatter={(value) => [value, 'Fear & Greed']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={`var(--chakra-colors-${getFearGreedColor(fearGreed.current?.value ?? 50)}-500)`}
                  strokeWidth={2}
                  fill="url(#fearGreedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>{t('marketSidebar.indicators.btcDominance')}</SectionTitle>
        {btcDominance && btcDominance.current !== null && (
          <Flex align="center" gap={2} mb={2}>
            <Badge colorPalette="orange" size="xs" px={2}>{btcDominance.current.toFixed(1)}%</Badge>
            {btcDominance.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={btcDominance.change24h >= 0 ? 'green' : 'red'}>
                24h: {btcDominance.change24h >= 0 ? '+' : ''}{btcDominance.change24h.toFixed(2)}%
              </Badge>
            )}
          </Flex>
        )}
        {isBtcDominanceLoading || !hasWidth ? (
          <Skeleton height="60px" />
        ) : btcDominance?.history && btcDominance.history.length > 0 ? (
          <MiniAreaChart
            data={btcDominance.history}
            dataKey="dominance"
            color="var(--chakra-colors-orange-500)"
            gradientId="dominanceGradient"
            formatter={(v) => `${v.toFixed(2)}%`}
            label="Dominance"
          />
        ) : !btcDominance || btcDominance.current === null ? (
          <Text fontSize="xs" color="fg.muted">-</Text>
        ) : null}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>{t('marketSidebar.indicators.openInterest')}</SectionTitle>
        {openInterest && openInterest.current !== null && (
          <Flex align="center" gap={2} mb={2}>
            <Badge colorPalette="blue" size="xs" px={2}>{formatLargeNumber(openInterest.current)}</Badge>
            {openInterest.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={openInterest.change24h >= 0 ? 'green' : 'red'}>
                24h: {openInterest.change24h >= 0 ? '+' : ''}{openInterest.change24h.toFixed(1)}%
              </Badge>
            )}
          </Flex>
        )}
        {isOpenInterestLoading || !hasWidth ? (
          <Skeleton height="60px" />
        ) : openInterest?.history && openInterest.history.length > 0 ? (
          <MiniAreaChart
            data={openInterest.history}
            dataKey="value"
            color="var(--chakra-colors-blue-500)"
            gradientId="oiGradient"
            formatter={formatLargeNumber}
            label="OI"
          />
        ) : (
          <Text fontSize="xs" color="fg.muted">-</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>{t('marketSidebar.indicators.longShortRatio')} (BTC)</SectionTitle>
        {longShortRatio?.global && (
          <Flex align="center" gap={2} mb={2}>
            <Badge size="xs" px={2} colorPalette="green">Long: {(longShortRatio.global.longAccount * 100).toFixed(0)}%</Badge>
            <Badge size="xs" px={2} colorPalette="red">Short: {(longShortRatio.global.shortAccount * 100).toFixed(0)}%</Badge>
          </Flex>
        )}
        {isLongShortLoading || !hasWidth ? (
          <Skeleton height="60px" />
        ) : longShortRatio?.globalHistory && longShortRatio.globalHistory.length > 0 ? (
          <MiniAreaChart
            data={longShortRatio.globalHistory}
            dataKey="longAccount"
            color="var(--chakra-colors-green-500)"
            gradientId="lsGradient"
            formatter={(v) => `${(v * 100).toFixed(1)}%`}
            label="Long"
            yDomain={[0, 1]}
            referenceLine={0.5}
          />
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
        {longShortRatio?.topTraders && (
          <Text fontSize="2xs" color="fg.muted" mt={1}>
            {t('marketSidebar.indicators.topTraders')}: {(longShortRatio.topTraders.longAccount * 100).toFixed(1)}% / {(longShortRatio.topTraders.shortAccount * 100).toFixed(1)}%
          </Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>Altcoin Season Index</SectionTitle>
        {altcoinSeason && (
          <Flex align="center" gap={2} mb={2} flexWrap="wrap">
            <Badge colorPalette={getAltSeasonColor(altcoinSeason.seasonType)} size="xs" px={2}>
              {altcoinSeason.seasonType === 'ALT_SEASON' ? '🚀 Alt Season' :
               altcoinSeason.seasonType === 'BTC_SEASON' ? '🪙 BTC Season' : '⚖️ Neutral'}
            </Badge>
            <Badge colorPalette="gray" size="xs" px={2}>
              Index: {altcoinSeason.altSeasonIndex.toFixed(0)}%
            </Badge>
            {altcoinSeason.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={altcoinSeason.change24h >= 0 ? 'green' : 'red'}>
                24h: {altcoinSeason.change24h >= 0 ? '+' : ''}{altcoinSeason.change24h.toFixed(1)}
              </Badge>
            )}
          </Flex>
        )}
        {isAltcoinSeasonLoading || !hasWidth ? (
          <Skeleton height="60px" />
        ) : altcoinSeason?.history && altcoinSeason.history.length > 0 ? (
          <MiniAreaChart
            data={altcoinSeason.history}
            dataKey="value"
            color={`var(--chakra-colors-${getAltSeasonColor(altcoinSeason.seasonType)}-500)`}
            gradientId="altSeasonGradient"
            formatter={(v) => `${v.toFixed(0)}%`}
            label="Index"
            yDomain={[0, 100]}
            referenceLine={50}
          />
        ) : altcoinSeason ? (
          <>
            <Flex justify="space-between" fontSize="2xs" color="fg.muted">
              <Text>Alts {">"} BTC: {altcoinSeason.altsOutperformingBtc}/{altcoinSeason.totalAltsAnalyzed}</Text>
              <Text>BTC 24h: {altcoinSeason.btcPerformance24h >= 0 ? '+' : ''}{altcoinSeason.btcPerformance24h.toFixed(2)}%</Text>
            </Flex>
            {altcoinSeason.topPerformers.length > 0 && (
              <Text fontSize="2xs" color="fg.muted" mt={1}>
                Top: {altcoinSeason.topPerformers.slice(0, 3).map(p => `${p.symbol.replace('USDT', '')} +${p.performance.toFixed(1)}%`).join(', ')}
              </Text>
            )}
          </>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>ADX Trend Strength (BTC)</SectionTitle>
        {adxTrendStrength && (
          <Flex align="center" gap={2} mb={2} flexWrap="wrap">
            <Badge colorPalette={getAdxColor(adxTrendStrength.adx)} size="xs" px={2}>
              ADX: {adxTrendStrength.adx?.toFixed(1) ?? 'N/A'}
            </Badge>
            {adxTrendStrength.isChoppy ? (
              <Badge colorPalette="red" size="xs" px={2}>⚠️ Choppy Market</Badge>
            ) : adxTrendStrength.isStrongTrend ? (
              <Badge colorPalette="green" size="xs" px={2}>✅ Strong Trend</Badge>
            ) : (
              <Badge colorPalette="yellow" size="xs" px={2}>Weak Trend</Badge>
            )}
            {adxTrendStrength.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={adxTrendStrength.change24h >= 0 ? 'green' : 'red'}>
                24h: {adxTrendStrength.change24h >= 0 ? '+' : ''}{adxTrendStrength.change24h.toFixed(1)}
              </Badge>
            )}
          </Flex>
        )}
        {isAdxLoading || !hasWidth ? (
          <Skeleton height="60px" />
        ) : adxTrendStrength?.history && adxTrendStrength.history.length > 0 ? (
          <MiniAreaChart
            data={adxTrendStrength.history}
            dataKey="value"
            color={`var(--chakra-colors-${getAdxColor(adxTrendStrength.adx)}-500)`}
            gradientId="adxGradient"
            formatter={(v) => v.toFixed(1)}
            label="ADX"
            yDomain={[0, 100]}
            referenceLine={20}
          />
        ) : adxTrendStrength ? (
          <Flex justify="space-between" fontSize="2xs" color="fg.muted">
            <Text>+DI: {adxTrendStrength.plusDI?.toFixed(1) ?? 'N/A'}</Text>
            <Text>-DI: {adxTrendStrength.minusDI?.toFixed(1) ?? 'N/A'}</Text>
            <Text>{adxTrendStrength.isBullish ? '📈 Bullish' : adxTrendStrength.isBearish ? '📉 Bearish' : '➡️ Neutral'}</Text>
          </Flex>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>Order Book (BTC)</SectionTitle>
        {isOrderBookLoading ? (
          <Skeleton height="60px" />
        ) : orderBook ? (
          <>
            <Flex align="center" gap={2} mb={2} flexWrap="wrap">
              <Badge colorPalette={getOrderBookPressureColor(orderBook.pressure)} size="xs" px={2}>
                {orderBook.pressure === 'BUYING' ? '📈 Buying Pressure' :
                 orderBook.pressure === 'SELLING' ? '📉 Selling Pressure' : '➡️ Neutral'}
              </Badge>
              <Badge colorPalette="gray" size="xs" px={2}>
                Ratio: {orderBook.imbalanceRatio.toFixed(2)}
              </Badge>
            </Flex>
            <Flex justify="space-between" fontSize="2xs" color="fg.muted">
              <Text>Bids: ${formatLargeNumber(orderBook.bidVolume)}</Text>
              <Text>Asks: ${formatLargeNumber(orderBook.askVolume)}</Text>
              <Text>Spread: {orderBook.spreadPercent.toFixed(4)}%</Text>
            </Flex>
            {(orderBook.bidWalls.length > 0 || orderBook.askWalls.length > 0) && (
              <Text fontSize="2xs" color="fg.muted" mt={1}>
                Walls: {orderBook.bidWalls.length} bid / {orderBook.askWalls.length} ask
              </Text>
            )}
          </>
        ) : (
          <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
        )}
      </Box>

      <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
        <SectionTitle>{t('marketSidebar.indicators.fundingRates')}</SectionTitle>

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
