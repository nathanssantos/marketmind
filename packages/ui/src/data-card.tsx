import { Box, Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface DataCardProps {
  label: ReactNode;
  value: ReactNode;
  /**
   * Renders inline next to the value (small, muted) — for composites
   * like `42 / 5 watchers` where the secondary count belongs on the
   * same baseline as the primary value.
   */
  valueAside?: ReactNode;
  /**
   * Renders below the value (small, muted) — for context like
   * `Limit: -2%`, `Gross: $X · Fees: $Y`.
   */
  subtext?: ReactNode;
  /** Color for the primary value. Pass a semantic token (`trading.profit`, `trading.loss`, ...). */
  valueColor?: string;
}

/**
 * Stat-card primitive. The "label + value + optional subtext" shape used
 * across Risk/Performance/Orders summary surfaces. Replaces the ad-hoc
 * `<Box p={3} bg="bg.muted" borderRadius="md">` + manual `<Text>` stacks
 * each surface previously inlined.
 *
 * Pass `value` as a string for default styling (`fontSize="sm"
 * fontWeight="bold"`), or as a ReactNode for full custom rendering when
 * the card needs more than a single line.
 */
export const DataCard = ({
  label,
  value,
  valueAside,
  subtext,
  valueColor,
}: DataCardProps) => {
  const valueNode = typeof value === 'string' ? (
    <Text fontSize="sm" fontWeight="bold" color={valueColor}>
      {value}
    </Text>
  ) : value;

  return (
    <Box
      px={3}
      py={2}
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      h="100%"
    >
      <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">
        {label}
      </Text>
      {valueAside ? (
        <Flex align="baseline" gap={1}>
          {valueNode}
          <Text fontSize="2xs" color="fg.muted">{valueAside}</Text>
        </Flex>
      ) : valueNode}
      {subtext && (
        <Text fontSize="2xs" color="fg.muted">
          {subtext}
        </Text>
      )}
    </Box>
  );
};
