import { Slider } from '@/renderer/components/ui/slider';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import { useTranslation } from 'react-i18next';

export interface PositionSizeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  positionSizePercent: number;
  onPositionSizeChange: (value: number) => void;
  maxGlobalExposurePercent: number;
  onMaxGlobalExposureChange: (value: number) => void;
  isPending: boolean;
}

export const PositionSizeSection = ({
  isExpanded,
  onToggle,
  positionSizePercent,
  onPositionSizeChange,
  maxGlobalExposurePercent,
  onMaxGlobalExposureChange,
  isPending: _isPending,
}: PositionSizeSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('watcherManager.positionSize.title')}
      description={t('watcherManager.positionSize.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
      <Stack gap={6}>
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            {t('watcherManager.positionSize.globalExposure')}
          </Text>
          <Text fontSize="xs" color="fg.muted" mb={4}>
            {t('watcherManager.positionSize.globalExposureDescription')}
          </Text>
          <HStack gap={4}>
            <Slider
              value={[maxGlobalExposurePercent]}
              onValueChange={(values) => onMaxGlobalExposureChange(values[0] ?? 100)}
              min={1}
              max={100}
              step={1}
              width="full"
            />
            <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
              {maxGlobalExposurePercent}%
            </Text>
          </HStack>
          <HStack justify="space-between" mt={2}>
            <Text fontSize="xs" color="fg.muted">1%</Text>
            <Text fontSize="xs" color="fg.muted">100%</Text>
          </HStack>
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            {t('watcherManager.positionSize.sizePercent')}
          </Text>
          <Text fontSize="xs" color="fg.muted" mb={4}>
            {t('watcherManager.positionSize.sizePercentDescription')}
          </Text>
          <HStack gap={4}>
            <Slider
              value={[positionSizePercent]}
              onValueChange={(values) => onPositionSizeChange(values[0] ?? 10)}
              min={1}
              max={100}
              step={1}
              width="full"
            />
            <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
              {positionSizePercent}%
            </Text>
          </HStack>
          <HStack justify="space-between" mt={2}>
            <Text fontSize="xs" color="fg.muted">1%</Text>
            <Text fontSize="xs" color="fg.muted">100%</Text>
          </HStack>
        </Box>
      </Stack>
    </CollapsibleSection>
  );
};
