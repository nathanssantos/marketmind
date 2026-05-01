import { Field as ChakraField } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export interface FieldProps {
  label?: string;
  helperText?: string | undefined;
  errorText?: string;
  required?: boolean;
  invalid?: boolean;
  children: ReactNode;
}

export const Field = (props: FieldProps) => {
  const { label, helperText, errorText, required, invalid, children } = props;
  
  return (
    <ChakraField.Root required={required} invalid={invalid}>
      {label && <ChakraField.Label>{label}</ChakraField.Label>}
      {children}
      {helperText && <ChakraField.HelperText>{helperText}</ChakraField.HelperText>}
      {errorText && <ChakraField.ErrorText>{errorText}</ChakraField.ErrorText>}
    </ChakraField.Root>
  );
};
