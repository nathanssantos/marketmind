import { Stack } from '@chakra-ui/react';
import { Callout, FormSection, Field, NumberInput } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface LeverageSettingsSectionProps {
  leverage: number;
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
}

export const LeverageSettingsSection = ({
  leverage,
  onLeverageChange,
  isPending,
}: LeverageSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <FormSection
      title={t('settings.algorithmicAutoTrading.leverage.title')}
      description={t('settings.algorithmicAutoTrading.leverage.autoTradingDescription')}
    >
      <Stack gap={3}>
        <Field label={t('settings.algorithmicAutoTrading.leverage.label')}>
          <NumberInput
            min={1}
            max={125}
            value={leverage}
            onChange={onLeverageChange}
            size="sm"
            disabled={isPending}
          />
        </Field>
        <Callout tone="warning" compact>
          {t('settings.algorithmicAutoTrading.leverage.warning')}
        </Callout>
      </Stack>
    </FormSection>
  );
};
