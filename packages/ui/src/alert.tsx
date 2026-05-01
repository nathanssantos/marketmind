import type { AlertRootProps as ChakraAlertRootProps } from '@chakra-ui/react';
import { Alert as ChakraAlert } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface AlertRootProps extends ChakraAlertRootProps {}

const AlertRoot = forwardRef<HTMLDivElement, AlertRootProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraAlert.Root ref={ref} {...props} />;
});

AlertRoot.displayName = 'AlertRoot';

export const Alert = {
  Root: AlertRoot,
  Title: ChakraAlert.Title,
  Description: ChakraAlert.Description,
  Indicator: ChakraAlert.Indicator,
  Content: ChakraAlert.Content,
};
