import type { ButtonProps as ChakraButtonProps } from '@chakra-ui/react';
import { Button as ChakraButton } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface ButtonProps extends ChakraButtonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ px = 4, ...props }, ref) => {
  // @ts-expect-error
  return <ChakraButton ref={ref} px={px} {...props} />;
});

Button.displayName = 'Button';

