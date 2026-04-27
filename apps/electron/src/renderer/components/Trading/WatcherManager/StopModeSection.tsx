import { Box, HStack, Text } from '@chakra-ui/react';
import { CollapsibleSection, Radio, RadioGroup } from '@renderer/components/ui';
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
  isPending,
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
      <RadioGroup
        value={initialStopMode}
        onValueChange={onInitialStopModeChange}
        disabled={isPending}
      >
        <HStack gap={6}>
          <Radio value="fibo_target">
            <Box>
              <Text fontSize="sm" fontWeight="medium">
                {t('settings.algorithmicAutoTrading.stopMode.fiboTarget')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.stopMode.fiboTargetDescription')}
              </Text>
            </Box>
          </Radio>
          <Radio value="nearest_swing">
            <Box>
              <Text fontSize="sm" fontWeight="medium">
                {t('settings.algorithmicAutoTrading.stopMode.nearestSwing')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.stopMode.nearestSwingDescription')}
              </Text>
            </Box>
          </Radio>
        </HStack>
      </RadioGroup>
    </CollapsibleSection>
  );
};
