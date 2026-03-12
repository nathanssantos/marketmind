import type { CloseButtonProps as ChakraCloseButtonProps } from '@chakra-ui/react';
import { CloseButton as ChakraCloseButton } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface CloseButtonProps extends ChakraCloseButtonProps {}

export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraCloseButton ref={ref} {...props} />;
});

CloseButton.displayName = 'CloseButton';
