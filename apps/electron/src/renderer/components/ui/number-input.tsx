import type { InputProps } from './input';
import { Input } from './input';
import { forwardRef } from 'react';

export interface NumberInputProps extends Omit<InputProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({ min, max, step, ...props }, ref) => {
  return (
    // @ts-expect-error - Chakra UI type conflict
    <Input
      {...props}
      ref={ref}
      type="number"
      min={min}
      max={max}
      step={step}
    />
  );
});

NumberInput.displayName = 'NumberInput';
