import { Box, Button, ButtonGroup, Flex, Spinner, Stack, Table, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useBackendAnalytics } from '../../hooks/useBackendAnalytics';
import { type AnalyticsPeriod, useUIStore } from '../../store/uiStore';

interface SetupStatsTableProps {
  walletId: string;
}

export const SetupStatsTable = ({ walletId }: SetupStatsTableProps) => {
  const { t } = useTranslation();
  const period = useUIStore((s) => s.setupStatsPeriod);
  const setPeriod = useUIStore((s) => s.setSetupStatsPeriod);
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
          {t('trading.analytics.setupStats.noData')}
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

  const periods: { value: AnalyticsPeriod; labelKey: string }[] = [
    { value: 'day', labelKey: 'trading.analytics.periods.day' },
    { value: 'week', labelKey: 'trading.analytics.periods.week' },
    { value: 'month', labelKey: 'trading.analytics.periods.month' },
    { value: 'all', labelKey: 'trading.analytics.periods.all' },
  ];

  return (
    <Stack gap={4} p={6} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px">
        <Text fontSize="lg" fontWeight="bold">
          {t('trading.analytics.setupStats.title')}
        </Text>
        <ButtonGroup size="sm" variant="outline">
          {periods.map((p) => (
            <Button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              variant={period === p.value ? 'solid' : 'outline'}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <Box overflowX="auto">
        <Table.Root variant="outline" size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>{t('trading.analytics.setupStats.setupType')}</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">{t('trading.analytics.setupStats.totalTrades')}</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">{t('trading.analytics.setupStats.winRate')}</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">{t('trading.analytics.setupStats.winLoss')}</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">{t('trading.analytics.setupStats.totalPnL')}</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">{t('trading.analytics.setupStats.avgPnL')}</Table.ColumnHeader>
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
          {t('trading.analytics.setupStats.totalAnalyzed')}: <strong>{setupStats.length}</strong>
        </Text>
      </Flex>
    </Stack>
  );
};
