import { ButtonGroup, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import { Button, PanelHeader } from '@renderer/components/ui';
import { MM } from '@renderer/theme/tokens';
import { useTranslation } from 'react-i18next';
import { useBackendAnalytics } from '../../hooks/useBackendAnalytics';
import { type AnalyticsPeriod, useUIStore } from '../../store/uiStore';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';

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
      <Flex justify="center" align="center" py={MM.spinner.panel.py}>
        <Spinner size={MM.spinner.panel.size} />
      </Flex>
    );
  }

  if (setupStats.length === 0) {
    return (
      <Text textAlign="center" color="fg.muted" py={8}>
        {t('trading.analytics.setupStats.noData')}
      </Text>
    );
  }

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'trading.profit';
    if (pnl < 0) return 'trading.loss';
    return 'fg.muted';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'green.fg';
    if (winRate >= 50) return 'yellow.fg';
    return 'red.fg';
  };

  const periods: { value: AnalyticsPeriod; labelKey: string }[] = [
    { value: 'day', labelKey: 'trading.analytics.periods.day' },
    { value: 'week', labelKey: 'trading.analytics.periods.week' },
    { value: 'month', labelKey: 'trading.analytics.periods.month' },
    { value: 'all', labelKey: 'trading.analytics.periods.all' },
  ];

  const columns: TradingTableColumn[] = [
    { key: 'setupType', header: t('trading.analytics.setupStats.setupType'), sortable: false },
    { key: 'totalTrades', header: t('trading.analytics.setupStats.totalTrades'), textAlign: 'right', sortable: false },
    { key: 'winRate', header: t('trading.analytics.setupStats.winRate'), textAlign: 'right', sortable: false },
    { key: 'winLoss', header: t('trading.analytics.setupStats.winLoss'), textAlign: 'right', sortable: false },
    { key: 'totalPnL', header: t('trading.analytics.setupStats.totalPnL'), textAlign: 'right', sortable: false },
    { key: 'avgPnL', header: t('trading.analytics.setupStats.avgPnL'), textAlign: 'right', sortable: false },
  ];

  return (
    <Stack gap={4}>
      <PanelHeader
        title={t('trading.analytics.setupStats.title')}
        action={
          <ButtonGroup size="xs" variant="outline" flexWrap="wrap">
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

      <TradingTable columns={columns} minW="600px">
        {setupStats.map((stat) => (
          <TradingTableRow key={stat.setupType}>
            <TradingTableCell>
              <Text fontWeight="medium">{stat.setupType}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">{stat.totalTrades}</TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontWeight="bold" color={getWinRateColor(stat.winRate)}>
                {stat.winRate.toFixed(1)}%
              </Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Flex justify="flex-end" align="center" gap={1}>
                <Text color="trading.profit">{stat.winningTrades}</Text>
                <Text color="fg.muted">/</Text>
                <Text color="trading.loss">{stat.losingTrades}</Text>
              </Flex>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontWeight="bold" color={getPnLColor(stat.totalPnL)}>
                {stat.totalPnL >= 0 ? '+' : ''}${stat.totalPnL.toFixed(2)}
              </Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text color={getPnLColor(stat.avgPnL)}>
                {stat.avgPnL >= 0 ? '+' : ''}${stat.avgPnL.toFixed(2)}
              </Text>
            </TradingTableCell>
          </TradingTableRow>
        ))}
      </TradingTable>

      <Flex justify="center" pt={2} borderTopWidth="1px">
        <Text fontSize="sm" color="fg.muted">
          {t('trading.analytics.setupStats.totalAnalyzed')}: <strong>{setupStats.length}</strong>
        </Text>
      </Flex>
    </Stack>
  );
};
