import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  GridItem,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { DEFAULT_CURRENCY } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { useBackendAnalytics } from '../../hooks/useBackendAnalytics';
import { convertUsdtToBrl, useCurrencyStore } from '../../store/currencyStore';
import { type AnalyticsPeriod, useUIStore } from '../../store/uiStore';
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
      <Flex justify="center" align="center" py={8}>
        <Spinner size="lg" />
      </Flex>
    );
  }

  if (!performance) {
    return (
      <Text textAlign="center" color="gray.500" py={8}>
        {t('trading.analytics.performance.noData')}
      </Text>
    );
  }

  const getValueColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
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
      <Box px={3} py={2} bg="bg.muted" borderRadius="md" h="100%">
        <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">
          {label}
        </Text>
        <Text fontSize="sm" fontWeight="bold" color={valueColor}>
          {value}
        </Text>
        {subtext && (
          <Text fontSize="2xs" color="fg.muted">
            {subtext}
          </Text>
        )}
      </Box>
    </GridItem>
  );

  return (
    <Stack gap={3}>
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px" flexWrap="wrap" gap={2}>
        <Text fontSize="md" fontWeight="bold">
          {t('trading.analytics.performance.title')}
        </Text>
        <ButtonGroup size="2xs" variant="outline" flexWrap="wrap">
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
      </Flex>

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
          subtext={`Gross: ${formatCurrency(performance.grossPnL)} - Fees: ${formatWalletCurrency(performance.totalFees, currency)}`}
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
          valueColor={performance.profitFactor >= 1 ? 'green.500' : 'red.500'}
        />
        <MetricCard
          label={t('trading.analytics.performance.avgWin')}
          value={formatCurrency(performance.avgWin)}
          valueColor="green.500"
        />
        <MetricCard
          label={t('trading.analytics.performance.avgLoss')}
          value={formatCurrency(performance.avgLoss)}
          valueColor="red.500"
        />
      </Grid>

      <Grid templateColumns="repeat(3, 1fr)" gap={2}>
        <MetricCard
          label={t('trading.analytics.performance.maxDrawdown')}
          value={`-${performance.maxDrawdown.toFixed(2)}%`}
          valueColor="red.500"
        />
        <MetricCard
          label={t('trading.analytics.performance.largestWin')}
          value={formatCurrency(performance.largestWin)}
          valueColor="green.500"
        />
        <MetricCard
          label={t('trading.analytics.performance.largestLoss')}
          value={formatCurrency(performance.largestLoss)}
          valueColor="red.500"
        />
      </Grid>
    </Stack>
  );
};
