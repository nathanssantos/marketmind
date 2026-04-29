import { Box, Flex, Spinner, Stack, Text, useToken } from '@chakra-ui/react';
import { Callout, PanelHeader } from '@renderer/components/ui';
import { MM } from '@renderer/theme/tokens';
import { useBackendAnalytics } from '@renderer/hooks/useBackendAnalytics';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface EquityCurveChartProps {
  walletId: string;
  currency: string;
}

export const EquityCurveChart = memo(({ walletId, currency }: EquityCurveChartProps) => {
  const { t } = useTranslation();
  const { wallets } = useActiveWallet();
  const backendWallet = wallets.find((w) => w.id === walletId);
  const { equityCurve, isLoadingEquityCurve } = useBackendAnalytics(walletId, 'all');

  const [chartPrimary, chartSecondary, chartGrid, chartTextMuted] = useToken('colors', [
    'chart.line.default',
    'fg.muted',
    'chart.grid',
    'chart.axis.label',
  ]);

  const effectiveCapital = useMemo(() => {
    if (!backendWallet) return 0;
    const initial = parseFloat(backendWallet.initialBalance ?? '0');
    const deposits = parseFloat(backendWallet.totalDeposits ?? '0');
    const withdrawals = parseFloat(backendWallet.totalWithdrawals ?? '0');
    return initial + deposits - withdrawals;
  }, [backendWallet]);

  const chartData = useMemo(
    () =>
      equityCurve.map((point) => ({
        time: new Date(point.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        equity: point.balance,
        initialCapital: effectiveCapital,
      })),
    [equityCurve, effectiveCapital]
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
    payload?: Array<{ value: number; payload: { time: string } }>;
  }) => {
    if (active && payload && payload.length >= 1) {
      const equity = payload[0]?.value ?? 0;
      const pnl = equity - effectiveCapital;
      const pnlPercent = effectiveCapital > 0 ? (pnl / effectiveCapital) * 100 : 0;

      return (
        <Box p={2} bg="bg.panel" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" fontWeight="medium" mb={1}>
            {payload[0]?.payload.time}
          </Text>
          <Box fontSize="2xs" gap={0.5}>
            <Text style={{ color: chartPrimary }}>
              {t('trading.wallets.equity')}: {formatCurrency(equity)}
            </Text>
            <Text color={pnl >= 0 ? 'trading.profit' : 'trading.loss'}>
              {t('trading.wallets.pnl')}: {formatCurrency(pnl, true)} ({formatPercent(pnlPercent)})
            </Text>
          </Box>
        </Box>
      );
    }
    return null;
  };

  if (isLoadingEquityCurve) {
    return (
      <Flex justify="center" align="center" py={MM.spinner.panel.py}>
        <Spinner size={MM.spinner.panel.size} />
      </Flex>
    );
  }

  if (chartData.length <= 1) {
    return (
      <Callout tone="neutral" compact>
        {t('trading.wallets.noTradesYet')}
      </Callout>
    );
  }

  return (
    <Stack gap={3}>
      <PanelHeader title={t('trading.wallets.equityCurve')} />
      <Box h="280px" minW={0}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
            <XAxis
              dataKey="time"
              style={{ fontSize: '10px', fill: chartTextMuted }}
            />
            <YAxis
              tickFormatter={(value) => `${currency} ${value.toLocaleString()}`}
              style={{ fontSize: '10px', fill: chartTextMuted }}
            />
            <Tooltip content={<CustomTooltip />} />
            <defs>
              <linearGradient id="colorEquityAnalytics" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="equity"
              stroke={chartPrimary}
              fillOpacity={1}
              fill="url(#colorEquityAnalytics)"
              name={t('trading.wallets.equity')}
            />
            <Line
              type="monotone"
              dataKey="initialCapital"
              stroke={chartSecondary}
              strokeDasharray="5 5"
              dot={false}
              name={t('trading.wallets.initialBalance')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
});

EquityCurveChart.displayName = 'EquityCurveChart';
