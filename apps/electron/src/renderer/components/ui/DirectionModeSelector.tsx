import { HStack } from '@chakra-ui/react';
import { Button } from './button';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';

export type DirectionMode = 'auto' | 'long_only' | 'short_only';

interface DirectionModeSelectorProps {
  value: DirectionMode;
  onChange: (mode: DirectionMode) => void;
  disabled?: boolean;
  size?: 'xs' | '2xs';
}

export function DirectionModeSelector({ value, onChange, disabled, size = 'xs' }: DirectionModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <HStack gap={1}>
      <Button
        size={size}
        variant={value === 'short_only' ? 'solid' : 'outline'}
        colorPalette={value === 'short_only' ? 'red' : 'gray'}
        onClick={() => onChange(value === 'short_only' ? 'auto' : 'short_only')}
        disabled={disabled}
        flex={1}
      >
        <LuTrendingDown />
        {t('settings.algorithmicAutoTrading.directionMode.shortOnly')}
      </Button>
      <Button
        size={size}
        variant={value === 'auto' ? 'solid' : 'outline'}
        colorPalette="gray"
        onClick={() => onChange('auto')}
        disabled={disabled}
        flex={1}
      >
        <LuArrowUpDown />
        {t('settings.algorithmicAutoTrading.directionMode.auto')}
      </Button>
      <Button
        size={size}
        variant={value === 'long_only' ? 'solid' : 'outline'}
        colorPalette={value === 'long_only' ? 'green' : 'gray'}
        onClick={() => onChange(value === 'long_only' ? 'auto' : 'long_only')}
        disabled={disabled}
        flex={1}
      >
        <LuTrendingUp />
        {t('settings.algorithmicAutoTrading.directionMode.longOnly')}
      </Button>
    </HStack>
  );
}
