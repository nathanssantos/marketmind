import type { SeparatorProps as ChakraSeparatorProps } from '@chakra-ui/react';
import { Separator as ChakraSeparator } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface SeparatorProps extends ChakraSeparatorProps {}

export const Separator = forwardRef<HTMLHRElement, SeparatorProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraSeparator ref={ref} {...props} />;
});

Separator.displayName = 'Separator';
