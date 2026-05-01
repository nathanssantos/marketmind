import { Box, chakra, Grid, HStack, Input as ChakraInput, VStack } from '@chakra-ui/react';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

const ChakraButton = chakra('button');
import { Popover } from '@marketmind/ui-core';

export const DEFAULT_COLOR_PRESETS = [
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#607d8b',
  '#00e676',
  '#ffc107',
  '#ff00ff',
  '#ff5722',
  '#2196f3',
] as const;

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

const normalizeHex = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
};

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  presets?: readonly string[];
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  ariaLabel?: string;
}

const SIZE_MAP: Record<NonNullable<ColorPickerProps['size']>, string> = {
  xs: '16px',
  sm: '20px',
  md: '24px',
};

export const ColorPicker = forwardRef<HTMLButtonElement, ColorPickerProps>(
  ({ value, onChange, presets = DEFAULT_COLOR_PRESETS, size = 'sm', disabled, ariaLabel = 'Pick color' }, ref) => {
    const [open, setOpen] = useState(false);
    const [hexInput, setHexInput] = useState(value);

    useEffect(() => {
      setHexInput(value);
    }, [value]);

    const dim = SIZE_MAP[size];

    const commitHex = useCallback(
      (raw: string) => {
        const normalized = normalizeHex(raw);
        if (normalized && normalized !== value) onChange(normalized);
      },
      [onChange, value],
    );

    const trigger = useMemo(
      () => (
        <ChakraButton
          ref={ref}
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          w={dim}
          h={dim}
          borderRadius="sm"
          bg={value}
          border="1px solid"
          borderColor="border"
          cursor={disabled ? 'not-allowed' : 'pointer'}
          opacity={disabled ? 0.4 : 1}
          flexShrink={0}
          onClick={() => !disabled && setOpen((o) => !o)}
          _hover={disabled ? undefined : { borderColor: 'accent.solid' }}
        />
      ),
      [ariaLabel, disabled, dim, ref, value],
    );

    return (
      <Popover
        open={open}
        onOpenChange={({ open: next }) => setOpen(next)}
        trigger={trigger}
        width="216px"
        positioning={{ placement: 'bottom-start', offset: { mainAxis: 4 } }}
      >
        <VStack gap={2} p={2} align="stretch">
          <Grid templateColumns="repeat(6, 1fr)" gap={1.5}>
            {presets.map((preset) => {
              const selected = preset.toLowerCase() === value.toLowerCase();
              return (
                <ChakraButton
                  key={preset}
                  type="button"
                  aria-label={preset}
                  w="24px"
                  h="24px"
                  borderRadius="sm"
                  bg={preset}
                  border={selected ? '2px solid' : '1px solid'}
                  borderColor={selected ? 'accent.solid' : 'border'}
                  cursor="pointer"
                  onClick={() => {
                    onChange(preset);
                    setOpen(false);
                  }}
                />
              );
            })}
          </Grid>

          <HStack gap={2}>
            <Box
              as="label"
              position="relative"
              w="28px"
              h="28px"
              borderRadius="sm"
              border="1px solid"
              borderColor="border"
              overflow="hidden"
              cursor="pointer"
              flexShrink={0}
              bg={value}
            >
              <ChakraInput
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                position="absolute"
                inset={0}
                w="100%"
                h="100%"
                p={0}
                border="none"
                opacity={0}
                cursor="pointer"
              />
            </Box>
            <ChakraInput
              size="sm"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitHex((e.target as HTMLInputElement).value);
                  setOpen(false);
                }
              }}
              placeholder="#rrggbb"
              fontFamily="mono"
              fontSize="xs"
            />
          </HStack>
        </VStack>
      </Popover>
    );
  },
);

ColorPicker.displayName = 'ColorPicker';
