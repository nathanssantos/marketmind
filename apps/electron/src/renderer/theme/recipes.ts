import { defineRecipe, defineSlotRecipe } from '@chakra-ui/react';

export const badgeRecipe = defineRecipe({
  base: { px: 1.5, py: 0.5, borderRadius: 'sm', fontSize: '2xs', fontWeight: 'medium' },
  variants: {
    variant: {
      interval: { bg: { base: 'blue.100', _dark: 'blue.900' }, color: { base: 'blue.800', _dark: 'blue.200' } },
      futures: { bg: { base: 'orange.100', _dark: 'orange.900' }, color: { base: 'orange.800', _dark: 'orange.200' } },
      spot: { bg: { base: 'green.100', _dark: 'green.900' }, color: { base: 'green.800', _dark: 'green.200' } },
      count: { bg: { base: 'green.100', _dark: 'green.900' }, color: { base: 'green.800', _dark: 'green.200' }, borderRadius: 'full', fontSize: 'xs' },
      active: { bg: { base: 'purple.100', _dark: 'purple.900' }, color: { base: 'purple.800', _dark: 'purple.200' }, borderRadius: 'full', fontSize: 'xs' },
      autoRotation: { bg: { base: 'blue.100', _dark: 'blue.900' }, color: { base: 'blue.800', _dark: 'blue.200' }, borderRadius: 'full', fontSize: 'xs' },
    },
  },
});

export const collapsibleSectionRecipe = defineSlotRecipe({
  slots: ['root', 'trigger', 'title', 'description', 'content'],
  base: {
    trigger: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      w: '100%',
      cursor: 'pointer',
      _hover: { bg: 'bg.subtle' },
      borderRadius: 'md',
      px: 2,
      bg: 'transparent',
      border: 'none',
      textAlign: 'left',
    },
    title: { fontWeight: 'bold' },
    description: { color: 'fg.muted' },
  },
  variants: {
    size: {
      sm: { trigger: { py: 2 }, title: { fontSize: 'xs', fontWeight: 'semibold' }, description: { fontSize: 'xs' } },
      md: { trigger: { py: 3 }, title: { fontSize: 'sm', fontWeight: 'semibold' }, description: { fontSize: 'xs' } },
      lg: { trigger: { py: 2 }, title: { fontSize: 'lg' }, description: { fontSize: 'sm' } },
    },
  },
  defaultVariants: { size: 'lg' },
});

export const filterToggleRecipe = defineSlotRecipe({
  slots: ['root', 'label', 'description'],
  base: {
    root: { p: 3, bg: 'bg.muted', borderRadius: 'md', borderWidth: '1px' },
    label: { fontSize: 'sm', fontWeight: 'medium' },
    description: { fontSize: 'xs', color: 'fg.muted', mt: 1 },
  },
  variants: {
    status: {
      active: { root: { borderColor: 'green.500' } },
      inactive: { root: { borderColor: 'border' } },
      disabled: { root: { borderColor: 'border', opacity: 0.45 } },
    },
  },
  defaultVariants: { status: 'inactive' },
});
