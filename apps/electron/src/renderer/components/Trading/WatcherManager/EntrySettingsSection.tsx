import { Slider } from '@/renderer/components/ui/slider';
import { Box, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import { useTranslation } from 'react-i18next';

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
  isPending: _isPending,
}: EntrySettingsSectionProps) => {
  const { t } = useTranslation();

  const getEntryLevelLabel = (value: number): string => {
    if (value <= 20) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.deepPullback');
    if (value <= 50) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.pullback');
    if (value <= 80) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.shallowPullback');
    if (value <= 100) return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.breakout');
    return t('settings.algorithmicAutoTrading.entrySettings.entryLevel.extendedBreakout');
  };

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.entrySettings.title')}
      description={t('settings.algorithmicAutoTrading.entrySettings.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
      <Stack gap={6}>
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.title')}
          </Text>
          <Text fontSize="xs" color="fg.muted" mb={4}>
            {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.description')}
          </Text>
          <HStack gap={4}>
            <Slider
              value={[maxFibonacciEntryProgressPercent]}
              onValueChange={(values) => onEntryProgressChange(values[0] ?? 100)}
              min={0}
              max={150}
              step={0.1}
            />
            <Text fontSize="sm" fontWeight="medium" minW="100px" textAlign="right">
              {maxFibonacciEntryProgressPercent}% ({getEntryLevelLabel(maxFibonacciEntryProgressPercent)})
            </Text>
          </HStack>
          <HStack justify="space-between" mt={2}>
            <Text fontSize="xs" color="fg.muted">0% ({t('settings.algorithmicAutoTrading.entrySettings.entryLevel.deepPullback')})</Text>
            <Text fontSize="xs" color="fg.muted">150% ({t('settings.algorithmicAutoTrading.entrySettings.entryLevel.extendedBreakout')})</Text>
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
              <Slider
                value={[minRiskRewardRatioLong]}
                onValueChange={(values) => onMinRiskRewardLongChange(values[0] ?? 0.75)}
                min={0.5}
                max={3}
                step={0.05}
              />
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
              <Slider
                value={[minRiskRewardRatioShort]}
                onValueChange={(values) => onMinRiskRewardShortChange(values[0] ?? 0.75)}
                min={0.5}
                max={3}
                step={0.05}
              />
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
    </CollapsibleSection>
  );
};
