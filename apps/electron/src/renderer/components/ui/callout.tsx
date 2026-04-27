import { Box, Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu';

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

const TONE_STYLE: Record<CalloutTone, { bg: string; border: string; iconColor: string; icon: ReactNode }> = {
  info: { bg: 'blue.subtle', border: 'blue.muted', iconColor: 'blue.fg', icon: <LuInfo /> },
  success: { bg: 'green.subtle', border: 'green.muted', iconColor: 'green.fg', icon: <LuCircleCheck /> },
  warning: { bg: 'orange.subtle', border: 'orange.muted', iconColor: 'orange.fg', icon: <LuTriangleAlert /> },
  danger: { bg: 'red.subtle', border: 'red.muted', iconColor: 'red.fg', icon: <LuCircleAlert /> },
  neutral: { bg: 'bg.muted', border: 'border', iconColor: 'fg.muted', icon: <LuInfo /> },
};

export const Callout = ({ tone = 'info', title, icon, children, compact = false }: CalloutProps) => {
  const style = TONE_STYLE[tone];
  return (
    <Box
      bg={style.bg}
      borderWidth="1px"
      borderColor={style.border}
      borderRadius="md"
      px={compact ? 2.5 : 3}
      py={compact ? 1.5 : 2.5}
    >
      <Flex gap={2} align="flex-start">
        <Box color={style.iconColor} flexShrink={0} mt={0.5} fontSize="sm">
          {icon ?? style.icon}
        </Box>
        <Box flex={1} minW={0}>
          {title && (
            <Text fontSize="xs" fontWeight="semibold" color="fg" lineHeight="1.3">
              {title}
            </Text>
          )}
          {children && (
            <Text fontSize="2xs" color="fg.muted" lineHeight="1.4" mt={title ? 0.5 : 0}>
              {children}
            </Text>
          )}
        </Box>
      </Flex>
    </Box>
  );
};
