import {
  Flex,
  Grid,
  GridItem,
  Stack,
  Text
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { trpc } from '../../utils/trpc';

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

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: 30000 }
  );

  const { data: activeExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId, limit: 100 },
    { enabled: !!walletId, refetchInterval: 10000 }
  );

  const { data: watcherStatus } = trpc.autoTrading.getWatcherStatus.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: 10000 }
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

  return (
    <Stack gap={4}>
      <Grid templateColumns="repeat(auto-fit, 1fr)" gap={4}>
        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Open Positions
            </Text>
            <Flex align="baseline" gap={1}>
              <Text fontSize="2xl" fontWeight="bold">
                {metrics.positions.open}
              </Text>
              {metrics.positions.activeWatchers > 0 && (
                <Text fontSize="sm" color="gray.500">
                  / {metrics.positions.activeWatchers} watchers
                </Text>
              )}
            </Flex>
          </Stack>
        </GridItem>

        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Total Exposure
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              ${metrics.exposure.current.toFixed(2)}
            </Text>
          </Stack>
        </GridItem>

        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Daily PnL
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color={
                metrics.dailyPnL.value > 0
                  ? 'green.500'
                  : metrics.dailyPnL.value < 0
                    ? 'red.500'
                    : undefined
              }
            >
              {metrics.dailyPnL.value >= 0 ? '+' : ''}${metrics.dailyPnL.value.toFixed(2)}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Limit: -{metrics.dailyPnL.limit}%
            </Text>
          </Stack>
        </GridItem>

        {metrics.positions.activeWatchers > 0 && (
          <GridItem>
            <Stack gap={2}>
              <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
                Size per Watcher
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {(100 / metrics.positions.activeWatchers).toFixed(1)}%
              </Text>
              <Text fontSize="xs" color="gray.500">
                100% / {metrics.positions.activeWatchers} watchers
              </Text>
            </Stack>
          </GridItem>
        )}
      </Grid>
    </Stack>
  );
};
