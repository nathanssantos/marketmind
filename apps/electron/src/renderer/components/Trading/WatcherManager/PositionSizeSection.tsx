import { Box, Collapsible, Flex, HStack, Slider, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

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
  isPending,
}: PositionSizeSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            {t('watcherManager.positionSize.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('watcherManager.positionSize.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={6} mt={4}>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                {t('watcherManager.positionSize.globalExposure')}
              </Text>
              <Text fontSize="xs" color="fg.muted" mb={4}>
                {t('watcherManager.positionSize.globalExposureDescription')}
              </Text>
              <HStack gap={4}>
                <Slider.Root
                  value={[maxGlobalExposurePercent]}
                  onValueChange={({ value }) => onMaxGlobalExposureChange(value[0] ?? 100)}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isPending}
                  width="full"
                >
                  <Slider.Control>
                    <Slider.Track>
                      <Slider.Range />
                    </Slider.Track>
                    <Slider.Thumb index={0} />
                  </Slider.Control>
                </Slider.Root>
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
                <Slider.Root
                  value={[positionSizePercent]}
                  onValueChange={({ value }) => onPositionSizeChange(value[0] ?? 10)}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isPending}
                  width="full"
                >
                  <Slider.Control>
                    <Slider.Track>
                      <Slider.Range />
                    </Slider.Track>
                    <Slider.Thumb index={0} />
                  </Slider.Control>
                </Slider.Root>
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
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
