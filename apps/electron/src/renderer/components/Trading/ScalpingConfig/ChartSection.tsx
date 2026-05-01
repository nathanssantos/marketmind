import { VStack, Text } from '@chakra-ui/react';
import { Slider, Field } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

interface ChartSectionProps {
  ticksPerBar: number;
  volumePerBar: number;
  depthLevels: number;
  onParamChange: (key: string, value: number) => void;
}

export function ChartSection({
  ticksPerBar,
  volumePerBar,
  depthLevels,
  onParamChange,
}: ChartSectionProps) {
  const { t } = useTranslation();

  return (
    <VStack gap={4} align="stretch">
      <Text fontWeight="semibold">{t('scalping.config.chart')}</Text>

      <Field label={t('scalping.config.ticksPerBar')}>
        <Slider
          min={50}
          max={2000}
          step={1}
          value={[ticksPerBar]}
          onValueChange={(values) => onParamChange('ticksPerBar', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{ticksPerBar}</Text>
      </Field>

      <Field label={t('scalping.config.volumePerBar')}>
        <Slider
          min={100}
          max={50000}
          step={100}
          value={[volumePerBar]}
          onValueChange={(values) => onParamChange('volumePerBar', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{volumePerBar.toLocaleString()}</Text>
      </Field>

      <Field label={t('scalping.config.depthLevels')}>
        <Slider
          min={5}
          max={50}
          step={5}
          value={[depthLevels]}
          onValueChange={(values) => onParamChange('depthLevels', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{depthLevels}</Text>
      </Field>
    </VStack>
  );
}
