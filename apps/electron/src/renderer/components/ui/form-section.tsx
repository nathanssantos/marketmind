import { Box, Flex, Stack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { MM } from '../../theme/tokens';

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  contentGap?: number;
}

export const FormSection = ({
  title,
  description,
  action,
  children,
  contentGap = MM.spacing.row.gap,
}: FormSectionProps) => (
  <Stack gap={2}>
    {(title ?? action) && (
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Box flex={1} minW={0}>
          {title && (
            <Box
              fontSize={MM.font.sectionTitle.size}
              fontWeight={MM.font.sectionTitle.weight}
              lineHeight={MM.lineHeight.title}
            >
              {title}
            </Box>
          )}
          {description && (
            <Box
              fontSize={MM.font.body.size}
              color="fg.muted"
              lineHeight={MM.lineHeight.body}
              mt={0.5}
            >
              {description}
            </Box>
          )}
        </Box>
        {action && <Box flexShrink={0}>{action}</Box>}
      </Flex>
    )}
    <Stack gap={contentGap}>{children}</Stack>
  </Stack>
);

interface FormRowProps {
  label?: ReactNode;
  helper?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

export const FormRow = ({ label, helper, children, action }: FormRowProps) => (
  <Flex justify="space-between" align="center" gap={3} w="100%">
    <Box flex={1} minW={0}>
      {label && (
        <Box fontSize={MM.font.body.size} fontWeight="medium">
          {label}
        </Box>
      )}
      {helper && (
        <Box
          fontSize={MM.font.hint.size}
          color="fg.muted"
          mt={0.5}
          lineHeight={MM.lineHeight.hint}
        >
          {helper}
        </Box>
      )}
    </Box>
    <Flex align="center" gap={MM.spacing.inline.gap} flexShrink={0}>
      {children}
      {action}
    </Flex>
  </Flex>
);
