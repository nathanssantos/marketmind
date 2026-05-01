import { Flex, Spinner, Stack } from '@chakra-ui/react';
import { Callout, DialogShell } from '@renderer/components/ui';
import { Suspense, lazy, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useDialogMount } from '../../hooks/useDialogMount';
import { useUIStore } from '../../store/uiStore';
import { MM } from '@marketmind/tokens';
import { createMockMarginRequirements, MarginInfoPanel } from '../MarginInfoPanel';
import { PerformancePanel } from '../Trading/PerformancePanel';
import { PerformanceCalendar } from './PerformanceCalendar';

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

  const marginRequirements = useMemo(() => {
    if (!isIBWallet) return null;
    return createMockMarginRequirements();
  }, [isIBWallet]);

  const handleClose = useCallback(() => setAnalyticsOpen(false), [setAnalyticsOpen]);

  return (
    <DialogShell
      isOpen={isAnalyticsOpen}
      onClose={handleClose}
      size="xl"
      title={`${t('trading.tabs.analytics')}${activeWallet ? ` — ${activeWallet.name}` : ''}`}
      hideFooter
    >
      {activeWalletId ? (
        <Stack gap={4}>
          <PerformancePanel walletId={activeWalletId} currency={activeWalletCurrency} />
          <PerformanceCalendar walletId={activeWalletId} currency={activeWalletCurrency} />
          {marginRequirements && (
            <MarginInfoPanel requirements={marginRequirements} />
          )}
          <Suspense
            fallback={
              <Flex justify="center" align="center" py={MM.spinner.panel.py}>
                <Spinner size={MM.spinner.panel.size} />
              </Flex>
            }
          >
            <EquityCurveChart walletId={activeWalletId} currency={activeWalletCurrency} />
          </Suspense>
        </Stack>
      ) : (
        <Callout tone="info" compact>
          {t('trading.noWalletSelected')}
        </Callout>
      )}
    </DialogShell>
  );
});

AnalyticsDialog.displayName = 'AnalyticsDialog';
