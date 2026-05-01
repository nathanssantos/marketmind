import { DialogShell } from '@renderer/components/ui';
import type { DialogControlProps } from '@marketmind/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSymbolsTab } from './CustomSymbolsTab';

type CustomSymbolsDialogProps = DialogControlProps;

/**
 * Dedicated custom-symbols-management dialog. Opened from the
 * SymbolSelector popover. Per the v1.6 UX rule "Settings is for prefs,
 * not records you create", custom symbols graduated out of the
 * Settings Custom Symbols tab in A.5 Stage 4.
 *
 * The body keeps using the existing CustomSymbolsTab component (which
 * is named `Tab` historically; the rename is a cleanup follow-up).
 */
export const CustomSymbolsDialog = memo(({ isOpen, onClose }: CustomSymbolsDialogProps) => {
  const { t } = useTranslation();
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('customSymbols.title')}
      description={t('customSymbols.dialogDescription')}
      hideFooter
    >
      <CustomSymbolsTab />
    </DialogShell>
  );
});

CustomSymbolsDialog.displayName = 'CustomSymbolsDialog';
