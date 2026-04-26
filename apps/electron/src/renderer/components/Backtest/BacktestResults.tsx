import { Grid, HStack, Text, VStack } from '@chakra-ui/react';
import { Button, MetricCard } from '@renderer/components/ui';
import type { BacktestResult } from '@marketmind/types';
import { useTranslation } from 'react-i18next';

interface BacktestResultsProps {
  result: BacktestResult;
  onRunAnother: () => void;
}

export const BacktestResults = ({ result, onRunAnother }: BacktestResultsProps) => {
  const { t } = useTranslation();
  const m = result.metrics;
  const finalEquity = (result.config?.initialCapital ?? 0) + (m?.totalPnl ?? 0);

  return (
    <VStack align="stretch" gap={3}>
      <HStack justify="space-between">
        <VStack align="start" gap={0}>
          <Text fontSize="md" fontWeight="semibold">{t('backtest.results.title')}</Text>
          <Text fontSize="xs" color="fg.muted">
            {result.config?.symbol} · {result.config?.interval} · {result.config?.startDate} → {result.config?.endDate}
          </Text>
        </VStack>
        <Button size="2xs" variant="outline" onClick={onRunAnother} px={3}>
          {t('backtest.results.runAnother')}
        </Button>
      </HStack>

      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }} gap={3}>
        <MetricCard
          label={t('backtest.results.totalTrades')}
          value={m?.totalTrades ?? 0}
          format="number"
          size="sm"
        />
        <MetricCard
          label={t('backtest.results.winRate')}
          value={(m?.winRate ?? 0).toFixed(1) + '%'}
          format="number"
          size="sm"
          trend={m && m.winRate >= 50 ? 'up' : 'down'}
        />
        <MetricCard
          label={t('backtest.results.totalPnl')}
          value={m?.totalPnlPercent ?? 0}
          format="percent"
          size="sm"
          colorByValue
        />
        <MetricCard
          label={t('backtest.results.maxDrawdown')}
          value={(m?.maxDrawdownPercent ?? 0)}
          format="percent"
          size="sm"
          trend="down"
        />
        <MetricCard
          label={t('backtest.results.profitFactor')}
          value={Number((m?.profitFactor ?? 0).toFixed(2))}
          format="number"
          size="sm"
          trend={m && m.profitFactor >= 1 ? 'up' : 'down'}
        />
      </Grid>

      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
        <MetricCard
          label={t('backtest.results.finalEquity')}
          value={finalEquity}
          format="currency"
          currency={result.config?.marketType === 'SPOT' ? 'USDT' : 'USD'}
          size="sm"
        />
        <MetricCard
          label={t('backtest.results.avgWin')}
          value={m?.avgWin ?? 0}
          format="number"
          size="sm"
        />
        <MetricCard
          label={t('backtest.results.avgLoss')}
          value={m?.avgLoss ?? 0}
          format="number"
          size="sm"
        />
        <MetricCard
          label={t('backtest.results.sharpeRatio')}
          value={Number((m?.sharpeRatio ?? 0).toFixed(2))}
          format="number"
          size="sm"
        />
      </Grid>
    </VStack>
  );
};
