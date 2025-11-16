import {
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
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
  zIndex?: number;
}

export const Popover = ({
  trigger,
  children,
  open,
  onOpenChange,
  width = '320px',
  showArrow = true,
  usePortal = true,
  zIndex = 9999,
}: PopoverProps) => {
  const content = (
    <PopoverContent width={width} zIndex={zIndex}>
      {showArrow && <PopoverArrow />}
      <PopoverBody p={0}>{children}</PopoverBody>
    </PopoverContent>
  );

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {usePortal ? <Portal>{content}</Portal> : content}
    </PopoverRoot>
  );
};
