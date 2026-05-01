import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { FormSection, Slider } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface PositionSizeSectionProps {
  positionSizePercent: number;
  onPositionSizeChange: (value: number) => void;
  manualPositionSizePercent: number;
  onManualPositionSizeChange: (value: number) => void;
  maxGlobalExposurePercent: number;
  onMaxGlobalExposureChange: (value: number) => void;
  isPending: boolean;
}

export const PositionSizeSection = ({
  positionSizePercent,
  onPositionSizeChange,
  manualPositionSizePercent,
  onManualPositionSizeChange,
  maxGlobalExposurePercent,
  onMaxGlobalExposureChange,
  isPending: _isPending,
}: PositionSizeSectionProps) => {
  const { t } = useTranslation();

  return (
    <FormSection
      title={t('watcherManager.positionSize.title')}
      description={t('watcherManager.positionSize.description')}
    >
      <Stack gap={4}>
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
              step={0.1}
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
              min={0.3}
              max={100}
              step={0.1}
              width="full"
            />
            <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
              {positionSizePercent}%
            </Text>
          </HStack>
          <HStack justify="space-between" mt={2}>
            <Text fontSize="xs" color="fg.muted">0.3%</Text>
            <Text fontSize="xs" color="fg.muted">100%</Text>
          </HStack>
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            {t('watcherManager.positionSize.manualSizePercent')}
          </Text>
          <Text fontSize="xs" color="fg.muted" mb={4}>
            {t('watcherManager.positionSize.manualSizePercentDescription')}
          </Text>
          <HStack gap={4}>
            <Slider
              value={[manualPositionSizePercent]}
              onValueChange={(values) => onManualPositionSizeChange(values[0] ?? 2.5)}
              min={0.3}
              max={100}
              step={0.1}
              width="full"
            />
            <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
              {manualPositionSizePercent}%
            </Text>
          </HStack>
          <HStack justify="space-between" mt={2}>
            <Text fontSize="xs" color="fg.muted">0.3%</Text>
            <Text fontSize="xs" color="fg.muted">100%</Text>
          </HStack>
        </Box>
      </Stack>
    </FormSection>
  );
};
