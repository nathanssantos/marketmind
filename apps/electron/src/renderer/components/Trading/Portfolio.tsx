import { Box, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import { Callout, EmptyState, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import { PortfolioSummary } from './PortfolioSummary';
import type { PortfolioProps } from './portfolioTypes';
import { usePortfolioData } from './usePortfolioData';

const Divider = () => <Box h="1px" w="100%" bg="fg.muted" opacity={0.2} flexShrink={0} />;

const PortfolioComponent = ({ headerContent }: PortfolioProps) => {
  if (perfMonitor.isEnabled()) perfMonitor.recordComponentRender('Portfolio');
  const { t } = useTranslation();

  const {
    activeWallet,
    positions,
    stats,
    todayPnl,
    effectiveCapital,
    stopProtectedPnl,
    tpProjectedProfit,
    totalExposure,
    totalMargin,
    totalFees,
    hasLeverage,
  } = usePortfolioData();

  const { syncBalance, syncTransfers } = useBackendWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const canSync = activeWallet?.walletType === 'testnet' || activeWallet?.walletType === 'live';

  const handleSyncBalance = async () => {
    if (!activeWallet || isSyncing) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        syncBalance(activeWallet.id),
        syncTransfers(activeWallet.id),
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Match Binance's "Today's Realized PnL" widget: percent is computed
  // against the CURRENT wallet balance, not the start-of-month
  // effective-capital basis the backend returns. The backend's
  // `pnlPercent` is useful for historical day-over-day comparison but
  // for the live sidebar widget we want what the user sees in Binance.
  const walletBalance = activeWallet?.walletBalance ?? activeWallet?.balance ?? 0;
  const todayPnlPercent = todayPnl
    ? (walletBalance > 0 ? (todayPnl.pnl / walletBalance) * 100 : todayPnl.pnlPercent)
    : 0;
  const todayPnlSign = (todayPnl?.pnl ?? 0) >= 0 ? '+' : '';
  const todayPnlColor = !todayPnl ? 'fg.muted' : (todayPnl.pnl >= 0 ? 'trading.profit' : 'trading.loss');

  const { totalPnL, totalPnLPercent } = stats;

  return (
    <Stack gap={1} px={1} flex={1} minH={0}>
      {headerContent}

      {!activeWallet ? (
        <Callout tone="warning" compact>
          {t('trading.portfolio.noWallet')}
        </Callout>
      ) : (
        <>
          <Flex justify="space-between" align="center" fontSize="xs" flexShrink={0}>
            <Stack gap={0}>
              <Text color="fg.muted" fontWeight="medium">{t('trading.portfolio.dailyPnl')}</Text>
              <Text color="fg.muted" fontSize="2xs">{todayPnl?.tradesCount ?? 0} {t('trading.portfolio.trades')}</Text>
            </Stack>
            <Flex align="center" gap={2}>
              {canSync && (
                <TooltipWrapper label={t('trading.wallets.syncBalance')}>
                  <IconButton
                    size="2xs"
                    variant="ghost"
                    aria-label="Sync balance"
                    onClick={() => { void handleSyncBalance(); }}
                    disabled={isSyncing}
                  >
                    {isSyncing ? <Spinner size="xs" /> : <LuRefreshCw />}
                  </IconButton>
                </TooltipWrapper>
              )}
              <Stack gap={0} align="flex-end">
                <Text fontWeight="medium" color={todayPnlColor}>
                  {todayPnl
                    ? `${todayPnlSign}${todayPnl.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${todayPnlSign}${todayPnlPercent.toFixed(2)}%)`
                    : '$0.00'}
                </Text>
                <BrlValue usdtValue={todayPnl?.pnl ?? 0} />
              </Stack>
            </Flex>
          </Flex>

          {positions.length === 0 ? (
            <EmptyState size="sm" title={t('trading.portfolio.empty')} />
          ) : (
            <>
              <Divider />
              <PortfolioSummary
                positionsCount={positions.length}
                totalPnL={totalPnL}
                totalPnLPercent={totalPnLPercent}
                totalExposure={totalExposure}
                totalMargin={totalMargin}
                totalFees={totalFees}
                hasLeverage={hasLeverage}
                walletBalance={activeWallet.walletBalance}
                currency={activeWallet.currency}
                effectiveCapital={effectiveCapital}
                stopProtectedPnl={stopProtectedPnl}
                tpProjectedProfit={tpProjectedProfit}
              />
            </>
          )}
        </>
      )}
    </Stack>
  );
};

export const Portfolio = memo(PortfolioComponent);
