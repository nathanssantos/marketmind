import { Stack } from '@chakra-ui/react';
import { CollapsibleSection, Field, Select } from '@renderer/components/ui';
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
}: TpModeSectionProps) => {
  const { t } = useTranslation();

  const fibLevelOptions = [
    { value: 'auto', label: t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.auto') },
    { value: '1', label: `100% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservative')}` },
    { value: '1.272', label: `127.2% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderate')}` },
    { value: '1.382', label: `138.2% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateAggressive')}` },
    { value: '1.618', label: `161.8% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressive')}` },
    { value: '2', label: `200% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extended')}` },
    { value: '2.618', label: `261.8% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtended')}` },
    { value: '3', label: `300% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.triple')}` },
    { value: '3.618', label: `361.8% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.ultraExtended')}` },
    { value: '4.236', label: `423.6% — ${t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.maximum')}` },
  ];

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.tpMode.title')}
      description={t('settings.algorithmicAutoTrading.tpMode.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
    >
      <Stack gap={4}>
        <Field
          label={t('settings.algorithmicAutoTrading.tpMode.calculationLabel')}
          helperText={
            tpCalculationMode === 'default'
              ? t('settings.algorithmicAutoTrading.tpMode.defaultDescription')
              : t('settings.algorithmicAutoTrading.tpMode.fibonacciDescription')
          }
        >
          <Select
            value={tpCalculationMode}
            options={[
              { value: 'default', label: t('settings.algorithmicAutoTrading.tpMode.default') },
              { value: 'fibonacci', label: t('settings.algorithmicAutoTrading.tpMode.fibonacci') },
            ]}
            onChange={(v) => onTpModeChange({ value: v })}
            size="sm"
            usePortal={false}
          />
        </Field>

        {tpCalculationMode === 'fibonacci' && (
          <Stack gap={4}>
            <Field
              label={t('settings.algorithmicAutoTrading.tpMode.swingRange.title')}
              helperText={
                fibonacciSwingRange === 'extended'
                  ? t('settings.algorithmicAutoTrading.tpMode.swingRange.extendedDescription')
                  : t('settings.algorithmicAutoTrading.tpMode.swingRange.nearestDescription')
              }
            >
              <Select
                value={fibonacciSwingRange}
                options={[
                  { value: 'extended', label: t('settings.algorithmicAutoTrading.tpMode.swingRange.extended') },
                  { value: 'nearest', label: t('settings.algorithmicAutoTrading.tpMode.swingRange.nearest') },
                ]}
                onChange={(v) => onFibonacciSwingRangeChange({ value: v })}
                size="sm"
                usePortal={false}
              />
            </Field>

            <Field label={t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.titleLong')}>
              <Select
                value={fibonacciTargetLevelLong}
                options={fibLevelOptions}
                onChange={(v) => onFibonacciLevelLongChange({ value: v })}
                size="sm"
                usePortal={false}
              />
            </Field>

            <Field label={t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.titleShort')}>
              <Select
                value={fibonacciTargetLevelShort}
                options={fibLevelOptions}
                onChange={(v) => onFibonacciLevelShortChange({ value: v })}
                size="sm"
                usePortal={false}
              />
            </Field>
          </Stack>
        )}
      </Stack>
    </CollapsibleSection>
  );
};
