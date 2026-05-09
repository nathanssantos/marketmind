import {
  Button,
  ButtonGroup,
  Grid,
  GridItem,
  Stack,
  Text,
} from '@chakra-ui/react';
import { DEFAULT_CURRENCY } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { DataCard, LoadingSpinner, PanelHeader } from '../ui';
import { useBackendAnalytics } from '../../hooks/useBackendAnalytics';
import { convertUsdtToBrl, useCurrencyStore } from '../../store/currencyStore';
import { type AnalyticsPeriod, useUIStore } from '../../store/uiStore';
import { MM } from '@marketmind/tokens';
import { formatBRL, formatWalletCurrency, formatWalletCurrencyWithSign } from '../../utils/currencyFormatter';

interface PerformancePanelProps {
  walletId: string;
  currency?: string;
}

export const PerformancePanel = ({ walletId, currency = DEFAULT_CURRENCY }: PerformancePanelProps) => {
  const { t } = useTranslation();
  const period = useUIStore((s) => s.performancePeriod);
  const setPeriod = useUIStore((s) => s.setPerformancePeriod);
  const { performance, isLoadingPerformance } = useBackendAnalytics(walletId, period);
  const usdtBrlRate = useCurrencyStore((s) => s.usdtBrlRate);
  const showBrlValues = useCurrencyStore((s) => s.showBrlValues);

  if (isLoadingPerformance) {
    return (
      <LoadingSpinner />
    );
  }

  if (!performance) {
    return (
      <Text textAlign="center" color="fg.muted" py={8}>
        {t('trading.analytics.performance.noData')}
      </Text>
    );
  }

  const getValueColor = (value: number) => {
    if (value > 0) return 'trading.profit';
    if (value < 0) return 'trading.loss';
    return 'fg.muted';
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => formatWalletCurrencyWithSign(value, currency);

  const formatCurrencyWithBrl = (value: number) => {
    const formatted = formatCurrency(value);
    if (!showBrlValues) return formatted;
    const brl = formatBRL(convertUsdtToBrl(Math.abs(value), usdtBrlRate));
    return `${formatted} (${brl})`;
  };

  const periods: { value: AnalyticsPeriod; labelKey: string }[] = [
    { value: 'day', labelKey: 'trading.analytics.periods.day' },
    { value: 'week', labelKey: 'trading.analytics.periods.week' },
    { value: 'month', labelKey: 'trading.analytics.periods.month' },
    { value: 'all', labelKey: 'trading.analytics.periods.all' },
  ];

  const MetricCard = ({
    label,
    value,
    valueColor,
    subtext,
  }: {
    label: string;
    value: string;
    valueColor?: string;
    subtext?: string;
  }) => (
    <GridItem>
      <DataCard label={label} value={value} valueColor={valueColor} subtext={subtext} />
    </GridItem>
  );

  return (
    <Stack gap={3}>
      <PanelHeader
        title={t('trading.analytics.performance.title')}
        action={
          <ButtonGroup size={MM.buttonSize.nav} variant="outline" flexWrap="wrap">
            {periods.map((p) => (
              <Button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                variant={period === p.value ? 'solid' : 'outline'}
                px={2}
              >
                {t(p.labelKey)}
              </Button>
            ))}
          </ButtonGroup>
        }
      />

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('trading.analytics.performance.totalReturn')}
          value={formatPercent(performance.totalReturn)}
          valueColor={getValueColor(performance.totalReturn)}
        />
        <MetricCard
          label={t('trading.analytics.performance.netPnL')}
          value={formatCurrencyWithBrl(performance.netPnL)}
          valueColor={getValueColor(performance.netPnL)}
          subtext={`Gross: ${formatCurrency(performance.grossPnL)} · Fees: ${formatCurrency(performance.totalFees)}${performance.totalFunding !== 0 ? ` · Funding: ${formatCurrency(performance.totalFunding)}` : ''}`}
        />
        <MetricCard
          label={t('trading.analytics.performance.winRate')}
          value={`${performance.winRate.toFixed(1)}%`}
          subtext={`${performance.winningTrades}W / ${performance.losingTrades}L`}
        />
      </Grid>

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('trading.analytics.performance.profitFactor')}
          value={performance.profitFactor.toFixed(2)}
          valueColor={performance.profitFactor >= 1 ? 'trading.profit' : 'trading.loss'}
        />
        <MetricCard
          label={t('trading.analytics.performance.avgWin')}
          value={formatCurrency(performance.avgWin)}
          valueColor="trading.profit"
        />
        <MetricCard
          label={t('trading.analytics.performance.avgLoss')}
          value={formatCurrency(performance.avgLoss)}
          valueColor="trading.loss"
        />
      </Grid>

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('trading.analytics.performance.maxDrawdown')}
          value={`-${performance.maxDrawdown.toFixed(2)}%`}
          valueColor="trading.loss"
        />
        <MetricCard
          label={t('trading.analytics.performance.largestWin')}
          value={formatCurrency(performance.largestWin)}
          valueColor="trading.profit"
        />
        <MetricCard
          label={t('trading.analytics.performance.largestLoss')}
          value={formatCurrency(performance.largestLoss)}
          valueColor="trading.loss"
        />
      </Grid>

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('analytics.totalFees')}
          value={formatWalletCurrency(performance.totalFees, currency)}
          valueColor="trading.loss"
        />
        <MetricCard
          label={t('analytics.totalFunding')}
          value={formatCurrency(performance.totalFunding)}
          valueColor={getValueColor(performance.totalFunding)}
        />
        <MetricCard
          label={t('analytics.avgDuration')}
          value={formatDuration(performance.avgTradeDurationHours ?? 0, t)}
        />
      </Grid>

      {/* Day-level metrics — mirrors Binance's "P&L Details" page where
          Win Rate is computed across days (not trades), and Avg Profit /
          Avg Loss are per-day. Sits below the trade-level metrics so
          users can compare both shapes side by side. */}
      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('trading.analytics.performance.dayWinRate')}
          value={`${performance.dayWinRate?.toFixed(1) ?? '0.0'}%`}
          subtext={`${performance.winningDays ?? 0}W / ${performance.losingDays ?? 0}L / ${performance.breakevenDays ?? 0}B`}
        />
        <MetricCard
          label={t('trading.analytics.performance.avgProfitPerDay')}
          value={formatCurrency(performance.avgProfitPerDay ?? 0)}
          valueColor="trading.profit"
        />
        <MetricCard
          label={t('trading.analytics.performance.avgLossPerDay')}
          value={formatCurrency(-(performance.avgLossPerDay ?? 0))}
          valueColor="trading.loss"
        />
      </Grid>
    </Stack>
  );
};

const formatDuration = (hours: number, t: (k: string, opts?: Record<string, unknown>) => string): string => {
  if (hours <= 0) return '–';
  if (hours < 1) return t('analytics.durationMinutes', { minutes: Math.round(hours * 60) });
  if (hours < 24) return t('analytics.durationHours', { hours: hours.toFixed(1) });
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours - days * 24);
  return remHours > 0
    ? `${days}d ${t('analytics.durationHours', { hours: remHours })}`
    : `${days}d`;
};
