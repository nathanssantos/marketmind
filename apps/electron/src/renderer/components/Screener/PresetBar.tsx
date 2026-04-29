import type { ScreenerPreset } from '@marketmind/types';
import { Box, Flex, HStack } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui';

interface PresetBarProps {
  presets: ScreenerPreset[];
  activePresetId: string | null;
  onSelectPreset: (id: string | null) => void;
}

export const PresetBar = memo(({ presets, activePresetId, onSelectPreset }: PresetBarProps) => {
  const { t } = useTranslation();

  if (presets.length === 0) return null;

  return (
    <Box>
      <Box fontSize="2xs" fontWeight="semibold" color="fg.muted" mb={1}>
        {t('screener.presets.title')}
      </Box>
      <Flex gap={1} flexWrap="wrap">
        <Button
          size="2xs"
          variant="outline"
          color={activePresetId === null ? 'accent.solid' : 'fg.muted'}
          onClick={() => onSelectPreset(null)}
        >
          {t('screener.presets.custom')}
        </Button>
        {presets.map((preset) => (
          <HStack key={preset.id} gap={0}>
            <Button
              size="2xs"
              variant="outline"
              color={activePresetId === preset.id ? 'accent.solid' : 'fg.muted'}
              onClick={() => onSelectPreset(preset.id)}
              title={t(`screener.presets.descriptions.${preset.id}`, preset.description)}
            >
              {t(`screener.presets.names.${preset.id}`, preset.name)}
            </Button>
          </HStack>
        ))}
      </Flex>
    </Box>
  );
});

PresetBar.displayName = 'PresetBar';
