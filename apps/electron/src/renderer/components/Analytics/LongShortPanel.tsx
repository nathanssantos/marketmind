import { Box, Grid, Stack, Text } from '@chakra-ui/react';
import { Callout, PanelHeader, RecordRow } from '@renderer/components/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWalletCurrencyWithSign } from '@renderer/utils/currencyFormatter';

export interface DirectionStats {
  trades: number;
  winRate: number;
  netPnL: number;
  avgPnL: number;
}

interface LongShortPanelProps {
  long: DirectionStats | null;
  short: DirectionStats | null;
  longestWinStreak: number;
  longestLossStreak: number;
  currency: string;
}

const SideCard = ({
  label,
  stats,
  currency,
}: {
  label: string;
  stats: DirectionStats | null;
  currency: string;
}) => {
  const { t } = useTranslation();
  if (!stats) {
    return (
      <RecordRow density="card">
        <Text fontSize="xs" color="fg.muted" mb={1}>{label}</Text>
        <Text fontSize="sm" color="fg.muted">{t('analytics.noTradesForSide')}</Text>
      </RecordRow>
    );
  }
  const pnlColor = stats.netPnL > 0 ? 'trading.profit' : stats.netPnL < 0 ? 'trading.loss' : 'fg.muted';
  return (
    <RecordRow density="card">
      <Text fontSize="xs" color="fg.muted" mb={2}>{label}</Text>
      <Stack gap={1.5}>
        <Stat label={t('analytics.tradeCount', { count: stats.trades })} value={`${stats.winRate.toFixed(1)}%`} />
        <Stat
          label={t('trading.analytics.performance.netPnL')}
          value={formatWalletCurrencyWithSign(stats.netPnL, currency)}
          valueColor={pnlColor}
        />
        <Stat
          label={t('trading.analytics.performance.avgPnL')}
          value={formatWalletCurrencyWithSign(stats.avgPnL, currency)}
          valueColor={pnlColor}
        />
      </Stack>
    </RecordRow>
  );
};

const Stat = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <Box display="flex" justifyContent="space-between" alignItems="baseline">
    <Text fontSize="2xs" color="fg.muted">{label}</Text>
    <Text fontSize="sm" fontWeight="medium" color={valueColor}>{value}</Text>
  </Box>
);

export const LongShortPanel = memo(({ long, short, longestWinStreak, longestLossStreak, currency }: LongShortPanelProps) => {
  const { t } = useTranslation();
  if (!long && !short) return null;
  return (
    <Stack gap={3}>
      <PanelHeader title={t('analytics.longShortBreakdown')} />
      <Grid templateColumns="repeat(2, 1fr)" gap={2}>
        <SideCard label={t('analytics.long')} stats={long} currency={currency} />
        <SideCard label={t('analytics.short')} stats={short} currency={currency} />
      </Grid>
      {(longestWinStreak > 0 || longestLossStreak > 0) && (
        <Callout tone="neutral" compact>
          <Box display="flex" gap={4} fontSize="xs">
            <Text>
              <Box as="span" color="fg.muted">{t('analytics.longestWinStreak')}: </Box>
              <Box as="span" fontWeight="semibold" color="trading.profit">{longestWinStreak}</Box>
            </Text>
            <Text>
              <Box as="span" color="fg.muted">{t('analytics.longestLossStreak')}: </Box>
              <Box as="span" fontWeight="semibold" color="trading.loss">{longestLossStreak}</Box>
            </Text>
          </Box>
        </Callout>
      )}
    </Stack>
  );
});

LongShortPanel.displayName = 'LongShortPanel';
