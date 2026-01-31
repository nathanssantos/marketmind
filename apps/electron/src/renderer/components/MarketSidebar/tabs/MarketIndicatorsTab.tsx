import { Badge, Box, Flex, Skeleton, Stack, Text } from '@chakra-ui/react';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuMinus, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { Area, AreaChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

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
const REFRESH_INTERVALS = {
  fearGreed: 30 * 60 * 1000,
  btcDominance: 10 * 60 * 1000,
  openInterest: 5 * 60 * 1000,
  longShortRatio: 5 * 60 * 1000,
  fundingRates: 10 * 60 * 1000,
} as const;

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

interface MiniLineChartProps {
  data: Array<Record<string, unknown>>;
  lines: Array<{ dataKey: string; color: string; strokeWidth?: number; dashed?: boolean }>;
  height?: number;
  formatter: (value: number) => string;
}

const MiniLineChart = memo(({ data, lines, height = 80, formatter }: MiniLineChartProps) => (
  <Box h={`${height}px`} mx={-2}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={formatTooltipDate}
          formatter={(value) => [formatter(value as number), '']}
        />
        {lines.map(({ dataKey, color, strokeWidth = 2, dashed }) => (
          <Line
            key={dataKey}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            strokeDasharray={dashed ? '4 2' : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </Box>
));

const MarketIndicatorsTabComponent = () => {
  const { t } = useTranslation();
  const { ref: containerRef, hasWidth } = useContainerWidth();

  const { data: btcTrendStatus, isLoading: isBtcTrendLoading } = trpc.autoTrading.getBtcTrendStatus.useQuery(
    { interval: '1d' },
    { staleTime: REFRESH_INTERVALS.btcDominance, refetchInterval: REFRESH_INTERVALS.btcDominance }
  );

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

  const trendColor = btcTrendStatus?.trend === 'BULLISH' ? 'green' : btcTrendStatus?.trend === 'BEARISH' ? 'red' : 'gray';
  const TrendIcon = btcTrendStatus?.trend === 'BULLISH' ? LuTrendingUp : btcTrendStatus?.trend === 'BEARISH' ? LuTrendingDown : LuMinus;

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
        <Flex align="center" gap={2} mb={2}>
          <CryptoIcon symbol="BTCUSDT" size={18} />
          <Text fontSize="sm" fontWeight="medium">BTC EMA21 (1d)</Text>
        </Flex>
        {btcTrendStatus && (
          <Flex align="center" gap={2} mb={2}>
            <Badge colorPalette={trendColor} size="xs" px={2}>
              <Flex align="center" gap={1}>
                <TrendIcon size={10} />
                {btcTrendStatus.trend}
              </Flex>
            </Badge>
            {!btcTrendStatus.canLong && <Badge colorPalette="red" size="xs" px={2}>No Long</Badge>}
            {!btcTrendStatus.canShort && <Badge colorPalette="red" size="xs" px={2}>No Short</Badge>}
          </Flex>
        )}

        {isBtcTrendLoading || !hasWidth ? (
          <Skeleton height="80px" />
        ) : btcTrendStatus?.history && btcTrendStatus.history.length > 0 ? (
          <MiniLineChart
            data={btcTrendStatus.history}
            lines={[
              { dataKey: 'ema21', color: 'var(--chakra-colors-blue-500)', strokeWidth: 2 },
              { dataKey: 'price', color: 'var(--chakra-colors-gray-400)', strokeWidth: 1.5, dashed: true },
            ]}
            formatter={(v) => `$${formatPrice(v)}`}
          />
        ) : btcTrendStatus ? (
          <Flex justify="space-between" fontSize="xs" color="fg.muted">
            <Text>Price: ${btcTrendStatus.btcPrice ? formatPrice(btcTrendStatus.btcPrice) : '-'}</Text>
            <Text>EMA21: ${btcTrendStatus.btcEma21 ? formatPrice(btcTrendStatus.btcEma21) : '-'}</Text>
          </Flex>
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
