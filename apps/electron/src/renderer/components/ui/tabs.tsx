import { Tabs as ChakraTabs } from '@chakra-ui/react';
import { forwardRef } from 'react';

const TabsTrigger = forwardRef<HTMLButtonElement, any>(({ px = 4, py = 2, ...props }, ref) => (
  // @ts-expect-error
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

