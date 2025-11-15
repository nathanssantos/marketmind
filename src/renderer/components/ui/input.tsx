import type { InputProps as ChakraInputProps } from '@chakra-ui/react';
import { Input as ChakraInput } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface InputProps extends ChakraInputProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraInput ref={ref} px={3} {...props} />;
});

Input.displayName = 'Input';

