import { Text, VStack } from '@chakra-ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Field, Input, Link } from '../components/ui';
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

  if (submitted) {
    return (
      <AuthLayout title={t('auth.forgotPassword.successTitle')}>
        <VStack gap={4} align="stretch">
          <Alert.Root status="success" size="sm">
            <Alert.Indicator />
            <Alert.Description>{t('auth.forgotPassword.successMessage')}</Alert.Description>
          </Alert.Root>

          <Text fontSize="sm" textAlign="center" color="fg.muted">
            <Link asChild colorPalette="blue">
              <RouterLink to="/login">{t('auth.forgotPassword.backToLogin')}</RouterLink>
            </Link>
          </Text>
        </VStack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.forgotPassword.title')} subtitle={t('auth.forgotPassword.subtitle')}>
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

          <Text fontSize="sm" textAlign="center" color="fg.muted">
            <Link asChild colorPalette="blue">
              <RouterLink to="/login">{t('auth.forgotPassword.backToLogin')}</RouterLink>
            </Link>
          </Text>
        </VStack>
      </form>
    </AuthLayout>
  );
};
