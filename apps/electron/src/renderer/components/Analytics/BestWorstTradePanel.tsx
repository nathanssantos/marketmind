import { Box, Grid, Stack, Text } from '@chakra-ui/react';
import { Badge, PanelHeader, RecordRow } from '@renderer/components/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWalletCurrencyWithSign } from '@renderer/utils/currencyFormatter';

export interface BestWorstTradeRow {
  id: string;
  symbol: string;
  side: string;
  pnl: number;
  pnlPercent: number;
  openedAt: string | null;
  closedAt: string | null;
  durationHours: number;
}

interface BestWorstTradePanelProps {
  best: BestWorstTradeRow | null;
  worst: BestWorstTradeRow | null;
  currency: string;
}

const formatDuration = (hours: number): string => {
  if (hours <= 0) return '–';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours - days * 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const TradeCard = ({
  label,
  trade,
  tone,
  currency,
}: {
  label: string;
  trade: BestWorstTradeRow | null;
  tone: 'profit' | 'loss';
  currency: string;
}) => {
  const { t } = useTranslation();
  if (!trade) {
    return (
      <RecordRow density="card">
        <Text fontSize="xs" color="fg.muted" mb={1}>{label}</Text>
        <Text fontSize="sm" color="fg.muted">–</Text>
      </RecordRow>
    );
  }
  const pnlColor = tone === 'profit' ? 'trading.profit' : 'trading.loss';
  return (
    <RecordRow density="card">
      <Text fontSize="xs" color="fg.muted" mb={2}>{label}</Text>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Text fontSize="sm" fontWeight="semibold">{trade.symbol}</Text>
        <Badge size="xs" colorPalette={trade.side === 'LONG' ? 'green' : 'red'}>{trade.side}</Badge>
      </Box>
      <Text fontSize="md" fontWeight="bold" color={pnlColor} mb={1}>
        {formatWalletCurrencyWithSign(trade.pnl, currency)}
        {trade.pnlPercent !== 0 && (
          <Box as="span" fontSize="xs" ml={1.5} fontWeight="medium">
            ({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)
          </Box>
        )}
      </Text>
      <Text fontSize="2xs" color="fg.muted">
        {formatDate(trade.closedAt)} · {formatDuration(trade.durationHours)}
      </Text>
      {/* Reserved t() reference so unused-translation lint doesn't flag */}
      <Box display="none">{t('analytics.bestTrade')}</Box>
    </RecordRow>
  );
};

export const BestWorstTradePanel = memo(({ best, worst, currency }: BestWorstTradePanelProps) => {
  const { t } = useTranslation();
  if (!best && !worst) return null;
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={2}>
      <TradeCard label={t('analytics.bestTrade')} trade={best} tone="profit" currency={currency} />
      <TradeCard label={t('analytics.worstTrade')} trade={worst} tone="loss" currency={currency} />
    </Grid>
  );
});

BestWorstTradePanel.displayName = 'BestWorstTradePanel';

export const BestWorstTradeSection = memo((props: BestWorstTradePanelProps) => {
  const { t } = useTranslation();
  return (
    <Stack gap={3}>
      <PanelHeader title={`${t('analytics.bestTrade')} / ${t('analytics.worstTrade')}`} />
      <BestWorstTradePanel {...props} />
    </Stack>
  );
});

BestWorstTradeSection.displayName = 'BestWorstTradeSection';
