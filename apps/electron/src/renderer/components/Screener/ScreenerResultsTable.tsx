import type { ScreenerResultRow, ScreenerSortField } from '@marketmind/types';
import { Box, Text } from '@chakra-ui/react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../ui';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from '../Trading/TradingTable';

interface ScreenerResultsTableProps {
  results: ScreenerResultRow[];
  sortKey: ScreenerSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  onSymbolClick?: (symbol: string) => void;
}

const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined) return '-';
  return value.toFixed(decimals);
};

const formatVolume = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
};

export const ScreenerResultsTable = memo(({
  results,
  sortKey,
  sortDirection,
  onSort,
  onSymbolClick,
}: ScreenerResultsTableProps) => {
  const { t } = useTranslation();

  const columns: TradingTableColumn[] = useMemo(() => [
    { key: 'symbol', header: t('screener.results.symbol'), sticky: true, minW: '100px' },
    { key: 'price', header: t('screener.results.price'), textAlign: 'right', minW: '80px' },
    { key: 'priceChange24h', header: t('screener.results.change24h'), textAlign: 'right', minW: '80px' },
    { key: 'volume24h', header: t('screener.results.volume'), textAlign: 'right', minW: '80px' },
    { key: 'marketCapRank', header: t('screener.results.rank'), textAlign: 'right', minW: '50px' },
    { key: 'rsi', header: 'RSI', textAlign: 'right', minW: '50px' },
    { key: 'adx', header: 'ADX', textAlign: 'right', minW: '50px' },
    { key: 'atrPercent', header: 'ATR%', textAlign: 'right', minW: '60px' },
    { key: 'volumeRatio', header: t('screener.results.volRatio'), textAlign: 'right', minW: '60px' },
    { key: 'compositeScore', header: t('screener.results.score'), textAlign: 'right', minW: '60px' },
  ], [t]);

  if (results.length === 0) {
    return <EmptyState size="sm" title={t('screener.results.empty')} />;
  }

  return (
    <TradingTable
      columns={columns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
      minW="900px"
    >
      {results.map((row) => (
        <TradingTableRow key={row.symbol} onClick={onSymbolClick ? () => onSymbolClick(row.symbol) : undefined}>
          <TradingTableCell sticky>
            <Box>
              <Text fontWeight="semibold">{row.symbol}</Text>
              <Text fontSize="3xs" color="fg.muted">{row.displayName}</Text>
            </Box>
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            {row.price < 1 ? row.price.toPrecision(4) : formatNumber(row.price)}
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            <Text color={row.priceChangePercent24h >= 0 ? 'trading.profit' : 'trading.loss'}>
              {row.priceChangePercent24h >= 0 ? '+' : ''}{formatNumber(row.priceChangePercent24h)}%
            </Text>
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            {formatVolume(row.volume24h)}
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            {row.marketCapRank ?? '-'}
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            <Text color={
              (row.indicators['RSI'] ?? 50) < 30 ? 'green.500' :
              (row.indicators['RSI'] ?? 50) > 70 ? 'red.500' : 'fg'
            }>
              {formatNumber(row.indicators['RSI'])}
            </Text>
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            <Text color={(row.indicators['ADX'] ?? 0) > 25 ? 'blue.500' : 'fg.muted'}>
              {formatNumber(row.indicators['ADX'])}
            </Text>
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            {formatNumber(row.indicators['ATR_PERCENT'])}%
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            <Text color={(row.indicators['VOLUME_RATIO'] ?? 0) > 2 ? 'orange.500' : 'fg'}>
              {formatNumber(row.indicators['VOLUME_RATIO'])}x
            </Text>
          </TradingTableCell>
          <TradingTableCell textAlign="right">
            <Text fontWeight="semibold">{formatNumber(row.compositeScore, 0)}</Text>
          </TradingTableCell>
        </TradingTableRow>
      ))}
    </TradingTable>
  );
});

ScreenerResultsTable.displayName = 'ScreenerResultsTable';
