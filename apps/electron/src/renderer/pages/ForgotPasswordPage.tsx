import { VStack } from '@chakra-ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFooterLink, AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Field, Input } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI } from '../utils/auth';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const { requestPasswordReset, isRequestingReset } = useBackendAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
  };

  const backToLogin = (
    <AuthFooterLink label={t('auth.forgotPassword.backToLogin')} to="/login" />
  );

  if (submitted) {
    return (
      <AuthLayout title={t('auth.forgotPassword.successTitle')} footer={backToLogin}>
        <Alert.Root status="success" size="sm">
          <Alert.Indicator />
          <Alert.Description>{t('auth.forgotPassword.successMessage')}</Alert.Description>
        </Alert.Root>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}
      footer={backToLogin}
    >
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <VStack gap={4} align="stretch">
          <Field label={t('auth.forgotPassword.email')}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={AUTH_UI.EMAIL_PLACEHOLDER}
              required
              autoFocus
            />
          </Field>

          <Button
            type="submit"
            colorPalette="blue"
            width="full"
            loading={isRequestingReset}
          >
            {t('auth.forgotPassword.submit')}
          </Button>
        </VStack>
      </form>
    </AuthLayout>
  );
};
