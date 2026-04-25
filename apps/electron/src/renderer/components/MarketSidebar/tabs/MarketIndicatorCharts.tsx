import { Badge, Skeleton } from '@renderer/components/ui';
import { Box, Flex, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  CHART_MARGIN,
  FEAR_GREED_LEVELS,
  TOOLTIP_STYLE,
  formatLargeNumber,
  formatTooltipDate,
  formatUsd,
  getFearGreedColor,
  getMvrvColor,
} from './marketIndicatorUtils';

export const SectionTitle = ({ children, mb = 2 }: { children: React.ReactNode; mb?: number }) => (
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

export const MiniAreaChart = memo(({ data, dataKey, color, gradientId, height = 60, formatter, label, yDomain, referenceLine }: MiniAreaChartProps) => (
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

interface FearGreedSectionProps {
  fearGreed: { current?: { value: number; valueClassification: string } | null; history?: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const FearGreedSection = ({ fearGreed, isLoading, hasWidth }: FearGreedSectionProps) => {
  const { t } = useTranslation();
  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <SectionTitle>{t('marketSidebar.indicators.fearGreed')}</SectionTitle>
      {fearGreed?.current && (
        <Flex gap={2} mb={2}>
          <Badge colorPalette={getFearGreedColor(fearGreed.current.value)} size="xs" px={2}>
            {fearGreed.current.value} - {fearGreed.current.valueClassification}
          </Badge>
        </Flex>
      )}
      {isLoading || !hasWidth ? (
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
              {FEAR_GREED_LEVELS.slice(0, -1).map((level) => (
                <ReferenceLine
                  key={level.max}
                  y={level.max}
                  stroke={`var(--chakra-colors-${level.color}-500)`}
                  strokeDasharray="3 3"
                  strokeOpacity={0.35}
                />
              ))}
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
  );
};

interface BtcDominanceSectionProps {
  btcDominance: { current: number | null; change24h: number | null; history?: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const BtcDominanceSection = ({ btcDominance, isLoading, hasWidth }: BtcDominanceSectionProps) => {
  const { t } = useTranslation();
  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <SectionTitle>{t('marketSidebar.indicators.btcDominance')}</SectionTitle>
      {/* eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit guard required: x?.foo !== null is true when x is undefined, narrowing fails inside JSX block */}
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
      {isLoading || !hasWidth ? (
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
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- !x || x.foo === null catches both undefined and null cases; ?.foo === null only catches null
      ) : !btcDominance || btcDominance.current === null ? (
        <Text fontSize="xs" color="fg.muted">-</Text>
      ) : null}
    </Box>
  );
};

interface MvrvSectionProps {
  mvrv: { current: number | null; history?: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const MvrvSection = ({ mvrv, isLoading, hasWidth }: MvrvSectionProps) => {
  const { t } = useTranslation();
  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <SectionTitle>{t('marketSidebar.indicators.mvrv')}</SectionTitle>
      {/* eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit guard required: x?.foo !== null is true when x is undefined */}
      {mvrv && mvrv.current !== null && (
        <Flex align="center" gap={2} mb={2}>
          <Badge colorPalette={getMvrvColor(mvrv.current)} size="xs" px={2}>
            {mvrv.current.toFixed(2)}
          </Badge>
          <Badge colorPalette="gray" size="xs" px={2}>
            {mvrv.current >= 3.5 ? 'Overheated' : mvrv.current >= 1 ? 'Above Realized' : 'Below Realized'}
          </Badge>
        </Flex>
      )}
      {isLoading || !hasWidth ? (
        <Skeleton height="60px" />
      ) : mvrv?.history && mvrv.history.length > 0 ? (
        <MiniAreaChart
          data={mvrv.history}
          dataKey="value"
          color={`var(--chakra-colors-${getMvrvColor(mvrv.current)}-500)`}
          gradientId="mvrvGradient"
          formatter={(v) => v.toFixed(2)}
          label="MVRV"
          referenceLine={1}
        />
      ) : (
        <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
      )}
    </Box>
  );
};

interface ProductionCostSectionProps {
  btcProductionCost: { currentCost: number | null; currentPrice: number | null; history?: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const ProductionCostSection = ({ btcProductionCost, isLoading, hasWidth }: ProductionCostSectionProps) => {
  const { t } = useTranslation();
  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <SectionTitle>{t('marketSidebar.indicators.btcProductionCost')}</SectionTitle>
      {/* eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit guard required: x?.foo !== null is true when x is undefined */}
      {btcProductionCost && btcProductionCost.currentCost !== null && btcProductionCost.currentPrice !== null && (
        <Flex align="center" gap={2} mb={2} flexWrap="wrap">
          <Badge colorPalette="orange" size="xs" px={2}>
            Cost: {formatUsd(btcProductionCost.currentCost)}
          </Badge>
          <Badge colorPalette="blue" size="xs" px={2}>
            Price: {formatUsd(btcProductionCost.currentPrice)}
          </Badge>
          <Badge colorPalette={btcProductionCost.currentPrice >= btcProductionCost.currentCost ? 'green' : 'red'} size="xs" px={2}>
            {btcProductionCost.currentPrice >= btcProductionCost.currentCost ? 'Above Cost' : 'Below Cost'}
          </Badge>
        </Flex>
      )}
      {isLoading || !hasWidth ? (
        <Skeleton height="60px" />
      ) : btcProductionCost?.history && btcProductionCost.history.length > 0 ? (
        <Box h="60px" mx={-2}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={btcProductionCost.history} margin={CHART_MARGIN}>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={formatTooltipDate}
                formatter={(value) => [formatUsd(value as number), '']}
              />
              <Line type="monotone" dataKey="productionCost" stroke="var(--chakra-colors-orange-500)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="btcPrice" stroke="var(--chakra-colors-blue-500)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>
      )}
    </Box>
  );
};

interface OpenInterestSectionProps {
  openInterest: { current: number | null; change24h: number | null; history?: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const OpenInterestSection = ({ openInterest, isLoading, hasWidth }: OpenInterestSectionProps) => (
  <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
    <SectionTitle>Open Interest (BTC)</SectionTitle>
    {/* eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit guard required: x?.foo !== null is true when x is undefined */}
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
    {isLoading || !hasWidth ? (
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
);

interface LongShortSectionProps {
  longShortRatio: { global?: { longAccount: number; shortAccount: number } | null; globalHistory?: Array<Record<string, unknown>>; topTraders?: { longAccount: number; shortAccount: number } | null; [key: string]: unknown } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const LongShortSection = ({ longShortRatio, isLoading, hasWidth }: LongShortSectionProps) => {
  const { t } = useTranslation();
  return (
    <Box p={3} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <SectionTitle>{t('marketSidebar.indicators.longShortRatio')} (BTC)</SectionTitle>
      {longShortRatio?.global && (
        <Flex align="center" gap={2} mb={2}>
          <Badge size="xs" px={2} colorPalette="green">Long: {(longShortRatio.global.longAccount * 100).toFixed(0)}%</Badge>
          <Badge size="xs" px={2} colorPalette="red">Short: {(longShortRatio.global.shortAccount * 100).toFixed(0)}%</Badge>
        </Flex>
      )}
      {isLoading || !hasWidth ? (
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
  );
};
