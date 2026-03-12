import { Box, HStack, Text } from '@chakra-ui/react';
import { Input, ToggleIconButton } from '@renderer/components/ui';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { LuStar } from 'react-icons/lu';
import { usePinnedControls, type PinnedControl } from './PinnedControlsContext';

export interface PinnableControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  controlKey: PinnedControl;
  step?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
}

export const PinnableControl = ({
  label,
  value,
  onChange,
  controlKey,
  step,
  min,
  max,
}: PinnableControlProps): ReactElement => {
  const [isHovered, setIsHovered] = useState(false);
  const { togglePin, isPinned } = usePinnedControls();
  const pinned = isPinned(controlKey);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      position="relative"
    >
      <HStack justify="space-between">
        <Text fontSize="xs" color="gray.300">{label}</Text>
        <HStack gap={1}>
          <ToggleIconButton
            active={pinned}
            size="xs"
            aria-label={pinned ? 'Unpin control' : 'Pin control'}
            onClick={() => togglePin(controlKey)}
            opacity={isHovered || pinned ? 1 : 0}
            transition="opacity 0.2s"
            color={pinned ? 'blue.400' : 'gray.400'}
          >
            <LuStar size={12} fill={pinned ? 'currentColor' : 'none'} />
          </ToggleIconButton>
          <Input
            size="xs"
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            width="60px"
            textAlign="right"
            step={step}
            min={min}
            max={max}
            color="gray.300"
          />
        </HStack>
      </HStack>
    </Box>
  );
};
