import {
  Badge,
  Flex,
  Grid,
  GridItem,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { trpc } from '../../utils/trpc';

interface RiskDisplayProps {
  walletId: string;
}

interface RiskMetrics {
  exposure: {
    current: number;
    max: number;
    percent: number;
  };
  dailyPnL: {
    value: number;
    limit: number;
    percent: number;
  };
  positions: {
    open: number;
    max: number;
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

  useEffect(() => {
    if (!config || !activeExecutions) return;

    const openPositions = activeExecutions.filter((e) => e.status === 'open');

    const totalExposure = openPositions.reduce((sum, execution) => {
      const price = parseFloat(execution.entryPrice);
      const qty = parseFloat(execution.quantity || '0');
      return sum + price * qty;
    }, 0);

    const maxExposure = totalExposure * 2;
    const dailyPnL = 0;

    setMetrics({
      exposure: {
        current: totalExposure,
        max: maxExposure,
        percent: maxExposure > 0 ? (totalExposure / maxExposure) * 100 : 0,
      },
      dailyPnL: {
        value: dailyPnL,
        limit: parseFloat(config.dailyLossLimit),
        percent: 0,
      },
      positions: {
        open: openPositions.length,
        max: config.maxConcurrentPositions,
      },
    });
  }, [config, activeExecutions]);

  if (!metrics || !config) {
    return null;
  }

  return (
    <Stack gap={4} p={4} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Risk Metrics
        </Text>
        <Badge colorScheme={config.isEnabled ? 'green' : 'gray'}>
          {config.isEnabled ? 'Active' : 'Inactive'}
        </Badge>
      </Flex>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap={4}>
        {/* Open Positions */}
        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Open Positions
            </Text>
            <Flex align="baseline" gap={1}>
              <Text fontSize="2xl" fontWeight="bold">
                {metrics.positions.open}
              </Text>
              <Text fontSize="sm" color="gray.500">
                / {metrics.positions.max}
              </Text>
            </Flex>
            {/* <Progress
              value={positionPercent}
              size="sm"
              colorScheme={getProgressColorScheme(positionPercent)}
              borderRadius="full"
            /> */}
          </Stack>
        </GridItem>

        {/* Total Exposure */}
        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Total Exposure
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              ${metrics.exposure.current.toFixed(2)}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {metrics.exposure.percent.toFixed(1)}% of max
            </Text>
            {/* <Progress
              value={Math.min(metrics.exposure.percent, 100)}
              size="sm"
              colorScheme={getProgressColorScheme(metrics.exposure.percent)}
              borderRadius="full"
            /> */}
          </Stack>
        </GridItem>

        {/* Daily PnL */}
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

        {/* Position Sizing */}
        <GridItem>
          <Stack gap={2}>
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} fontWeight="medium">
              Max Position Size
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {config.maxPositionSize}%
            </Text>
            <Text fontSize="xs" color="gray.500" textTransform="capitalize">
              Strategy: {config.positionSizing}
            </Text>
          </Stack>
        </GridItem>
      </Grid>

      {/* Warnings */}
      <Stack gap={2}>
        {metrics.positions.open >= metrics.positions.max && (
          <Flex
            p={3}
            bg="orange.50"
            _dark={{ bg: 'orange.900', borderColor: 'orange.700', color: 'orange.200' }}
            borderRadius="md"
            borderWidth="1px"
            borderColor="orange.200"
            fontSize="sm"
            color="orange.800"
            align="center"
            gap={2}
          >
            <Text>⚠️</Text>
            <Text>Maximum concurrent positions reached</Text>
          </Flex>
        )}

        {metrics.exposure.percent > 80 && (
          <Flex
            p={3}
            bg="orange.50"
            _dark={{ bg: 'orange.900', borderColor: 'orange.700', color: 'orange.200' }}
            borderRadius="md"
            borderWidth="1px"
            borderColor="orange.200"
            fontSize="sm"
            color="orange.800"
            align="center"
            gap={2}
          >
            <Text>⚠️</Text>
            <Text>High exposure - approaching limits</Text>
          </Flex>
        )}
      </Stack>
    </Stack>
  );
};
