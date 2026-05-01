import { Tabs as ChakraTabs } from '@chakra-ui/react';
import type { ComponentProps } from 'react';
import { forwardRef } from 'react';

type TabsTriggerProps = ComponentProps<typeof ChakraTabs.Trigger>;

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(({ px = 4, py = 2, ...props }, ref) => (
  // @ts-expect-error Chakra v3 accentColor Trigger spread type conflict
  <ChakraTabs.Trigger ref={ref} px={px} py={py} {...props} />
));
TabsTrigger.displayName = 'TabsTrigger';

export const Tabs = {
  Root: ChakraTabs.Root,
  List: ChakraTabs.List,
  Trigger: TabsTrigger,
  Content: ChakraTabs.Content,
  Indicator: ChakraTabs.Indicator,
  ContentGroup: ChakraTabs.ContentGroup,
};

