import type { TextareaProps as ChakraTextareaProps } from '@chakra-ui/react';
import { Textarea as ChakraTextarea } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface TextareaProps extends ChakraTextareaProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraTextarea ref={ref} {...props} />;
});

Textarea.displayName = 'Textarea';
