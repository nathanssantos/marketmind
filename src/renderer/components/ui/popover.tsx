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
  usePortal?: boolean;
}

export const Popover = ({
  trigger,
  children,
  open,
  onOpenChange,
  width = '320px',
  showArrow = false,
  usePortal = true,
}: PopoverProps) => {
  const positioner = (
    <ChakraPopover.Positioner>
      <ChakraPopover.Content width={width}>
        {showArrow && (
          <ChakraPopover.Arrow>
            <ChakraPopover.ArrowTip />
          </ChakraPopover.Arrow>
        )}
        <ChakraPopover.Body p={0}>{children}</ChakraPopover.Body>
      </ChakraPopover.Content>
    </ChakraPopover.Positioner>
  );

  return (
    <ChakraPopover.Root open={open} onOpenChange={onOpenChange}>
      <ChakraPopover.Trigger asChild>{trigger}</ChakraPopover.Trigger>
      {usePortal ? <Portal>{positioner}</Portal> : positioner}
    </ChakraPopover.Root>
  );
};
