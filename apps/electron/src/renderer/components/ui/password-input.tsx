import { Button } from './button';
import type { InputProps } from './input';
import { Input } from './input';
import { Box } from '@chakra-ui/react';
import { forwardRef, useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [show, setShow] = useState(false);

  return (
    <Box position="relative" width="100%">
      {/* @ts-expect-error Chakra Input CSS prop interop */}
      <Input
        {...props}
        ref={ref}
        type={show ? 'text' : 'password'}
        pr="44px"
      />
      <Button
        position="absolute"
        right="4px"
        top="50%"
        transform="translateY(-50%)"
        size="sm"
        variant="ghost"
        onClick={() => setShow(!show)}
        disabled={props.disabled}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <LuEyeOff /> : <LuEye />}
      </Button>
    </Box>
  );
});

PasswordInput.displayName = 'PasswordInput';
