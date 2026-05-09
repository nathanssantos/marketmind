import { Box, HStack, Stack, Text, useToken } from '@chakra-ui/react';
import { Callout, LoadingSpinner, PanelHeader, RecordRow } from '@renderer/components/ui';
import { useBackendAnalytics } from '@renderer/hooks/useBackendAnalytics';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface EquityCurveChartProps {
  walletId: string;
  currency: string;
}

type SeriesKey = 'pnl' | 'fees' | 'funding';

export const EquityCurveChart = memo(({ walletId, currency }: EquityCurveChartProps) => {
  const { t } = useTranslation();
  const { wallets } = useActiveWallet();
  const backendWallet = wallets.find((w) => w.id === walletId);
  const { equityCurve, isLoadingEquityCurve } = useBackendAnalytics(walletId, 'all');
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    pnl: true,
    fees: true,
    funding: true,
  });

  // useToken returns (string | undefined)[] — useToken.ts in Chakra has
  // an overload that types correctly for tuples but TypeScript doesn't
  // resolve it through array destructuring. Coerce locally; tokens we
  // ask for are guaranteed to exist (they're declared in
  // @marketmind/tokens/semanticTokens.ts).
  const [
    chartPrimary,
    chartGrid,
    chartTextMuted,
    chartProfit,
    chartLoss,
    chartWarning,
    chartMutedFg,
  ] = useToken('colors', [
    'chart.line.default',
    'chart.grid',
    'chart.axis.label',
    'trading.profit',
    'trading.loss',
    'trading.warning',
    'fg.muted',
  ]);

  const initialCapital = useMemo(() => {
    if (!backendWallet) return 0;
    return parseFloat(backendWallet.initialBalance ?? '0');
  }, [backendWallet]);

  // Breakeven at each timestamp = initialBalance + cumulativeNetTransfers(t).
  // This is "what the wallet would be if you only deposited/withdrew, never
  // traded". Equity above this = real profit AFTER fees + funding.
  // Equity below = real loss even if PnL appeared positive.
  const chartData = useMemo(
    () =>
      equityCurve.map((point) => {
        const transfers = (point as { cumulativeNetTransfers?: number }).cumulativeNetTransfers ?? 0;
        const cumulativePnl = (point as { cumulativePnl?: number }).cumulativePnl ?? 0;
        const cumulativeFees = (point as { cumulativeFees?: number }).cumulativeFees ?? 0;
        const cumulativeFunding = (point as { cumulativeFunding?: number }).cumulativeFunding ?? 0;
        const breakeven = initialCapital + transfers;
        return {
          time: new Date(point.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          rawTime: point.timestamp,
          equity: point.balance,
          breakeven,
          // Cumulative-since-creation overlays. Fees stored negative on
          // Binance; flip sign so the line trends downward visually as
          // a cost (red, growing). Funding can be either direction so
          // we keep the raw signed value.
          cumulativePnl,
          cumulativeFees: -cumulativeFees,
          cumulativeFunding,
          // Real profit at this timestamp — what survived after every
          // cost. Useful for tooltip summary even if we don't plot it
          // directly (it's just equity - breakeven).
          realProfit: point.balance - breakeven,
        };
      }),
    [equityCurve, initialCapital]
  );

  const formatCurrency = (value: number, showSign = false) => {
    const sign = showSign && value >= 0 ? '+' : '';
    return `${sign}${currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number, showSign = true) => {
    const sign = showSign && value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        time: string;
        equity: number;
        breakeven: number;
        cumulativePnl: number;
        cumulativeFees: number;
        cumulativeFunding: number;
        realProfit: number;
      };
    }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    const realProfitPercent = p.breakeven > 0 ? (p.realProfit / p.breakeven) * 100 : 0;
    return (
      <RecordRow tone="panel">
        <Text fontSize="xs" fontWeight="medium" mb={1}>
          {p.time}
        </Text>
        <Stack gap={0.5} fontSize="2xs">
          <Text style={{ color: chartPrimary }}>
            {t('trading.wallets.equity')}: {formatCurrency(p.equity)}
          </Text>
          <Text style={{ color: chartMutedFg }}>
            {t('analytics.breakeven')}: {formatCurrency(p.breakeven)}
          </Text>
          <Text color={p.realProfit >= 0 ? 'trading.profit' : 'trading.loss'}>
            {t('analytics.realProfit')}: {formatCurrency(p.realProfit, true)} (
            {formatPercent(realProfitPercent)})
          </Text>
          {visibleSeries.pnl && (
            <Text style={{ color: chartProfit }}>
              {t('analytics.cumulativePnl')}: {formatCurrency(p.cumulativePnl, true)}
            </Text>
          )}
          {visibleSeries.fees && (
            <Text style={{ color: chartLoss }}>
              {t('analytics.cumulativeFees')}: {formatCurrency(p.cumulativeFees, true)}
            </Text>
          )}
          {visibleSeries.funding && (
            <Text style={{ color: chartWarning }}>
              {t('analytics.cumulativeFunding')}: {formatCurrency(p.cumulativeFunding, true)}
            </Text>
          )}
        </Stack>
      </RecordRow>
    );
  };

  const toggleSeries = (key: SeriesKey) =>
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));

  if (isLoadingEquityCurve) {
    return (
      <LoadingSpinner />
    );
  }

  if (chartData.length <= 1) {
    return (
      <Callout tone="neutral" compact>
        {t('trading.wallets.noTradesYet')}
      </Callout>
    );
  }

  const lastPoint = chartData[chartData.length - 1]!;
  const realProfit = lastPoint.realProfit;
  const realProfitPercent = lastPoint.breakeven > 0 ? (realProfit / lastPoint.breakeven) * 100 : 0;

  return (
    <Stack gap={3}>
      <PanelHeader
        title={t('trading.wallets.equityCurve')}
        action={
          <HStack gap={1.5}>
            <SeriesLegendChip
              label={t('analytics.cumulativePnl')}
              color={chartProfit ?? ''}
              active={visibleSeries.pnl}
              onClick={() => toggleSeries('pnl')}
            />
            <SeriesLegendChip
              label={t('analytics.cumulativeFees')}
              color={chartLoss ?? ''}
              active={visibleSeries.fees}
              onClick={() => toggleSeries('fees')}
            />
            <SeriesLegendChip
              label={t('analytics.cumulativeFunding')}
              color={chartWarning ?? ''}
              active={visibleSeries.funding}
              onClick={() => toggleSeries('funding')}
            />
          </HStack>
        }
      />

      <HStack gap={6} fontSize="xs" px={1}>
        <Box>
          <Text color="fg.muted" fontSize="2xs">{t('analytics.realProfit')}</Text>
          <Text
            fontWeight="semibold"
            color={realProfit >= 0 ? 'trading.profit' : 'trading.loss'}
          >
            {formatCurrency(realProfit, true)} ({formatPercent(realProfitPercent)})
          </Text>
        </Box>
        <Box>
          <Text color="fg.muted" fontSize="2xs">{t('analytics.breakeven')}</Text>
          <Text fontWeight="semibold">{formatCurrency(lastPoint.breakeven)}</Text>
        </Box>
        <Box>
          <Text color="fg.muted" fontSize="2xs">{t('trading.wallets.equity')}</Text>
          <Text fontWeight="semibold">{formatCurrency(lastPoint.equity)}</Text>
        </Box>
      </HStack>

      <Box h="320px" minW={0}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
            <XAxis dataKey="time" style={{ fontSize: '10px', fill: chartTextMuted }} />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `${currency} ${value.toLocaleString()}`}
              style={{ fontSize: '10px', fill: chartTextMuted }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(value) =>
                value >= 0 ? `+${value.toFixed(0)}` : value.toFixed(0)
              }
              style={{ fontSize: '10px', fill: chartTextMuted }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="right" y={0} stroke={chartGrid} strokeDasharray="2 2" />
            <defs>
              <linearGradient id="colorEquityAnalytics" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="equity"
              stroke={chartPrimary}
              fillOpacity={1}
              fill="url(#colorEquityAnalytics)"
              name={t('trading.wallets.equity')}
              isAnimationActive={false}
            />
            <Line
              yAxisId="left"
              type="stepAfter"
              dataKey="breakeven"
              stroke={chartMutedFg}
              strokeDasharray="5 5"
              dot={false}
              name={t('analytics.breakeven')}
              isAnimationActive={false}
            />
            {visibleSeries.pnl && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePnl"
                stroke={chartProfit}
                strokeWidth={1.5}
                dot={false}
                name={t('analytics.cumulativePnl')}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.fees && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeFees"
                stroke={chartLoss}
                strokeWidth={1.5}
                dot={false}
                name={t('analytics.cumulativeFees')}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.funding && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeFunding"
                stroke={chartWarning}
                strokeWidth={1.5}
                dot={false}
                name={t('analytics.cumulativeFunding')}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
});

EquityCurveChart.displayName = 'EquityCurveChart';

interface SeriesLegendChipProps {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

const SeriesLegendChip = ({ label, color, active, onClick }: SeriesLegendChipProps) => (
  <Box
    as="button"
    onClick={onClick}
    px={2}
    py={0.5}
    borderRadius="sm"
    fontSize="2xs"
    fontWeight="medium"
    cursor="pointer"
    opacity={active ? 1 : 0.4}
    bg={active ? 'bg.muted' : 'transparent'}
    border="1px solid"
    borderColor={active ? 'border.muted' : 'transparent'}
    transition="opacity 0.15s, background 0.15s"
    _hover={{ opacity: active ? 1 : 0.7 }}
  >
    <Box as="span" display="inline-block" w="8px" h="8px" borderRadius="full" bg={color} mr={1.5} />
    {label}
  </Box>
);
