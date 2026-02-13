import { Radio, RadioGroup } from '@/renderer/components/ui/radio';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import type { FibonacciTargetLevel } from '@marketmind/fibonacci';
import { useTranslation } from 'react-i18next';

export interface TpModeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  tpCalculationMode: 'default' | 'fibonacci';
  fibonacciTargetLevelLong: FibonacciTargetLevel;
  fibonacciTargetLevelShort: FibonacciTargetLevel;
  fibonacciSwingRange: 'extended' | 'nearest';
  onTpModeChange: (details: { value: string }) => void;
  onFibonacciLevelLongChange: (details: { value: string }) => void;
  onFibonacciLevelShortChange: (details: { value: string }) => void;
  onFibonacciSwingRangeChange: (details: { value: string }) => void;
  isPending: boolean;
}

export const TpModeSection = ({
  isExpanded,
  onToggle,
  tpCalculationMode,
  fibonacciTargetLevelLong,
  fibonacciTargetLevelShort,
  fibonacciSwingRange,
  onTpModeChange,
  onFibonacciLevelLongChange,
  onFibonacciLevelShortChange,
  onFibonacciSwingRangeChange,
  isPending,
}: TpModeSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.tpMode.title')}
      description={t('settings.algorithmicAutoTrading.tpMode.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
      <RadioGroup
        value={tpCalculationMode}
        onValueChange={onTpModeChange}
        disabled={isPending}
      >
        <HStack gap={6}>
          <Radio value="default">
            <Box>
              <Text fontSize="sm" fontWeight="medium">
                {t('settings.algorithmicAutoTrading.tpMode.default')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.tpMode.defaultDescription')}
              </Text>
            </Box>
          </Radio>
          <Radio value="fibonacci">
            <Box>
              <Text fontSize="sm" fontWeight="medium">
                {t('settings.algorithmicAutoTrading.tpMode.fibonacci')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.tpMode.fibonacciDescription')}
              </Text>
            </Box>
          </Radio>
        </HStack>
      </RadioGroup>

      {tpCalculationMode === 'fibonacci' && (
        <Stack mt={4} gap={4}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              {t('settings.algorithmicAutoTrading.tpMode.swingRange.title')}
            </Text>
            <Text fontSize="xs" color="fg.muted" mb={2}>
              {t('settings.algorithmicAutoTrading.tpMode.swingRange.description')}
            </Text>
            <RadioGroup
              value={fibonacciSwingRange}
              onValueChange={onFibonacciSwingRangeChange}
              disabled={isPending}
            >
              <HStack gap={6}>
                <Radio value="extended">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('settings.algorithmicAutoTrading.tpMode.swingRange.extended')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('settings.algorithmicAutoTrading.tpMode.swingRange.extendedDescription')}
                    </Text>
                  </Box>
                </Radio>
                <Radio value="nearest">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('settings.algorithmicAutoTrading.tpMode.swingRange.nearest')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('settings.algorithmicAutoTrading.tpMode.swingRange.nearestDescription')}
                    </Text>
                  </Box>
                </Radio>
              </HStack>
            </RadioGroup>
          </Box>

          <Box pl={4} borderLeftWidth="2px" borderLeftColor="green.500">
            <Text fontSize="sm" fontWeight="medium" mb={2} color="green.600" _dark={{ color: 'green.400' }}>
              {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.titleLong')}
            </Text>
            <RadioGroup
              value={fibonacciTargetLevelLong}
              onValueChange={onFibonacciLevelLongChange}
              disabled={isPending}
            >
              <Stack gap={2}>
                <Radio value="auto">
                  <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.auto')}</Text>
                </Radio>
                <Radio value="1">
                  <Text fontSize="sm">100% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservative')}</Text>
                </Radio>
                <Radio value="1.272">
                  <Text fontSize="sm">127.2% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderate')}</Text>
                </Radio>
                <Radio value="1.382">
                  <Text fontSize="sm">138.2% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateAggressive')}</Text>
                </Radio>
                <Radio value="1.618">
                  <Text fontSize="sm">161.8% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressive')}</Text>
                </Radio>
                <Radio value="2">
                  <Text fontSize="sm">200% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extended')}</Text>
                </Radio>
                <Radio value="2.618">
                  <Text fontSize="sm">261.8% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtended')}</Text>
                </Radio>
              </Stack>
            </RadioGroup>
          </Box>

          <Box pl={4} borderLeftWidth="2px" borderLeftColor="red.500">
            <Text fontSize="sm" fontWeight="medium" mb={2} color="red.600" _dark={{ color: 'red.400' }}>
              {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.titleShort')}
            </Text>
            <RadioGroup
              value={fibonacciTargetLevelShort}
              onValueChange={onFibonacciLevelShortChange}
              disabled={isPending}
            >
              <Stack gap={2}>
                <Radio value="auto">
                  <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.auto')}</Text>
                </Radio>
                <Radio value="1">
                  <Text fontSize="sm">100% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservative')}</Text>
                </Radio>
                <Radio value="1.272">
                  <Text fontSize="sm">127.2% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderate')}</Text>
                </Radio>
                <Radio value="1.382">
                  <Text fontSize="sm">138.2% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateAggressive')}</Text>
                </Radio>
                <Radio value="1.618">
                  <Text fontSize="sm">161.8% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressive')}</Text>
                </Radio>
                <Radio value="2">
                  <Text fontSize="sm">200% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extended')}</Text>
                </Radio>
                <Radio value="2.618">
                  <Text fontSize="sm">261.8% - {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtended')}</Text>
                </Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </Stack>
      )}
    </CollapsibleSection>
  );
};
