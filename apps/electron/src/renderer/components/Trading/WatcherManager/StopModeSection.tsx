import { CollapsibleSection, Field, Select } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface StopModeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  initialStopMode: 'fibo_target' | 'nearest_swing';
  onInitialStopModeChange: (details: { value: string }) => void;
  isPending: boolean;
}

export const StopModeSection = ({
  isExpanded,
  onToggle,
  initialStopMode,
  onInitialStopModeChange,
}: StopModeSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.stopMode.title')}
      description={t('settings.algorithmicAutoTrading.stopMode.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
    >
      <Field
        label={t('settings.algorithmicAutoTrading.stopMode.label', 'Initial stop placement')}
        helperText={
          initialStopMode === 'fibo_target'
            ? t('settings.algorithmicAutoTrading.stopMode.fiboTargetDescription')
            : t('settings.algorithmicAutoTrading.stopMode.nearestSwingDescription')
        }
      >
        <Select
          value={initialStopMode}
          options={[
            { value: 'fibo_target', label: t('settings.algorithmicAutoTrading.stopMode.fiboTarget') },
            { value: 'nearest_swing', label: t('settings.algorithmicAutoTrading.stopMode.nearestSwing') },
          ]}
          onChange={(v) => onInitialStopModeChange({ value: v })}
          size="sm"
          usePortal={false}
        />
      </Field>
    </CollapsibleSection>
  );
};
