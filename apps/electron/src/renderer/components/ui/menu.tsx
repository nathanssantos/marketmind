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
