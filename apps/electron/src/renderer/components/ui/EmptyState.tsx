import { Box, Icon, Text, VStack } from '@chakra-ui/react';
import type { ComponentType, ReactNode } from 'react';
import { LuInbox } from 'react-icons/lu';
import { Button } from './button';

interface EmptyStateProps {
  icon?: ComponentType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    colorPalette?: string;
    icon?: ReactNode;
  };
  size?: 'sm' | 'md' | 'lg';
  /**
   * When true, wraps the empty state in a dashed-border card. Use when the
   * surrounding surface doesn't already have its own card/panel framing.
   */
  dashed?: boolean;
  children?: ReactNode;
}

const sizeConfig = {
  sm: { iconSize: 6, titleSize: 'sm', descSize: 'xs', gap: 2, py: 4 },
  md: { iconSize: 8, titleSize: 'md', descSize: 'sm', gap: 3, py: 6 },
  lg: { iconSize: 10, titleSize: 'lg', descSize: 'md', gap: 4, py: 8 },
} as const;

export const EmptyState = ({
  icon: IconComponent = LuInbox,
  title,
  description,
  action,
  size = 'md',
  dashed = false,
  children,
}: EmptyStateProps) => {
  const config = sizeConfig[size];

  const content = (
    <VStack gap={config.gap} py={config.py} align="center" justify="center" w="100%">
      <Box color="fg.muted">
        <Icon as={IconComponent} boxSize={config.iconSize} />
      </Box>
      <VStack gap={1} textAlign="center">
        <Text fontSize={config.titleSize} fontWeight="medium" color="fg.subtle">
          {title}
        </Text>
        {description && (
          <Text fontSize={config.descSize} color="fg.muted" maxW="sm">
            {description}
          </Text>
        )}
      </VStack>
      {action && (
        <Button
          size={size === 'sm' ? '2xs' : 'xs'}
          variant="outline"
          colorPalette={action.colorPalette}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      )}
      {children}
    </VStack>
  );

  if (dashed) {
    return (
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        borderRadius="md"
        px={4}
      >
        {content}
      </Box>
    );
  }

  return content;
};
