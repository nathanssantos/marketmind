import { Flex, Spinner } from '@chakra-ui/react';
import { MM } from '@marketmind/tokens';

/**
 * Canonical panel-fill loading spinner. No text, no absolute
 * positioning. Fills the parent's height (h="100%") and is centered
 * both axes — drop directly into any panel that wants the standard
 * "panel is loading" look. Pair with a parent that has bounded
 * height (Box/Flex with explicit h or flex=1 inside a column).
 *
 * Inline button/icon spinners (size="xs", size="sm" inside menus)
 * keep the raw Chakra <Spinner /> since they need different sizing
 * rules and DON'T want full-height centering.
 */
export const LoadingSpinner = () => (
  <Flex justify="center" align="center" h="100%" w="100%" minH={MM.spinner.panel.py}>
    <Spinner size={MM.spinner.panel.size} />
  </Flex>
);
