import type { IconButtonProps as ChakraIconButtonProps } from '@chakra-ui/react';
import { IconButton as ChakraIconButton } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface IconButtonProps extends ChakraIconButtonProps {}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraIconButton ref={ref} {...props} />;
});

IconButton.displayName = 'IconButton';
