import { Dialog } from '@/renderer/components/ui/dialog';
import { CloseButton, Separator, Stack } from '@chakra-ui/react';
import { TradingProfilesManager } from '@renderer/components/Trading/TradingProfilesManager';
import { WatcherManager } from '@renderer/components/Trading/WatcherManager';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface TradingProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradingProfilesModal = memo(({ isOpen, onClose }: TradingProfilesModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh" maxW="1000px">
          <CloseButton
            position="absolute"
            top={4}
            right={4}
            onClick={onClose}
            size="sm"
          />
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>{t('tradingProfiles.modalTitle')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body overflowY="auto" pb={6}>
            <Stack gap={6}>
              <TradingProfilesManager />
              <Separator />
              <WatcherManager />
            </Stack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
});

TradingProfilesModal.displayName = 'TradingProfilesModal';
