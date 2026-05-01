import { DialogShell, Field, Input } from '@renderer/components/ui';
import type { DialogControlProps } from '@marketmind/types';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SaveScreenerDialogProps extends DialogControlProps {
  onSave: (name: string) => Promise<void>;
  isLoading: boolean;
}

export const SaveScreenerDialog = memo(({ isOpen, onClose, onSave, isLoading }: SaveScreenerDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    setName('');
    onClose();
  }, [name, onSave, onClose]);

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('screener.dialogs.saveScreener.title')}
      description={t('screener.dialogs.saveScreener.description')}
      size="sm"
      onSubmit={() => { void handleSubmit(); }}
      submitLabel={t('screener.dialogs.saveScreener.submit')}
      submitDisabled={!name.trim()}
      isLoading={isLoading}
    >
      <Field label={t('screener.dialogs.saveScreener.field.name.label')}>
        <Input
          size="sm"
          placeholder={t('screener.dialogs.saveScreener.field.name.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
    </DialogShell>
  );
});

SaveScreenerDialog.displayName = 'SaveScreenerDialog';
