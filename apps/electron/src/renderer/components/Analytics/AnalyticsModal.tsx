import { Flex, Spinner, Stack } from '@chakra-ui/react';
import {
  Callout,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  IconButton,
} from '@renderer/components/ui';
import { Suspense, lazy, memo, useCallback, useMemo } from 'react';
import { LuX } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useDialogMount } from '../../hooks/useDialogMount';
import { useUIStore } from '../../store/uiStore';
import { MM } from '../../theme/tokens';
import { createMockMarginRequirements, MarginInfoPanel } from '../MarginInfoPanel';
import { PerformancePanel } from '../Trading/PerformancePanel';
import { PerformanceCalendar } from './PerformanceCalendar';

// V1_3 bundle follow-up — EquityCurveChart pulls recharts (~296 KB raw /
// 83 KB gz). Lazy-load so the chunk only ships when the user opens the
// Analytics modal.
const EquityCurveChart = lazy(() =>
  import('./EquityCurveChart').then((m) => ({ default: m.EquityCurveChart })),
);

export const AnalyticsModal = memo(() => {
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
  useDialogMount('AnalyticsModal', isAnalyticsOpen);

  const marginRequirements = useMemo(() => {
    if (!isIBWallet) return null;
    return createMockMarginRequirements();
  }, [isIBWallet]);

  const handleClose = useCallback(() => setAnalyticsOpen(false), [setAnalyticsOpen]);

  const handleOpenChange = (e: { open: boolean }) => {
    if (!e.open) handleClose();
  };

  return (
    <DialogRoot open={isAnalyticsOpen} onOpenChange={handleOpenChange} size="xl">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent maxH="90vh" maxW="1100px" w="90vw">
          <DialogHeader px={4} pt={4} pb={3}>
            <Flex justify="space-between" align="center" w="100%">
              <DialogTitle fontSize="md">{t('trading.tabs.analytics')}{activeWallet ? ` — ${activeWallet.name}` : ''}</DialogTitle>
              <IconButton
                size="2xs"
                variant="ghost"
                aria-label={t('common.close')}
                onClick={handleClose}
              >
                <LuX />
              </IconButton>
            </Flex>
          </DialogHeader>

          <DialogBody px={4} py={3} overflowY="auto">
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
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
});

AnalyticsModal.displayName = 'AnalyticsModal';
