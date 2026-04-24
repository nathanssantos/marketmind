import { forwardRef } from 'react';
import { Badge } from './badge';

export interface BetaBadgeProps {
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'subtle' | 'outline' | 'surface' | 'plain';
  colorPalette?: string;
}

export const BetaBadge = forwardRef<HTMLSpanElement, BetaBadgeProps>(
  ({ label = 'BETA', size = 'xs', variant = 'subtle', colorPalette = 'orange' }, ref) => (
    <Badge ref={ref} size={size} variant={variant} colorPalette={colorPalette} fontWeight="semibold">
      {label}
    </Badge>
  ),
);

BetaBadge.displayName = 'BetaBadge';
