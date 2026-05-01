import { VStack, Text } from '@chakra-ui/react';
import { Switch, Slider, Field } from '@renderer/components/ui';
import type { ScalpingStrategy } from '@marketmind/types';
import { SCALPING_STRATEGIES } from '@marketmind/types';
import { useTranslation } from 'react-i18next';

interface StrategySectionProps {
  enabledStrategies: ScalpingStrategy[];
  imbalanceThreshold: number;
  cvdDivergenceBars: number;
  vwapDeviationSigma: number;
  absorptionThreshold: number;
  onStrategyToggle: (strategy: ScalpingStrategy, enabled: boolean) => void;
  onParamChange: (key: string, value: number) => void;
}

export function StrategySection({
  enabledStrategies,
  imbalanceThreshold,
  cvdDivergenceBars,
  vwapDeviationSigma,
  absorptionThreshold,
  onStrategyToggle,
  onParamChange,
}: StrategySectionProps) {
  const { t } = useTranslation();

  return (
    <VStack gap={4} align="stretch">
      <Text fontWeight="semibold">{t('scalping.config.strategies')}</Text>

      {SCALPING_STRATEGIES.map((strategy) => (
        <Switch
          key={strategy}
          checked={enabledStrategies.includes(strategy)}
          onCheckedChange={(checked) => onStrategyToggle(strategy, checked)}
        >
          {t(`scalping.strategy.${strategy}`, strategy)}
        </Switch>
      ))}

      <Field label={t('scalping.config.imbalanceThreshold')}>
        <Slider
          min={0.1}
          max={1.0}
          step={0.05}
          value={[imbalanceThreshold]}
          onValueChange={(values) => onParamChange('imbalanceThreshold', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{imbalanceThreshold.toFixed(2)}</Text>
      </Field>

      <Field label={t('scalping.config.cvdDivergenceBars')}>
        <Slider
          min={3}
          max={50}
          step={1}
          value={[cvdDivergenceBars]}
          onValueChange={(values) => onParamChange('cvdDivergenceBars', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{cvdDivergenceBars}</Text>
      </Field>

      <Field label={t('scalping.config.vwapDeviationSigma')}>
        <Slider
          min={0.5}
          max={5.0}
          step={0.1}
          value={[vwapDeviationSigma]}
          onValueChange={(values) => onParamChange('vwapDeviationSigma', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{vwapDeviationSigma.toFixed(1)}</Text>
      </Field>

      <Field label={t('scalping.config.absorptionThreshold')}>
        <Slider
          min={1}
          max={10}
          step={0.5}
          value={[absorptionThreshold]}
          onValueChange={(values) => onParamChange('absorptionThreshold', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{absorptionThreshold.toFixed(1)}</Text>
      </Field>
    </VStack>
  );
}
