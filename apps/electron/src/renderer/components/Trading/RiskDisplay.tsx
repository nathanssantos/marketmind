import {
  Flex,
  Grid,
  GridItem,
  Text
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
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
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const executionsPolling = usePollingInterval(60_000);

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: 30000 }
  );

  const { data: activeExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: executionsPolling, staleTime: 30000 }
  );

  const { data: watcherStatus } = trpc.autoTrading.getWatcherStatus.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: 60000, staleTime: 30000 }
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

  return (
    <Grid templateColumns={`repeat(${columns}, 1fr)`} gap={2}>
      <GridItem>
        <Flex direction="column" px={3} py={2} bg="bg.muted" borderRadius="md" h="100%">
          <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">Open Positions</Text>
          <Flex align="baseline" gap={1}>
            <Text fontSize="sm" fontWeight="bold">{metrics.positions.open}</Text>
            {hasWatchers && (
              <Text fontSize="2xs" color="fg.muted">/ {metrics.positions.activeWatchers} watchers</Text>
            )}
          </Flex>
        </Flex>
      </GridItem>

      <GridItem>
        <Flex direction="column" px={3} py={2} bg="bg.muted" borderRadius="md" h="100%">
          <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">Total Exposure</Text>
          <Text fontSize="sm" fontWeight="bold">${metrics.exposure.current.toFixed(2)}</Text>
        </Flex>
      </GridItem>

      <GridItem>
        <Flex direction="column" px={3} py={2} bg="bg.muted" borderRadius="md" h="100%">
          <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">Daily PnL</Text>
          <Text
            fontSize="sm"
            fontWeight="bold"
            color={metrics.dailyPnL.value > 0 ? 'green.500' : metrics.dailyPnL.value < 0 ? 'red.500' : undefined}
          >
            {metrics.dailyPnL.value >= 0 ? '+' : ''}${metrics.dailyPnL.value.toFixed(2)}
          </Text>
          <Text fontSize="2xs" color="fg.muted">Limit: -{metrics.dailyPnL.limit}%</Text>
        </Flex>
      </GridItem>

      {hasWatchers && (
        <GridItem>
          <Flex direction="column" px={3} py={2} bg="bg.muted" borderRadius="md" h="100%">
            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">Size per Watcher</Text>
            <Text fontSize="sm" fontWeight="bold">{(100 / metrics.positions.activeWatchers).toFixed(1)}%</Text>
            <Text fontSize="2xs" color="fg.muted">100% / {metrics.positions.activeWatchers} watchers</Text>
          </Flex>
        </GridItem>
      )}
    </Grid>
  );
};
