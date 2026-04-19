import type { BoxProps } from '@chakra-ui/react';
import { Box } from '@chakra-ui/react';
import { forwardRef } from 'react';

type BadgeVariant = 'solid' | 'subtle' | 'outline' | 'surface' | 'plain';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps extends Omit<BoxProps, 'size'> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  colorPalette?: string;
}

const SIZE_CSS: Record<BadgeSize, Record<string, string>> = {
  xs: {
    paddingInline: '6px !important',
    paddingBlock: '2px !important',
    minHeight: '18px !important',
    gap: '4px !important',
    fontSize: 'var(--chakra-font-sizes-2xs) !important',
  },
  sm: {
    paddingInline: '8px !important',
    paddingBlock: '3px !important',
    minHeight: '20px !important',
    gap: '4px !important',
    fontSize: 'var(--chakra-font-sizes-xs) !important',
  },
  md: {
    paddingInline: '10px !important',
    paddingBlock: '4px !important',
    minHeight: '22px !important',
    gap: '6px !important',
    fontSize: 'var(--chakra-font-sizes-sm) !important',
  },
  lg: {
    paddingInline: '12px !important',
    paddingBlock: '5px !important',
    minHeight: '26px !important',
    gap: '6px !important',
    fontSize: 'var(--chakra-font-sizes-sm) !important',
  },
};

const VARIANT_PROPS: Record<BadgeVariant, BoxProps> = {
  solid: { bg: 'colorPalette.solid', color: 'colorPalette.contrast' },
  subtle: { bg: 'colorPalette.subtle', color: 'colorPalette.fg' },
  outline: { borderWidth: '1px', borderColor: 'colorPalette.muted', color: 'colorPalette.fg' },
  surface: { bg: 'colorPalette.subtle', color: 'colorPalette.fg', borderWidth: '1px', borderColor: 'colorPalette.muted' },
  plain: { color: 'colorPalette.fg' },
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'subtle', size = 'sm', colorPalette = 'gray', css, ...rest }, ref) => (
    <Box
      ref={ref}
      as="span"
      colorPalette={colorPalette}
      display="inline-flex"
      alignItems="center"
      borderRadius="sm"
      fontWeight="medium"
      whiteSpace="nowrap"
      lineHeight="1"
      {...VARIANT_PROPS[variant]}
      {...rest}
      css={[SIZE_CSS[size], css]}
    />
  ),
);

Badge.displayName = 'Badge';
