import type { BadgeProps as ChakraBadgeProps } from '@chakra-ui/react';
import { Badge as ChakraBadge } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface BadgeProps extends ChakraBadgeProps {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraBadge ref={ref} {...props} />;
});

Badge.displayName = 'Badge';
