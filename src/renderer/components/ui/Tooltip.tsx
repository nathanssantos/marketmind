import { Tooltip } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

interface TooltipWrapperProps {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  isDisabled?: boolean;
}

export const TooltipWrapper = ({ 
  label, 
  children, 
  placement = 'top',
  isDisabled = false 
}: TooltipWrapperProps): ReactElement => (
  <Tooltip.Root
    openDelay={300}
    closeDelay={0}
    disabled={isDisabled}
    positioning={{ placement }}
  >
    <Tooltip.Trigger asChild>
      {children}
    </Tooltip.Trigger>
    <Tooltip.Content>
      {label}
    </Tooltip.Content>
  </Tooltip.Root>
);
