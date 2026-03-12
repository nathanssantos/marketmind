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
  };
  size?: 'sm' | 'md' | 'lg';
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
  children,
}: EmptyStateProps) => {
  const config = sizeConfig[size];

  return (
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
          {action.label}
        </Button>
      )}
      {children}
    </VStack>
  );
};
