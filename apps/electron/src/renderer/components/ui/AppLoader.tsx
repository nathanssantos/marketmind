import { Flex } from '@chakra-ui/react';
import { Logo } from '@marketmind/ui';

/**
 * Top-level "app is booting" loader. Renders just the MarketMind
 * logo, centered. Matches the pre-React boot loader (inline SVG of
 * the same logo in `index.html`) so the cold-load → React-mount
 * transition has no visual flicker.
 */
export const AppLoader = () => (
  <Flex
    align="center"
    justify="center"
    h="100vh"
    w="100%"
    bg="bg"
  >
    <Logo size={64} />
  </Flex>
);
