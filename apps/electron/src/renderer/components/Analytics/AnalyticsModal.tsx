import { Flex, Stack, Text } from '@chakra-ui/react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useUIStore } from '../../store/uiStore';
import { createMockMarginRequirements, MarginInfoPanel } from '../MarginInfoPanel';
import { PerformancePanel } from '../Trading/PerformancePanel';
import { RiskDisplay } from '../Trading/RiskDisplay';
import { SetupStatsTable } from '../Trading/SetupStatsTable';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '../ui/dialog';

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
        <DialogContent maxH="90vh" maxW="900px" w="90vw">
          <DialogHeader px={4} pt={4}>
            <Flex justify="space-between" align="center" w="100%">
              <DialogTitle fontSize="md">{t('trading.tabs.analytics')}</DialogTitle>
            </Flex>
          </DialogHeader>
          <DialogCloseTrigger />

          <DialogBody px={4} py={3} overflowY="auto">
            {activeWalletId ? (
              <Stack gap={4}>
                {marginRequirements && (
                  <MarginInfoPanel requirements={marginRequirements} />
                )}
                <RiskDisplay walletId={activeWalletId} />
                <PerformancePanel walletId={activeWalletId} currency={activeWalletCurrency} />
                <SetupStatsTable walletId={activeWalletId} />
              </Stack>
            ) : (
              <Flex justify="center" py={8}>
                <Text color="fg.muted" fontSize="sm">{t('trading.noWalletSelected')}</Text>
              </Flex>
            )}
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
});

AnalyticsModal.displayName = 'AnalyticsModal';
