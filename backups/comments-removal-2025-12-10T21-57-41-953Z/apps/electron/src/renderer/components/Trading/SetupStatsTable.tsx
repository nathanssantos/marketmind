import { Box, Button, ButtonGroup, Flex, Spinner, Stack, Table, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useBackendAnalytics, type AnalyticsPeriod } from '../../hooks/useBackendAnalytics';

interface SetupStatsTableProps {
  walletId: string;
}

export const SetupStatsTable = ({ walletId }: SetupStatsTableProps) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');
  const { setupStats, isLoadingSetupStats } = useBackendAnalytics(walletId, period);

  if (isLoadingSetupStats) {
    return (
      <Stack gap={4} p={4} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
        <Flex justify="center" align="center" py={8}>
          <Spinner size="lg" />
        </Flex>
      </Stack>
    );
  }

  if (setupStats.length === 0) {
    return (
      <Stack gap={4} p={4} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
        <Text textAlign="center" color="gray.500" py={8}>
          No setup statistics available
        </Text>
      </Stack>
    );
  }

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'green.500';
    if (pnl < 0) return 'red.500';
    return 'gray.500';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'green.500';
    if (winRate >= 50) return 'yellow.500';
    return 'red.500';
  };

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <Stack gap={4} p={6} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px">
        <Text fontSize="lg" fontWeight="bold">
          Setup Performance
        </Text>
        <ButtonGroup size="sm" variant="outline">
          {periods.map((p) => (
            <Button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              variant={period === p.value ? 'solid' : 'outline'}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <Box overflowX="auto">
        <Table.Root variant="outline" size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Setup Type</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Total Trades</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Win Rate</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">W/L</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Total PnL</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Avg PnL</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {setupStats.map((stat) => (
              <Table.Row
                key={stat.setupType}
                _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                transition="background 0.2s"
              >
                <Table.Cell fontWeight="medium">{stat.setupType}</Table.Cell>
                <Table.Cell textAlign="right">{stat.totalTrades}</Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontWeight="bold" color={getWinRateColor(stat.winRate)}>
                    {stat.winRate.toFixed(1)}%
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Flex justify="flex-end" align="center" gap={1}>
                    <Text color="green.500">{stat.winningTrades}</Text>
                    <Text color="gray.400">/</Text>
                    <Text color="red.500">{stat.losingTrades}</Text>
                  </Flex>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontWeight="bold" color={getPnLColor(stat.totalPnL)}>
                    {stat.totalPnL >= 0 ? '+' : ''}${stat.totalPnL.toFixed(2)}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text color={getPnLColor(stat.avgPnL)}>
                    {stat.avgPnL >= 0 ? '+' : ''}${stat.avgPnL.toFixed(2)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      <Flex justify="center" pt={2} borderTopWidth="1px">
        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
          Total setups analyzed: <strong>{setupStats.length}</strong>
        </Text>
      </Flex>
    </Stack>
  );
};
