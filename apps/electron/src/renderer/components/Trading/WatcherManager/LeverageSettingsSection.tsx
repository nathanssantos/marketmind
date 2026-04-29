import { Stack } from '@chakra-ui/react';
import { Callout, CollapsibleSection, Field, NumberInput } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface LeverageSettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  leverage: number;
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
}

export const LeverageSettingsSection = ({
  isExpanded,
  onToggle,
  leverage,
  onLeverageChange,
  isPending,
}: LeverageSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.leverage.title', 'Auto-Trading Leverage')}
      description={t('settings.algorithmicAutoTrading.leverage.autoTradingDescription', 'Default leverage for auto-trading entries on new symbols')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
    >
      <Stack gap={3}>
        <Field label={t('settings.algorithmicAutoTrading.leverage.label', 'Leverage')}>
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
          {t('settings.algorithmicAutoTrading.leverage.warning', 'Higher leverage increases both potential gains and losses. Use with caution.')}
        </Callout>
      </Stack>
    </CollapsibleSection>
  );
};
