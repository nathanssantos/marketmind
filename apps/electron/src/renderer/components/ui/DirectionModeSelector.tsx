import { useTranslation } from 'react-i18next';
import { Select } from '@marketmind/ui-core';

export type DirectionMode = 'auto' | 'long_only' | 'short_only';

interface DirectionModeSelectorProps {
  value: DirectionMode;
  onChange: (mode: DirectionMode) => void;
  disabled?: boolean;
  size?: 'xs' | '2xs' | 'sm';
}

export function DirectionModeSelector({ value, onChange, size = 'sm' }: DirectionModeSelectorProps) {
  const { t } = useTranslation();
  return (
    <Select
      value={value}
      options={[
        { value: 'auto', label: t('settings.algorithmicAutoTrading.directionMode.auto') },
        { value: 'long_only', label: t('settings.algorithmicAutoTrading.directionMode.longOnly') },
        { value: 'short_only', label: t('settings.algorithmicAutoTrading.directionMode.shortOnly') },
      ]}
      onChange={(v) => onChange(v as DirectionMode)}
      size={size === '2xs' ? 'xs' : size}
      usePortal={false}
    />
  );
}
