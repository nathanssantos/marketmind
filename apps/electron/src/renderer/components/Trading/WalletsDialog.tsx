import { DialogShell } from '@renderer/components/ui';
import type { DialogControlProps } from '@marketmind/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { WalletManager } from './WalletManager';

type WalletsDialogProps = DialogControlProps;

/**
 * Dedicated wallets-management dialog. Opened from the WalletSelector
 * popover (header). Per the v1.6 UX rule "Settings is for prefs, not
 * records you create", wallets graduated out of the Settings Wallets
 * tab in A.5 Stage 3.
 */
export const WalletsDialog = memo(({ isOpen, onClose }: WalletsDialogProps) => {
  const { t } = useTranslation();
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('trading.wallets.title')}
      hideFooter
    >
      <WalletManager />
    </DialogShell>
  );
});

WalletsDialog.displayName = 'WalletsDialog';
