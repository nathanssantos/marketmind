import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { NumberInput } from '@renderer/components/ui/number-input';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import { Box, HStack, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

export interface RiskManagementSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  maxDrawdownEnabled: boolean;
  onMaxDrawdownEnabledChange: (enabled: boolean) => void;
  maxDrawdownPercent: number;
  onMaxDrawdownChange: (value: number) => void;
  maxRiskPerStopEnabled: boolean;
  onMaxRiskPerStopEnabledChange: (enabled: boolean) => void;
  maxRiskPerStopPercent: number;
  onMaxRiskPerStopChange: (value: number) => void;
  marginTopUpEnabled: boolean;
  onMarginTopUpEnabledChange: (enabled: boolean) => void;
  marginTopUpThreshold: number;
  onMarginTopUpThresholdChange: (value: number) => void;
  marginTopUpPercent: number;
  onMarginTopUpPercentChange: (value: number) => void;
  marginTopUpMaxCount: number;
  onMarginTopUpMaxCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoCancelOrphans: boolean;
  onAutoCancelOrphansChange: (enabled: boolean) => void;
  isPending: boolean;
  isIB: boolean;
}

export const RiskManagementSection = ({
  isExpanded,
  onToggle,
  maxDrawdownEnabled,
  onMaxDrawdownEnabledChange,
  maxDrawdownPercent,
  onMaxDrawdownChange,
  maxRiskPerStopEnabled,
  onMaxRiskPerStopEnabledChange,
  maxRiskPerStopPercent,
  onMaxRiskPerStopChange,
  marginTopUpEnabled,
  onMarginTopUpEnabledChange,
  marginTopUpThreshold,
  onMarginTopUpThresholdChange,
  marginTopUpPercent,
  onMarginTopUpPercentChange,
  marginTopUpMaxCount,
  onMarginTopUpMaxCountChange,
  autoCancelOrphans,
  onAutoCancelOrphansChange,
  isPending: _isPending,
  isIB,
}: RiskManagementSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('watcherManager.riskManagement.title')}
      description={t('watcherManager.riskManagement.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
      <Stack gap={6}>
        <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
          <Box>
            <Text fontSize="sm" fontWeight="semibold">
              {t('watcherManager.riskManagement.maxDrawdown.title')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('watcherManager.riskManagement.maxDrawdown.description')}
            </Text>
          </Box>
          <Switch
            checked={maxDrawdownEnabled}
            onCheckedChange={onMaxDrawdownEnabledChange}
          />
        </HStack>

        {maxDrawdownEnabled && (
          <Stack gap={4} pl={4} borderLeftWidth="2px" borderLeftColor="red.500">
            <HStack gap={4}>
              <Slider
                value={[maxDrawdownPercent]}
                onValueChange={(values) => onMaxDrawdownChange(values[0] ?? 15)}
                min={5}
                max={50}
                step={1}
                width="full"
              />
              <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                {maxDrawdownPercent}%
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">5%</Text>
              <Text fontSize="xs" color="fg.muted">50%</Text>
            </HStack>
          </Stack>
        )}

        <Separator />

        <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
          <Box>
            <Text fontSize="sm" fontWeight="semibold">
              {t('watcherManager.riskManagement.maxRiskPerStop.title')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('watcherManager.riskManagement.maxRiskPerStop.description')}
            </Text>
          </Box>
          <Switch
            checked={maxRiskPerStopEnabled}
            onCheckedChange={onMaxRiskPerStopEnabledChange}
          />
        </HStack>

        {maxRiskPerStopEnabled && (
          <Stack gap={4} pl={4} borderLeftWidth="2px" borderLeftColor="blue.500">
            <HStack gap={4}>
              <Slider
                value={[maxRiskPerStopPercent]}
                onValueChange={(values) => onMaxRiskPerStopChange(values[0] ?? 2)}
                min={0.5}
                max={10}
                step={0.5}
                width="full"
              />
              <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                {maxRiskPerStopPercent}%
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">0.5%</Text>
              <Text fontSize="xs" color="fg.muted">10%</Text>
            </HStack>
          </Stack>
        )}

        {!isIB && (
          <>
            <Separator />

            <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
              <Box>
                <Text fontSize="sm" fontWeight="semibold">
                  {t('watcherManager.riskManagement.marginTopUp.title')}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('watcherManager.riskManagement.marginTopUp.description')}
                </Text>
              </Box>
              <Switch
                checked={marginTopUpEnabled}
                onCheckedChange={onMarginTopUpEnabledChange}
              />
            </HStack>

            {marginTopUpEnabled && (
              <Stack gap={4} pl={4} borderLeftWidth="2px" borderLeftColor="orange.500">
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('watcherManager.riskManagement.marginTopUp.threshold')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mb={3}>
                    {t('watcherManager.riskManagement.marginTopUp.thresholdDescription')}
                  </Text>
                  <HStack gap={4}>
                    <Slider
                      value={[marginTopUpThreshold]}
                      onValueChange={(values) => onMarginTopUpThresholdChange(values[0] ?? 30)}
                      min={10}
                      max={80}
                      step={5}
                      width="full"
                    />
                    <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                      {marginTopUpThreshold}%
                    </Text>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('watcherManager.riskManagement.marginTopUp.amount')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mb={3}>
                    {t('watcherManager.riskManagement.marginTopUp.amountDescription')}
                  </Text>
                  <HStack gap={4}>
                    <Slider
                      value={[marginTopUpPercent]}
                      onValueChange={(values) => onMarginTopUpPercentChange(values[0] ?? 10)}
                      min={1}
                      max={50}
                      step={1}
                      width="full"
                    />
                    <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                      {marginTopUpPercent}%
                    </Text>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('watcherManager.riskManagement.marginTopUp.maxCount')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mb={3}>
                    {t('watcherManager.riskManagement.marginTopUp.maxCountDescription')}
                  </Text>
                  <NumberInput
                    min={1}
                    max={10}
                    value={marginTopUpMaxCount}
                    onChange={onMarginTopUpMaxCountChange}
                    size="sm"
                  />
                </Box>
              </Stack>
            )}
          </>
        )}

        <Separator />

        <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
          <Box>
            <Text fontSize="sm" fontWeight="semibold">
              {t('watcherManager.riskManagement.autoCancelOrphans.title')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('watcherManager.riskManagement.autoCancelOrphans.description')}
            </Text>
          </Box>
          <Switch
            checked={autoCancelOrphans}
            onCheckedChange={onAutoCancelOrphansChange}
          />
        </HStack>
      </Stack>
    </CollapsibleSection>
  );
};
