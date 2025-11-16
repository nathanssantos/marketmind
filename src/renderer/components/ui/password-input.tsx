import { Button } from '@/renderer/components/ui/button';
import type { InputProps } from '@/renderer/components/ui/input';
import { Input } from '@/renderer/components/ui/input';
import { Box } from '@chakra-ui/react';
import { forwardRef, useState } from 'react';
import { HiEye, HiEyeSlash } from 'react-icons/hi2';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [show, setShow] = useState(false);

  return (
    <Box position="relative">
      <Input
        {...(props as any)}
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
        {show ? <HiEyeSlash /> : <HiEye />}
      </Button>
    </Box>
  );
});

PasswordInput.displayName = 'PasswordInput';
