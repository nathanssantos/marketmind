import { Box, Flex, Stack } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  contentGap?: number;
}

export const FormSection = ({ title, description, action, children, contentGap = 3 }: FormSectionProps) => (
  <Stack gap={2}>
    {(title ?? action) && (
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Box flex={1} minW={0}>
          {title && (
            <Box fontSize="sm" fontWeight="semibold" lineHeight="1.2">
              {title}
            </Box>
          )}
          {description && (
            <Box fontSize="xs" color="fg.muted" lineHeight="1.45" mt={0.5}>
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
      {label && <Box fontSize="xs" fontWeight="medium">{label}</Box>}
      {helper && <Box fontSize="2xs" color="fg.muted" mt={0.5} lineHeight="1.4">{helper}</Box>}
    </Box>
    <Flex align="center" gap={2} flexShrink={0}>
      {children}
      {action}
    </Flex>
  </Flex>
);
