import { Box, Collapsible, Flex, Grid, HStack, Slider, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface EntrySettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  maxFibonacciEntryProgressPercent: number;
  onEntryProgressChange: (value: number) => void;
  minRiskRewardRatioLong: number;
  onMinRiskRewardLongChange: (value: number) => void;
  minRiskRewardRatioShort: number;
  onMinRiskRewardShortChange: (value: number) => void;
  isPending: boolean;
}

export const EntrySettingsSection = ({
  isExpanded,
  onToggle,
  maxFibonacciEntryProgressPercent,
  onEntryProgressChange,
  minRiskRewardRatioLong,
  onMinRiskRewardLongChange,
  minRiskRewardRatioShort,
  onMinRiskRewardShortChange,
  isPending,
}: EntrySettingsSectionProps) => {
  const { t } = useTranslation();

  const getEntryLevelLabel = (value: number): string => {
    if (value <= 20) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.deepPullback');
    if (value <= 50) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.pullback');
    if (value <= 80) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.shallowPullback');
    return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.breakout');
  };

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
            {t('settings.algorithmicAutoTrading.entrySettings.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('settings.algorithmicAutoTrading.entrySettings.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={6} mt={4}>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.title')}
              </Text>
              <Text fontSize="xs" color="fg.muted" mb={4}>
                {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.description')}
              </Text>
              <HStack gap={4}>
                <Slider.Root
                  value={[maxFibonacciEntryProgressPercent]}
                  onValueChange={({ value }) => onEntryProgressChange(value[0] ?? 100)}
                  min={0}
                  max={100}
                  step={5}
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
                <Text fontSize="sm" fontWeight="medium" minW="100px" textAlign="right">
                  {maxFibonacciEntryProgressPercent}% ({getEntryLevelLabel(maxFibonacciEntryProgressPercent)})
                </Text>
              </HStack>
              <HStack justify="space-between" mt={2}>
                <Text fontSize="xs" color="fg.muted">0% ({t('settings.algorithmicAutoTrading.entrySettings.entryLevel.deepPullback')})</Text>
                <Text fontSize="xs" color="fg.muted">100% ({t('settings.algorithmicAutoTrading.entrySettings.entryLevel.breakout')})</Text>
              </HStack>
            </Box>

            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  {t('settings.algorithmicAutoTrading.entrySettings.minRR.longTitle')}
                </Text>
                <Text fontSize="xs" color="fg.muted" mb={4}>
                  {t('settings.algorithmicAutoTrading.entrySettings.minRR.longDescription')}
                </Text>
                <HStack gap={4}>
                  <Slider.Root
                    value={[minRiskRewardRatioLong]}
                    onValueChange={({ value }) => onMinRiskRewardLongChange(value[0] ?? 0.75)}
                    min={0.5}
                    max={3}
                    step={0.25}
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
                    {minRiskRewardRatioLong.toFixed(2)}
                  </Text>
                </HStack>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  {t('settings.algorithmicAutoTrading.entrySettings.minRR.shortTitle')}
                </Text>
                <Text fontSize="xs" color="fg.muted" mb={4}>
                  {t('settings.algorithmicAutoTrading.entrySettings.minRR.shortDescription')}
                </Text>
                <HStack gap={4}>
                  <Slider.Root
                    value={[minRiskRewardRatioShort]}
                    onValueChange={({ value }) => onMinRiskRewardShortChange(value[0] ?? 0.75)}
                    min={0.5}
                    max={3}
                    step={0.25}
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
                    {minRiskRewardRatioShort.toFixed(2)}
                  </Text>
                </HStack>
              </Box>
            </Grid>

            <Box p={3} bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.muted">
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.entrySettings.optimizedNote')}
              </Text>
            </Box>
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
