import type { ReactNode } from 'react';
import { DialogShell, type DialogSize } from './dialog-shell';

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
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

/**
 * Alias of <DialogShell> kept for the migration window so the 7 existing
 * callsites don't need to change in the same PR as the v1.6 primitive
 * landing. New code should prefer <DialogShell> directly.
 *
 * v1.6 Track A.1 — alias.
 */
export const FormDialog = (props: FormDialogProps) => <DialogShell {...props} />;
