import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { MM } from '@marketmind/tokens';
import type { ReactNode } from 'react';

export interface DialogSectionProps {
  /** Section heading. Optional — sections without a title still get the structural rhythm. */
  title?: ReactNode;
  /** Section helper text shown below the title. */
  description?: ReactNode;
  /** Optional inline action rendered on the right of the heading (e.g. "Reset to defaults"). */
  action?: ReactNode;
  children: ReactNode;
  /** Override the body gap (defaults to `MM.spacing.row.gap`). */
  gap?: number;
}

/**
 * Composable section primitive for the body of a `<DialogShell>`.
 *
 * Consistent rhythm across dialogs: title at `MM.typography.sectionTitle`
 * (smaller than the dialog title — clear hierarchy), description at
 * `MM.typography.sectionDescription`, body fields stacked at
 * `MM.spacing.row.gap`. Designed to also work outside dialogs (sidebar
 * panels, settings tabs) so v1.7+ surfaces can adopt it without
 * rename pressure.
 *
 * v1.6 Track A.2.
 */
export const DialogSection = ({
  title,
  description,
  action,
  children,
  gap = MM.spacing.row.gap,
}: DialogSectionProps) => {
  return (
    <Box>
      {(title !== undefined || action !== undefined || description !== undefined) && (
        <Flex
          align="flex-start"
          justify="space-between"
          gap={3}
          mb={2}
        >
          <Box flex={1} minW={0}>
            {title !== undefined && (
              <Text
                fontSize={MM.typography.sectionTitle.fontSize}
                fontWeight={MM.typography.sectionTitle.fontWeight}
              >
                {title}
              </Text>
            )}
            {description !== undefined && (
              <Text
                fontSize={MM.typography.sectionDescription.fontSize}
                color={MM.typography.sectionDescription.color}
                lineHeight={MM.typography.sectionDescription.lineHeight}
                mt={0.5}
              >
                {description}
              </Text>
            )}
          </Box>
          {action !== undefined && <Box flexShrink={0}>{action}</Box>}
        </Flex>
      )}
      <Stack gap={gap}>{children}</Stack>
    </Box>
  );
};
