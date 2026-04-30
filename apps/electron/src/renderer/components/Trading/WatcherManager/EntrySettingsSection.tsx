import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { Callout, CollapsibleSection, Slider, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface EntrySettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  maxFibonacciEntryProgressPercentLong: number;
  onEntryProgressLongChange: (value: number) => void;
  maxFibonacciEntryProgressPercentShort: number;
  onEntryProgressShortChange: (value: number) => void;
  minRiskRewardRatioLong: number;
  onMinRiskRewardLongChange: (value: number) => void;
  minRiskRewardRatioShort: number;
  onMinRiskRewardShortChange: (value: number) => void;
  isPending: boolean;
  dragSlEnabled: boolean;
  onDragSlEnabledChange: (enabled: boolean) => void;
  dragTpEnabled: boolean;
  onDragTpEnabledChange: (enabled: boolean) => void;
  slTightenOnly: boolean;
  onSlTightenOnlyChange: (enabled: boolean) => void;
}

export const EntrySettingsSection = ({
  isExpanded,
  onToggle,
  maxFibonacciEntryProgressPercentLong,
  onEntryProgressLongChange,
  maxFibonacciEntryProgressPercentShort,
  onEntryProgressShortChange,
  minRiskRewardRatioLong,
  onMinRiskRewardLongChange,
  minRiskRewardRatioShort,
  onMinRiskRewardShortChange,
  isPending: _isPending,
  dragSlEnabled,
  onDragSlEnabledChange,
  dragTpEnabled,
  onDragTpEnabledChange,
  slTightenOnly,
  onSlTightenOnlyChange,
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
      variant="static"
    >
      <Stack gap={6}>
        <Grid templateColumns="repeat(2, 1fr)" gap={4}>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={2}>
              {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.longTitle')}
            </Text>
            <Text fontSize="xs" color="fg.muted" mb={4}>
              {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.description')}
            </Text>
            <HStack gap={4}>
              <Slider
                value={[maxFibonacciEntryProgressPercentLong]}
                onValueChange={(values) => onEntryProgressLongChange(values[0] ?? 100)}
                min={0}
                max={150}
                step={0.1}
              />
              <Text fontSize="sm" fontWeight="medium" minW="100px" textAlign="right">
                {maxFibonacciEntryProgressPercentLong}% ({getEntryLevelLabel(maxFibonacciEntryProgressPercentLong)})
              </Text>
            </HStack>
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={2}>
              {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.shortTitle')}
            </Text>
            <Text fontSize="xs" color="fg.muted" mb={4}>
              {t('settings.algorithmicAutoTrading.entrySettings.entryLevel.description')}
            </Text>
            <HStack gap={4}>
              <Slider
                value={[maxFibonacciEntryProgressPercentShort]}
                onValueChange={(values) => onEntryProgressShortChange(values[0] ?? 100)}
                min={0}
                max={150}
                step={0.1}
              />
              <Text fontSize="sm" fontWeight="medium" minW="100px" textAlign="right">
                {maxFibonacciEntryProgressPercentShort}% ({getEntryLevelLabel(maxFibonacciEntryProgressPercentShort)})
              </Text>
            </HStack>
          </Box>
        </Grid>

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
                step={0.1}
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
                step={0.1}
              />
              <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                {minRiskRewardRatioShort.toFixed(2)}
              </Text>
            </HStack>
          </Box>
        </Grid>

        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={3}>
            {t('settings.algorithmicAutoTrading.entrySettings.chartDrag.title')}
          </Text>
          <Stack gap={3}>
            <Flex justify="space-between" align="center">
              <Box>
                <Text fontSize="sm">{t('settings.algorithmicAutoTrading.entrySettings.chartDrag.dragSl')}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.entrySettings.chartDrag.dragSlDescription')}
                </Text>
              </Box>
              <Switch
                checked={dragSlEnabled}
                onCheckedChange={onDragSlEnabledChange}
              />
            </Flex>
            {dragSlEnabled && (
              <Flex justify="space-between" align="center" pl={4}>
                <Box>
                  <Text fontSize="sm">{t('settings.algorithmicAutoTrading.entrySettings.chartDrag.slTightenOnly')}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('settings.algorithmicAutoTrading.entrySettings.chartDrag.slTightenOnlyDescription')}
                  </Text>
                </Box>
                <Switch
                  checked={slTightenOnly}
                  onCheckedChange={onSlTightenOnlyChange}
                />
              </Flex>
            )}
            <Flex justify="space-between" align="center">
              <Box>
                <Text fontSize="sm">{t('settings.algorithmicAutoTrading.entrySettings.chartDrag.dragTp')}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.entrySettings.chartDrag.dragTpDescription')}
                </Text>
              </Box>
              <Switch
                checked={dragTpEnabled}
                onCheckedChange={onDragTpEnabledChange}
              />
            </Flex>
          </Stack>
        </Box>

        <Callout tone="info" compact>
          {t('settings.algorithmicAutoTrading.entrySettings.optimizedNote')}
        </Callout>
      </Stack>
    </CollapsibleSection>
  );
};
