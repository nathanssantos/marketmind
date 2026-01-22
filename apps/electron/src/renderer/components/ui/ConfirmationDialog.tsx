import { Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import {
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from './dialog';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  colorPalette?: 'red' | 'blue' | 'green' | 'orange';
  isLoading?: boolean;
  isDestructive?: boolean;
}

export const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  colorPalette,
  isLoading = false,
  isDestructive = false,
}: ConfirmationDialogProps) => {
  const { t } = useTranslation();

  const resolvedColorPalette = colorPalette ?? (isDestructive ? 'red' : 'blue');

  const handleOpenChange = (e: { open: boolean }) => {
    if (!e.open && !isLoading) onClose();
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={handleOpenChange} size="sm">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader px={4} pt={4}>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {description && (
            <DialogBody px={4} py={2}>
              <VStack align="start" gap={2}>
                {typeof description === 'string' ? (
                  <Text fontSize="sm" color="fg.muted">
                    {description}
                  </Text>
                ) : (
                  description
                )}
              </VStack>
            </DialogBody>
          )}

          <DialogFooter px={4} py={4}>
            <Button size="2xs" variant="ghost" onClick={onClose} disabled={isLoading} px={3}>
              {cancelLabel ?? t('common.cancel')}
            </Button>
            <Button
              size="2xs"
              colorPalette={resolvedColorPalette}
              onClick={handleConfirm}
              loading={isLoading}
              px={3}
            >
              {confirmLabel ?? (isDestructive ? t('common.delete') : t('common.save'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
