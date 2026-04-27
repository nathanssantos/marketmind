import { Box, Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { MM } from '../../theme/tokens';

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * Standard header for dashboard-style panels inside dialogs/modals
 * (PerformancePanel, EquityCurveChart, PerformanceCalendar, etc.).
 *
 * Visual contract:
 * - Title at `MM.font.sectionTitle` (sm / semibold)
 * - Optional right-side action slot (period selector, month nav, etc.)
 * - Bottom border separator (`borderBottomWidth="1px" borderColor="border"`)
 * - `pb={2}` consistent breathing room before content
 *
 * Use when the panel needs visual separation between its title and body.
 * For section blocks within forms (no border), use `<FormSection>` instead.
 */
export const PanelHeader = ({ title, description, action }: PanelHeaderProps) => (
  <Flex
    justify="space-between"
    align={description ? 'flex-start' : 'center'}
    pb={2}
    borderBottomWidth="1px"
    borderColor="border"
    gap={MM.spacing.inline.gap}
    flexWrap="wrap"
  >
    <Box flex={1} minW={0}>
      <Text
        fontSize={MM.font.sectionTitle.size}
        fontWeight={MM.font.sectionTitle.weight}
        lineHeight={MM.lineHeight.title}
      >
        {title}
      </Text>
      {description && (
        <Text
          fontSize={MM.font.hint.size}
          color="fg.muted"
          mt={0.5}
          lineHeight={MM.lineHeight.hint}
        >
          {description}
        </Text>
      )}
    </Box>
    {action && <Box flexShrink={0}>{action}</Box>}
  </Flex>
);
