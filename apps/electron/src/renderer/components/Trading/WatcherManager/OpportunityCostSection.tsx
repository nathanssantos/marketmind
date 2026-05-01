import { Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Badge, Field, FormRow, FormSection, NumberInput, Select, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { FilterToggle } from './FilterToggle';
import type { WatcherConfig } from './types';

export interface OpportunityCostSectionProps {
  config: WatcherConfig | undefined;
  walletId: string;
  onConfigUpdate: (updates: Partial<WatcherConfig>) => void;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
}

export const OpportunityCostSection = ({
  config,
  walletId,
  onConfigUpdate,
  onFilterToggle,
  isPending,
}: OpportunityCostSectionProps) => {
  const { t } = useTranslation();

  return (
    <FormSection
      title={
        <HStack gap={2}>
          <span>{t('settings.algorithmicAutoTrading.opportunityCost.title')}</span>
          {config?.opportunityCostEnabled && (
            <Badge colorPalette="purple" variant="subtle" size="xs">
              {t('common.active')}
            </Badge>
          )}
        </HStack>
      }
      description={t('settings.algorithmicAutoTrading.opportunityCost.description')}
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
          <Stack gap={4}>
            <Field label={t('settings.algorithmicAutoTrading.opportunityCost.maxHoldingPeriod')}>
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
                  size="xs"
                  w="100px"
                />
                <Text fontSize="sm" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.opportunityCost.bars')}
                </Text>
              </Flex>
            </Field>

            <Field label={t('settings.algorithmicAutoTrading.opportunityCost.staleThreshold')}>
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
                  size="xs"
                  w="100px"
                />
                <Text fontSize="sm" color="fg.muted">%</Text>
              </Flex>
            </Field>

            <Field label={t('settings.algorithmicAutoTrading.opportunityCost.actionWhenStale')}>
              <Select
                value={config?.staleTradeAction ?? 'TIGHTEN_STOP'}
                options={[
                  { value: 'ALERT_ONLY', label: t('settings.algorithmicAutoTrading.opportunityCost.alertOnly') },
                  { value: 'TIGHTEN_STOP', label: t('settings.algorithmicAutoTrading.opportunityCost.tightenStop') },
                  { value: 'AUTO_CLOSE', label: t('settings.algorithmicAutoTrading.opportunityCost.autoClose') },
                ]}
                onChange={(v) => {
                  if (!walletId) return;
                  onConfigUpdate({
                    staleTradeAction: v as 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE',
                  });
                }}
                size="xs"
                usePortal={false}
              />
            </Field>

            <FilterToggle
              label={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.title')}
              description={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.description')}
              checked={config?.timeBasedStopTighteningEnabled ?? true}
              onChange={(value) => onFilterToggle('timeBasedStopTighteningEnabled', value)}
              disabled={isPending}
            />

            {config?.timeBasedStopTighteningEnabled && (
              <HStack gap={3} align="flex-start">
                <Field label={t('settings.algorithmicAutoTrading.opportunityCost.tightenAfterBars')}>
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
                    size="xs"
                  />
                </Field>
                <Field label={t('settings.algorithmicAutoTrading.opportunityCost.tightenPercentPerBar')}>
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
                      size="xs"
                    />
                    <Text fontSize="sm">%</Text>
                  </Flex>
                </Field>
              </HStack>
            )}
          </Stack>
        )}
      </Stack>
    </FormSection>
  );
};
