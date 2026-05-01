import { DialogShell, Separator } from '@renderer/components/ui';
import { SetupToggleSection } from '@renderer/components/Trading/SetupToggleSection';
import { WatcherManager } from '@renderer/components/Trading/WatcherManager';
import type { DialogControlProps } from '@marketmind/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TradingProfilesDialogProps = DialogControlProps;

export const TradingProfilesDialog = memo(({ isOpen, onClose }: TradingProfilesDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('tradingProfiles.modalTitle')}
      hideFooter
    >
      <WatcherManager />
      <Separator />
      <SetupToggleSection />
    </DialogShell>
  );
});

TradingProfilesDialog.displayName = 'TradingProfilesDialog';
