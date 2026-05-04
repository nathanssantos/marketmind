import { Stack, Text } from '@chakra-ui/react';
import { Callout, PanelHeader } from '@renderer/components/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWalletCurrencyWithSign } from '@renderer/utils/currencyFormatter';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from '@renderer/components/Trading/TradingTable';

interface BreakdownRow {
  label: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  avgPnL?: number;
}

interface BreakdownTableProps {
  title: string;
  emptyMessage: string;
  labelColumnHeader: string;
  rows: BreakdownRow[];
  currency: string;
  maxRows?: number;
  showAvgPnL?: boolean;
}

const colorForPnl = (pnl: number) => (pnl > 0 ? 'trading.profit' : pnl < 0 ? 'trading.loss' : 'fg.muted');

export const BreakdownTable = memo(({
  title,
  emptyMessage,
  labelColumnHeader,
  rows,
  currency,
  maxRows = 5,
  showAvgPnL = false,
}: BreakdownTableProps) => {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <Stack gap={3}>
        <PanelHeader title={title} />
        <Callout tone="neutral" compact>{emptyMessage}</Callout>
      </Stack>
    );
  }
  const visible = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  const columns: TradingTableColumn[] = [
    { key: 'label', header: labelColumnHeader, sticky: true, minW: '120px' },
    { key: 'trades', header: t('analytics.trades'), textAlign: 'right', sortable: false },
    { key: 'winRate', header: t('trading.analytics.performance.winRate'), textAlign: 'right', sortable: false },
    { key: 'pnl', header: t('trading.analytics.performance.netPnL'), textAlign: 'right', sortable: false },
  ];
  if (showAvgPnL) {
    columns.push({ key: 'avgPnL', header: t('trading.analytics.performance.avgPnL'), textAlign: 'right', sortable: false });
  }

  return (
    <Stack gap={3}>
      <PanelHeader title={title} />
      <TradingTable columns={columns} minW="auto">
        {visible.map((row) => {
          const pnlColor = colorForPnl(row.totalPnL);
          return (
            <TradingTableRow key={row.label}>
              <TradingTableCell sticky>{row.label}</TradingTableCell>
              <TradingTableCell textAlign="right">{row.trades}</TradingTableCell>
              <TradingTableCell textAlign="right">{row.winRate.toFixed(1)}%</TradingTableCell>
              <TradingTableCell textAlign="right">
                <Text as="span" color={pnlColor} fontWeight="medium">
                  {formatWalletCurrencyWithSign(row.totalPnL, currency)}
                </Text>
              </TradingTableCell>
              {showAvgPnL && (
                <TradingTableCell textAlign="right">
                  <Text as="span" color={pnlColor}>
                    {row.avgPnL !== undefined ? formatWalletCurrencyWithSign(row.avgPnL, currency) : '–'}
                  </Text>
                </TradingTableCell>
              )}
            </TradingTableRow>
          );
        })}
      </TradingTable>
      {truncated && (
        <Text fontSize="2xs" color="fg.muted" textAlign="end">
          +{rows.length - maxRows} more
        </Text>
      )}
    </Stack>
  );
});

BreakdownTable.displayName = 'BreakdownTable';
