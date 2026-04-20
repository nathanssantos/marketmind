import { Stack, Text } from '@chakra-ui/react';
import { FormDialog, Input } from '@renderer/components/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SaveScreenerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  isLoading: boolean;
}

export const SaveScreenerDialog = memo(({ isOpen, onClose, onSave, isLoading }: SaveScreenerDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    await onSave(name.trim());
    setName('');
    onClose();
  }, [name, onSave, onClose]);

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('screener.save.title')}
      size="sm"
      onSubmit={() => { void handleSave(); }}
      submitLabel={t('common.save')}
      isLoading={isLoading}
      submitDisabled={!name.trim()}
    >
      <Stack gap={2}>
        <Text fontSize="sm" color="fg.muted">{t('screener.save.description')}</Text>
        <Input
          size="sm"
          placeholder={t('screener.save.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Stack>
    </FormDialog>
  );
});

SaveScreenerDialog.displayName = 'SaveScreenerDialog';
