import type {
  DialogActionTriggerProps,
  DialogBackdropProps,
  DialogBodyProps,
  DialogCloseTriggerProps,
  DialogContentProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogPositionerProps,
  DialogRootProps,
  DialogTitleProps,
} from '@chakra-ui/react';
import {
  DialogActionTrigger as ChakraDialogActionTrigger,
  DialogBackdrop as ChakraDialogBackdrop,
  DialogBody as ChakraDialogBody,
  DialogCloseTrigger as ChakraDialogCloseTrigger,
  DialogContent as ChakraDialogContent,
  DialogFooter as ChakraDialogFooter,
  DialogHeader as ChakraDialogHeader,
  DialogPositioner as ChakraDialogPositioner,
  DialogRoot as ChakraDialogRoot,
  DialogTitle as ChakraDialogTitle,
  Portal,
} from '@chakra-ui/react';

export const DialogRoot = ({ placement = 'center', ...props }: DialogRootProps) => {
  return <ChakraDialogRoot placement={placement} {...props} />;
};

// Wrap Backdrop + Positioner in <Portal> so dialogs render at the document
// root and escape any parent overflow:hidden — required since v1.10 because
// dialogs are now triggered from inside grid panels (panel shells use
// overflow:hidden to clip their content). Without portaling the dialog
// would be clipped to the panel's bounds, often making the action buttons
// unreachable.
export const DialogBackdrop = (props: DialogBackdropProps) => {
  return (
    <Portal>
      {/* @ts-expect-error */}
      <ChakraDialogBackdrop {...props} />
    </Portal>
  );
};

export const DialogPositioner = (props: DialogPositionerProps) => {
  return (
    <Portal>
      {/* @ts-expect-error */}
      <ChakraDialogPositioner {...props} />
    </Portal>
  );
};

export const DialogContent = (props: DialogContentProps) => {
  // @ts-expect-error
  return <ChakraDialogContent {...props} />;
};

export const DialogHeader = ({ px = 6, py = 4, ...props }: DialogHeaderProps) => {
  // @ts-expect-error
  return <ChakraDialogHeader px={px} py={py} {...props} />;
};

export const DialogTitle = (props: DialogTitleProps) => {
  // @ts-expect-error
  return <ChakraDialogTitle {...props} />;
};

export const DialogBody = ({ px = 6, py = 4, ...props }: DialogBodyProps) => {
  // @ts-expect-error
  return <ChakraDialogBody px={px} py={py} {...props} />;
};

export const DialogFooter = ({ px = 6, py = 4, ...props }: DialogFooterProps) => {
  // @ts-expect-error
  return <ChakraDialogFooter px={px} py={py} {...props} />;
};

export const DialogCloseTrigger = ({ 'aria-label': ariaLabel, ...props }: DialogCloseTriggerProps) => {
  // @ts-expect-error
  return <ChakraDialogCloseTrigger aria-label={ariaLabel ?? 'Close'} {...props} />;
};

export const DialogActionTrigger = (props: DialogActionTriggerProps) => {
  // @ts-expect-error
  return <ChakraDialogActionTrigger {...props} />;
};

export const Dialog = {
  Root: DialogRoot,
  Backdrop: DialogBackdrop,
  Positioner: DialogPositioner,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Body: DialogBody,
  Footer: DialogFooter,
  CloseTrigger: DialogCloseTrigger,
  ActionTrigger: DialogActionTrigger,
};

