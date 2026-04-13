import { Menu as ChakraMenu } from '@chakra-ui/react';
import type { ComponentProps } from 'react';

const StyledContent = (props: ComponentProps<typeof ChakraMenu.Content>) => (
  <ChakraMenu.Content
    css={{
      '& [data-part="item"]': {
        padding: '6px 12px',
        gap: '8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
      },
      '& [data-part="item-group-label"]': {
        padding: '6px 12px 2px',
        fontSize: '0.75rem',
        fontWeight: 600,
        opacity: 0.6,
      },
    }}
    {...props}
  />
);

export const Menu = {
  Root: ChakraMenu.Root,
  Trigger: ChakraMenu.Trigger,
  Positioner: ChakraMenu.Positioner,
  Content: StyledContent,
  Item: ChakraMenu.Item,
  ItemGroup: ChakraMenu.ItemGroup,
  ItemGroupLabel: ChakraMenu.ItemGroupLabel,
  Separator: ChakraMenu.Separator,
  ContextTrigger: ChakraMenu.ContextTrigger,
};
