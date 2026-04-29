import { Box, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, FormRow, NumberInput, Radio, RadioGroup, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { FilterToggle } from './FilterToggle';
import type { WatcherConfig } from './types';

export interface OpportunityCostSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  config: WatcherConfig | undefined;
  walletId: string;
  onConfigUpdate: (updates: Partial<WatcherConfig>) => void;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
}

export const OpportunityCostSection = ({
  isExpanded,
  onToggle,
  config,
  walletId,
  onConfigUpdate,
  onFilterToggle,
  isPending,
}: OpportunityCostSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.opportunityCost.title')}
      description={t('settings.algorithmicAutoTrading.opportunityCost.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
      badge={config?.opportunityCostEnabled ? (
        <Box px={2} py={0.5} bg="purple.subtle" color="purple.fg" borderRadius="full" fontSize="xs" fontWeight="medium">
          {t('common.active')}
        </Box>
      ) : undefined}
    >
      <Stack gap={4}>
        <FormRow
          label={t('settings.algorithmicAutoTrading.opportunityCost.enable')}
          helper={t('settings.algorithmicAutoTrading.opportunityCost.enableDescription')}
        >
          <Switch
            checked={config?.opportunityCostEnabled ?? false}
            onCheckedChange={(value) => {
              if (!walletId) return;
              onConfigUpdate({ opportunityCostEnabled: value });
            }}
            disabled={isPending}
          />
        </FormRow>

        {config?.opportunityCostEnabled && (
          <Stack gap={4} pl={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {t('settings.algorithmicAutoTrading.opportunityCost.maxHoldingPeriod')}
              </Text>
              <Flex gap={2} align="center">
                <NumberInput
                  min={5}
                  max={100}
                  value={String(config?.maxHoldingPeriodBars ?? 20)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!walletId) return;
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 5 && value <= 100) {
                      onConfigUpdate({ maxHoldingPeriodBars: value });
                    }
                  }}
                  size="sm"
                  w="100px"
                />
                <Text fontSize="sm" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.opportunityCost.bars')}
                </Text>
              </Flex>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {t('settings.algorithmicAutoTrading.opportunityCost.staleThreshold')}
              </Text>
              <Flex gap={2} align="center">
                <NumberInput
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={config?.stalePriceThresholdPercent ?? '0.5'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!walletId) return;
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0.1 && value <= 5) {
                      onConfigUpdate({ stalePriceThresholdPercent: value.toString() });
                    }
                  }}
                  size="sm"
                  w="100px"
                />
                <Text fontSize="sm" color="fg.muted">%</Text>
              </Flex>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {t('settings.algorithmicAutoTrading.opportunityCost.actionWhenStale')}
              </Text>
              <RadioGroup
                value={config?.staleTradeAction ?? 'TIGHTEN_STOP'}
                onValueChange={(e) => {
                  if (!walletId) return;
                  onConfigUpdate({
                    staleTradeAction: e.value as 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE',
                  });
                }}
              >
                <Stack gap={2}>
                  <Radio value="ALERT_ONLY">
                    {t('settings.algorithmicAutoTrading.opportunityCost.alertOnly')}
                  </Radio>
                  <Radio value="TIGHTEN_STOP">
                    {t('settings.algorithmicAutoTrading.opportunityCost.tightenStop')}
                  </Radio>
                  <Radio value="AUTO_CLOSE">
                    {t('settings.algorithmicAutoTrading.opportunityCost.autoClose')}
                  </Radio>
                </Stack>
              </RadioGroup>
            </Box>

            <FilterToggle
              label={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.title')}
              description={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.description')}
              checked={config?.timeBasedStopTighteningEnabled ?? true}
              onChange={(value) => onFilterToggle('timeBasedStopTighteningEnabled', value)}
              disabled={isPending}
            />

            {config?.timeBasedStopTighteningEnabled && (
              <Grid templateColumns="1fr 1fr" gap={4} pl={4}>
                <Box>
                  <Text fontSize="sm" mb={1}>
                    {t('settings.algorithmicAutoTrading.opportunityCost.tightenAfterBars')}
                  </Text>
                  <NumberInput
                    min={1}
                    max={50}
                    value={String(config?.timeTightenAfterBars ?? 10)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (!walletId) return;
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 1 && value <= 50) {
                        onConfigUpdate({ timeTightenAfterBars: value });
                      }
                    }}
                    size="sm"
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={1}>
                    {t('settings.algorithmicAutoTrading.opportunityCost.tightenPercentPerBar')}
                  </Text>
                  <Flex gap={2} align="center">
                    <NumberInput
                      min={1}
                      max={20}
                      value={config?.timeTightenPercentPerBar ?? '5'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!walletId) return;
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 1 && value <= 20) {
                          onConfigUpdate({ timeTightenPercentPerBar: value.toString() });
                        }
                      }}
                      size="sm"
                    />
                    <Text fontSize="sm">%</Text>
                  </Flex>
                </Box>
              </Grid>
            )}
          </Stack>
        )}
      </Stack>
    </CollapsibleSection>
  );
};
