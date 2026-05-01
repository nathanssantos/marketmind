import type { ButtonProps as ChakraButtonProps } from '@chakra-ui/react';
import { Button as ChakraButton } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface ButtonProps extends ChakraButtonProps {}

const SIZE_CSS: Record<string, Record<string, string>> = {
  '2xs': {
    paddingInline: '8px !important',
    paddingBlock: '2px !important',
    minHeight: '20px !important',
    gap: '4px !important',
  },
  xs: {
    paddingInline: '10px !important',
    paddingBlock: '4px !important',
    minHeight: '24px !important',
    gap: '4px !important',
  },
  sm: {
    paddingInline: '12px !important',
    paddingBlock: '6px !important',
    minHeight: '28px !important',
    gap: '6px !important',
  },
  md: {
    paddingInline: '16px !important',
    paddingBlock: '8px !important',
    minHeight: '36px !important',
    gap: '8px !important',
  },
  lg: {
    paddingInline: '20px !important',
    paddingBlock: '10px !important',
    minHeight: '40px !important',
    gap: '8px !important',
  },
  xl: {
    paddingInline: '24px !important',
    paddingBlock: '12px !important',
    minHeight: '44px !important',
    gap: '10px !important',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ size = 'md', css, ...props }, ref) => {
    const sizeKey = typeof size === 'string' ? size : 'md';
    const sizeCss = SIZE_CSS[sizeKey] ?? SIZE_CSS['md']!;
    return <ChakraButton ref={ref} size={size} {...props} css={[sizeCss, css]} />;
  },
);

Button.displayName = 'Button';
