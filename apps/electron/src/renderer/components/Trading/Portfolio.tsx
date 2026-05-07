import { Flex, Stack, Text } from '@chakra-ui/react';
import { Callout, EmptyState } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PortfolioSummary } from './PortfolioSummary';
import type { PortfolioProps } from './portfolioTypes';
import { usePortfolioData } from './usePortfolioData';

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
    hasLeverage,
  } = usePortfolioData();

  const { totalPnL, totalPnLPercent, profitableCount, losingCount } = stats;

  return (
    <Stack gap={2} flex={1} minH={0}>
      {headerContent}

      {!activeWallet ? (
        <Callout tone="warning" compact>
          {t('trading.portfolio.noWallet')}
        </Callout>
      ) : (
        <>
          <Flex p={3} bg="bg.surface" borderRadius="md" justify="space-between" align="center" fontSize="xs" flexShrink={0}>
            <Stack gap={0}>
              <Text color="fg.muted" fontWeight="medium">{t('trading.portfolio.dailyPnl')}</Text>
              <Text color="fg.muted" fontSize="2xs">{todayPnl?.tradesCount ?? 0} {t('trading.portfolio.trades')}</Text>
            </Stack>
            <Stack gap={0} align="flex-end">
              {(() => {
                if (!todayPnl) return <Text fontWeight="medium" color="fg.muted">$0.00</Text>;
                // Match Binance's "Today's Realized PnL" widget: percent is
                // computed against the CURRENT wallet balance, not the
                // start-of-month effective-capital basis the backend
                // returns. The backend's `pnlPercent` is useful for
                // historical day-over-day comparison but for the live
                // sidebar widget we want what the user sees in Binance.
                const walletBalance = activeWallet?.walletBalance ?? activeWallet?.balance ?? 0;
                const pnlPercent = walletBalance > 0
                  ? (todayPnl.pnl / walletBalance) * 100
                  : todayPnl.pnlPercent;
                const sign = todayPnl.pnl >= 0 ? '+' : '';
                return (
                  <Text fontWeight="medium" color={todayPnl.pnl >= 0 ? 'trading.profit' : 'trading.loss'}>
                    {sign}{todayPnl.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({sign}{pnlPercent.toFixed(2)}%)
                  </Text>
                );
              })()}
              <BrlValue usdtValue={todayPnl?.pnl ?? 0} />
            </Stack>
          </Flex>

          {positions.length === 0 ? (
            <EmptyState size="sm" title={t('trading.portfolio.empty')} />
          ) : (
            <PortfolioSummary
              positionsCount={positions.length}
              profitableCount={profitableCount}
              losingCount={losingCount}
              totalPnL={totalPnL}
              totalPnLPercent={totalPnLPercent}
              totalExposure={totalExposure}
              totalMargin={totalMargin}
              hasLeverage={hasLeverage}
              walletBalance={activeWallet.walletBalance}
              currency={activeWallet.currency}
              effectiveCapital={effectiveCapital}
              stopProtectedPnl={stopProtectedPnl}
              tpProjectedProfit={tpProjectedProfit}
            />
          )}
        </>
      )}
    </Stack>
  );
};

export const Portfolio = memo(PortfolioComponent);
