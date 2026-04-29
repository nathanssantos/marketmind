import { Grid, GridItem } from '@chakra-ui/react';
import { DataCard } from '@renderer/components/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../utils/trpc';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';

interface RiskDisplayProps {
  walletId: string;
}

interface RiskMetrics {
  exposure: {
    current: number;
  };
  dailyPnL: {
    value: number;
    limit: number;
  };
  positions: {
    open: number;
    activeWatchers: number;
  };
}

export const RiskDisplay = ({ walletId }: RiskDisplayProps) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const pollingInterval = usePollingInterval(10_000);

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: 5000 }
  );

  const { data: activeExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: 5000 }
  );

  const { data: watcherStatus } = trpc.autoTrading.getWatcherStatus.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: 5000 }
  );

  useEffect(() => {
    if (!config || !activeExecutions) return;

    const openPositions = activeExecutions.filter((e) => e.status === 'open');

    const totalExposure = openPositions.reduce((sum, execution) => {
      const price = parseFloat(execution.entryPrice);
      const qty = parseFloat(execution.quantity || '0');
      return sum + price * qty;
    }, 0);

    const dailyPnL = 0;
    const activeWatchersCount = watcherStatus?.watchers ?? 0;

    setMetrics({
      exposure: {
        current: totalExposure,
      },
      dailyPnL: {
        value: dailyPnL,
        limit: parseFloat(config.dailyLossLimit),
      },
      positions: {
        open: openPositions.length,
        activeWatchers: activeWatchersCount,
      },
    });
  }, [config, activeExecutions, watcherStatus]);

  if (!metrics || !config) {
    return null;
  }

  const hasWatchers = metrics.positions.activeWatchers > 0;
  const columns = hasWatchers ? 4 : 3;
  const dailyPnL = metrics.dailyPnL.value;
  const dailyPnLColor = dailyPnL > 0 ? 'trading.profit' : dailyPnL < 0 ? 'trading.loss' : undefined;
  const dailyPnLValue = `${dailyPnL >= 0 ? '+' : ''}$${dailyPnL.toFixed(2)}`;

  return (
    <Grid templateColumns={`repeat(${columns}, 1fr)`} gap={2}>
      <GridItem>
        <DataCard
          label={t('trading.portfolio.openPositions')}
          value={String(metrics.positions.open)}
          valueAside={hasWatchers ? t('trading.portfolio.watchersRatio', { count: metrics.positions.activeWatchers }) : undefined}
        />
      </GridItem>

      <GridItem>
        <DataCard
          label={t('trading.portfolio.totalExposure')}
          value={`$${metrics.exposure.current.toFixed(2)}`}
        />
      </GridItem>

      <GridItem>
        <DataCard
          label={t('trading.portfolio.dailyPnLLabel')}
          value={dailyPnLValue}
          valueColor={dailyPnLColor}
          subtext={t('trading.portfolio.dailyLimit', { percent: metrics.dailyPnL.limit })}
        />
      </GridItem>

      {hasWatchers && (
        <GridItem>
          <DataCard
            label={t('trading.portfolio.sizePerWatcher')}
            value={`${(100 / metrics.positions.activeWatchers).toFixed(1)}%`}
            subtext={t('trading.portfolio.perWatcher', { count: metrics.positions.activeWatchers })}
          />
        </GridItem>
      )}
    </Grid>
  );
};
