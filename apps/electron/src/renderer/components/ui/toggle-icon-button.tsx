import type { IconButtonProps } from './icon-button';
import { IconButton } from './icon-button';
import { forwardRef } from 'react';

export interface ToggleIconButtonProps extends Omit<IconButtonProps, 'variant' | 'colorPalette'> {
  active: boolean;
  activeColor?: string;
}

export const ToggleIconButton = forwardRef<HTMLButtonElement, ToggleIconButtonProps>(
  ({ active, activeColor = 'blue.500', ...props }, ref) => (
    // @ts-expect-error
    <IconButton
      ref={ref}
      variant="ghost"
      color={active ? activeColor : 'fg.muted'}
      {...props}
    />
  )
);

ToggleIconButton.displayName = 'ToggleIconButton';
