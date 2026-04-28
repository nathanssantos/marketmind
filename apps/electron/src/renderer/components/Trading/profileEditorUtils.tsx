import { Box, HStack, Text } from '@chakra-ui/react';
import { Switch } from '@renderer/components/ui';
import type { TradingProfile } from '@marketmind/types';
import { PROFILE_CONFIG_KEYS } from '@marketmind/types';
import type { ReactNode } from 'react';

export const extractConfigOverrides = (profile: TradingProfile): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {};
  for (const key of PROFILE_CONFIG_KEYS) {
    const value = profile[key];
    if (value !== null && value !== undefined) overrides[key] = value;
  }
  return overrides;
};

export const ovNum = (overrides: Record<string, unknown>, key: string, fallback: number): number => {
  const v = overrides[key];
  return typeof v === 'number' ? v : fallback;
};

export const ovStr = (overrides: Record<string, unknown>, key: string, fallback: string): string => {
  const v = overrides[key];
  return typeof v === 'string' ? v : fallback;
};

export const ovBool = (overrides: Record<string, unknown>, key: string): boolean => overrides[key] === true;

export const OverrideBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <Box
      px={2}
      py={0.5}
      bg="blue.subtle"
      color="blue.fg"
      borderRadius="full"
      fontSize="xs"
      fontWeight="medium"
    >
      {count}
    </Box>
  );
};

export interface OverrideRowProps {
  label: string;
  description?: string;
  isActive: boolean;
  onToggle: (checked: boolean) => void;
  children?: ReactNode;
}

export const OverrideRow = ({ label, description, isActive, onToggle, children }: OverrideRowProps) => (
  <Box>
    <HStack justify="space-between">
      <Box>
        <Text fontSize="sm" fontWeight="medium">{label}</Text>
        {!isActive && description && (
          <Text fontSize="xs" color="fg.muted">{description}</Text>
        )}
      </Box>
      <Switch checked={isActive} onCheckedChange={onToggle} size="sm" />
    </HStack>
    {isActive && children && <Box mt={2}>{children}</Box>}
  </Box>
);

export interface ProfileOverrideActions {
  co: Record<string, unknown>;
  isActive: (key: string) => boolean;
  setOv: (key: string, value: unknown) => void;
  clearOv: (key: string) => void;
  tog: (key: string, defaultValue: unknown) => (checked: boolean) => void;
  ovCount: (keys: string[]) => number;
}
