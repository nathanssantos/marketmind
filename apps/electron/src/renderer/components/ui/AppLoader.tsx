import { Box, Flex } from '@chakra-ui/react';
import { Logo, ProgressBar, ProgressRoot } from '@marketmind/ui';

/**
 * Top-level "app is booting" loader. Used by AuthGuard while auth
 * resolves and any other gate that holds the entire screen before
 * the main UI mounts. Renders the MarketMind logo above an
 * indeterminate progress bar — visually richer than a bare spinner
 * and consistent with the app's branding.
 */
export const AppLoader = () => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    h="100vh"
    w="100%"
    gap={6}
    bg="bg"
  >
    <Logo size={64} />
    <Box w="220px">
      <ProgressRoot value={null} size="xs">
        <ProgressBar />
      </ProgressRoot>
    </Box>
  </Flex>
);
