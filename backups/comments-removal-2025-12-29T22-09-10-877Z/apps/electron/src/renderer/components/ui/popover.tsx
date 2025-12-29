import {
  Popover as ChakraPopover,
  Portal,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (details: { open: boolean }) => void;
  width?: string;
  showArrow?: boolean;
  positioning?: {
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
    offset?: { mainAxis?: number; crossAxis?: number };
  };
}

export const Popover = ({
  trigger,
  children,
  open,
  onOpenChange,
  width = '320px',
  showArrow = false,
  positioning,
}: PopoverProps) => {
  return (
    <ChakraPopover.Root
      open={open}
      onOpenChange={onOpenChange}
      positioning={positioning}
    >
      <ChakraPopover.Trigger asChild>{trigger}</ChakraPopover.Trigger>
      {open && (
        <Portal>
          <ChakraPopover.Positioner zIndex={9999}>
            <ChakraPopover.Content width={width}>
              {showArrow && (
                <ChakraPopover.Arrow>
                  <ChakraPopover.ArrowTip />
                </ChakraPopover.Arrow>
              )}
              <ChakraPopover.Body p={0}>{children}</ChakraPopover.Body>
            </ChakraPopover.Content>
          </ChakraPopover.Positioner>
        </Portal>
      )}
    </ChakraPopover.Root>
  );
};
