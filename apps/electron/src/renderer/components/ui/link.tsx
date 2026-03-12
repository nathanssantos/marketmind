import type { LinkProps as ChakraLinkProps } from '@chakra-ui/react';
import { Link as ChakraLink } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface LinkProps extends ChakraLinkProps {}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraLink ref={ref} {...props} />;
});

Link.displayName = 'Link';
