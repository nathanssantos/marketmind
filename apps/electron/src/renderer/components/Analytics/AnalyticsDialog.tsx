import { Stack } from '@chakra-ui/react';
import { DialogShell, EmptyState, LoadingSpinner } from '@renderer/components/ui';
import { Suspense, lazy, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useBackendAnalytics } from '../../hooks/useBackendAnalytics';
import { useDialogMount } from '../../hooks/useDialogMount';
import { useUIStore } from '../../store/uiStore';
import { createMockMarginRequirements, MarginInfoPanel } from '../MarginInfoPanel';
import { PerformancePanel } from '../Trading/PerformancePanel';
import { PerformanceCalendar } from './PerformanceCalendar';
import { LongShortPanel } from './LongShortPanel';
import { BestWorstTradeSection } from './BestWorstTradePanel';
import { BreakdownTable } from './BreakdownTable';

// V1_3 bundle follow-up — EquityCurveChart pulls recharts (~296 KB raw /
// 83 KB gz). Lazy-load so the chunk only ships when the user opens the
// Analytics modal.
const EquityCurveChart = lazy(() =>
  import('./EquityCurveChart').then((m) => ({ default: m.EquityCurveChart })),
);

export const AnalyticsDialog = memo(() => {
  const { t } = useTranslation();
  const { activeWallet, isIB: isIBWallet } = useActiveWallet();
  const activeWalletId = activeWallet?.id;
  const activeWalletCurrency = activeWallet?.currency ?? 'USDT';

  const { isAnalyticsOpen, setAnalyticsOpen } = useUIStore(
    useShallow((s) => ({
      isAnalyticsOpen: s.isAnalyticsOpen,
      setAnalyticsOpen: s.setAnalyticsOpen,
    }))
  );
  useDialogMount('AnalyticsDialog', isAnalyticsOpen);

  const period = useUIStore((s) => s.performancePeriod);
  const { performance, setupStats } = useBackendAnalytics(activeWalletId ?? '', period);

  const marginRequirements = useMemo(() => {
    if (!isIBWallet) return null;
    return createMockMarginRequirements();
  }, [isIBWallet]);

  const setupRows = useMemo(
    () =>
      setupStats.map((s) => ({
        label: s.setupType,
        trades: s.totalTrades,
        winRate: s.winRate,
        totalPnL: s.totalPnL,
        avgPnL: s.avgPnL,
      })),
    [setupStats]
  );

  const symbolRows = useMemo(
    () =>
      (performance?.bySymbol ?? []).map((s) => ({
        label: s.symbol,
        trades: s.trades,
        winRate: s.winRate,
        totalPnL: s.netPnL,
      })),
    [performance?.bySymbol]
  );

  const handleClose = useCallback(() => setAnalyticsOpen(false), [setAnalyticsOpen]);

  return (
    <DialogShell
      isOpen={isAnalyticsOpen}
      onClose={handleClose}
      size="xl"
      title={`${t('trading.tabs.analytics')}${activeWallet ? ` — ${activeWallet.name}` : ''}`}
      description={t('analytics.dialogDescription')}
      hideFooter
    >
      {activeWalletId ? (
        <Stack gap={4}>
          <PerformancePanel walletId={activeWalletId} currency={activeWalletCurrency} />
          {performance?.bestTrade || performance?.worstTrade ? (
            <BestWorstTradeSection
              best={performance?.bestTrade ?? null}
              worst={performance?.worstTrade ?? null}
              currency={activeWalletCurrency}
            />
          ) : null}
          {(performance?.long ?? performance?.short) ? (
            <LongShortPanel
              long={performance?.long ?? null}
              short={performance?.short ?? null}
              longestWinStreak={performance?.longestWinStreak ?? 0}
              longestLossStreak={performance?.longestLossStreak ?? 0}
              currency={activeWalletCurrency}
            />
          ) : null}
          <Suspense
            fallback={
              <LoadingSpinner />
            }
          >
            <EquityCurveChart walletId={activeWalletId} currency={activeWalletCurrency} />
          </Suspense>
          <PerformanceCalendar walletId={activeWalletId} currency={activeWalletCurrency} />
          <BreakdownTable
            title={t('analytics.setupBreakdown')}
            emptyMessage={t('analytics.noSetupData')}
            labelColumnHeader={t('analytics.setup')}
            rows={setupRows}
            currency={activeWalletCurrency}
            showAvgPnL
          />
          <BreakdownTable
            title={t('analytics.symbolBreakdown')}
            emptyMessage={t('analytics.noSymbolData')}
            labelColumnHeader={t('common.symbol')}
            rows={symbolRows}
            currency={activeWalletCurrency}
          />
          {marginRequirements && (
            <MarginInfoPanel requirements={marginRequirements} />
          )}
        </Stack>
      ) : (
        <EmptyState
          title={t('analytics.noWalletTitle')}
          description={t('trading.noWalletSelected')}
        />
      )}
    </DialogShell>
  );
});

AnalyticsDialog.displayName = 'AnalyticsDialog';
