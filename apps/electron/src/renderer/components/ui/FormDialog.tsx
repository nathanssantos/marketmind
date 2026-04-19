import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { CloseButton } from './close-button';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from './dialog';

type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: DialogSize;
  children: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitColorPalette?: string;
  submitDisabled?: boolean;
  hideFooter?: boolean;
  hideCloseButton?: boolean;
  bodyPadding?: number | string;
  contentMaxH?: string;
}

export const FormDialog = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  isLoading = false,
  onSubmit,
  submitLabel,
  submitColorPalette = 'blue',
  submitDisabled = false,
  hideFooter = false,
  hideCloseButton = false,
  bodyPadding = 4,
  contentMaxH,
}: FormDialogProps) => {
  const { t } = useTranslation();

  const handleOpenChange = (e: { open: boolean }) => {
    if (!e.open && !isLoading) onClose();
  };

  const defaultFooter = onSubmit && (
    <>
      <Button size="2xs" variant="ghost" onClick={onClose} disabled={isLoading} px={3}>
        {t('common.cancel')}
      </Button>
      <Button
        size="2xs"
        colorPalette={submitColorPalette}
        onClick={onSubmit}
        disabled={submitDisabled || isLoading}
        loading={isLoading}
        px={3}
      >
        {submitLabel ?? t('common.save')}
      </Button>
    </>
  );

  return (
    <DialogRoot open={isOpen} onOpenChange={handleOpenChange} size={size}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent maxH={contentMaxH}>
          <DialogHeader px={4} pt={4}>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {!hideCloseButton && (
            <DialogCloseTrigger asChild>
              <CloseButton size="sm" />
            </DialogCloseTrigger>
          )}

          <DialogBody p={bodyPadding} overflowY={contentMaxH ? 'auto' : undefined}>{children}</DialogBody>

          {!hideFooter && (
            <DialogFooter px={4} pb={4}>
              {footer ?? defaultFooter}
            </DialogFooter>
          )}
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
