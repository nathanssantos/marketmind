import { PasswordStrengthMeter as PasswordStrengthMeterCore, type PasswordStrengthMeterLabels } from '@marketmind/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthMeterProps {
  password: string;
  visible?: boolean;
}

/**
 * Renderer-side wrapper around `@marketmind/ui`'s
 * `PasswordStrengthMeter`. Resolves the locale-agnostic `labels` prop
 * via `react-i18next` so app callers don't have to. The core component
 * is locale-free for ui-core extraction (v1.6 B.3).
 */
export const PasswordStrengthMeter = ({ password, visible }: PasswordStrengthMeterProps) => {
  const { t } = useTranslation();
  const labels = useMemo<PasswordStrengthMeterLabels>(() => ({
    strength: {
      weak: t('auth.passwordPolicy.weak'),
      fair: t('auth.passwordPolicy.fair'),
      good: t('auth.passwordPolicy.good'),
      strong: t('auth.passwordPolicy.strong'),
      excellent: t('auth.passwordPolicy.excellent'),
    },
    rules: {
      tooShort: t('auth.passwordPolicy.tooShort'),
      noUppercase: t('auth.passwordPolicy.noUppercase'),
      noLowercase: t('auth.passwordPolicy.noLowercase'),
      noDigit: t('auth.passwordPolicy.noDigit'),
      noSymbol: t('auth.passwordPolicy.noSymbol'),
      common: t('auth.passwordPolicy.common'),
    },
  }), [t]);

  return <PasswordStrengthMeterCore password={password} visible={visible} labels={labels} />;
};
