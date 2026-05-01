import { Stack } from '@chakra-ui/react';
import { CloseButton, Dialog, Separator } from '@renderer/components/ui';
import { SetupToggleSection } from '@renderer/components/Trading/SetupToggleSection';
import { WatcherManager } from '@renderer/components/Trading/WatcherManager';
import type { DialogControlProps } from '@marketmind/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TradingProfilesDialogProps = DialogControlProps;

export const TradingProfilesDialog = memo(({ isOpen, onClose }: TradingProfilesDialogProps) => {
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
              <WatcherManager />
              <Separator />
              <SetupToggleSection />
            </Stack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
});

TradingProfilesDialog.displayName = 'TradingProfilesDialog';
