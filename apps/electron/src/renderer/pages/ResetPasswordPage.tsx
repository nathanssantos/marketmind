import { Spinner, VStack } from '@chakra-ui/react';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthFooterLink, AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Field, PasswordInput, PasswordStrengthMeter } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI } from '../utils/auth';
import { trpc } from '../utils/trpc';

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { resetPassword, isResettingPassword, resetError } = useBackendAuth();

  const { data: tokenStatus, isLoading: isValidating } = trpc.auth.validateResetToken.useQuery(
    { token: token ?? '' },
    { enabled: !!token, retry: false }
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => { void navigate('/login'); }, AUTH_UI.FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMismatch(false);

    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }

    try {
      await resetPassword(token!, password);
      setSuccess(true);
    } catch {
      // Error handled by resetError
    }
  };

  if (isValidating) {
    return (
      <AuthLayout title={t('auth.resetPassword.title')}>
        <VStack py={8}><Spinner size="lg" /></VStack>
      </AuthLayout>
    );
  }

  if (!tokenStatus?.valid) {
    return (
      <AuthLayout
        title={t('auth.resetPassword.title')}
        footer={
          <VStack gap={2}>
            <AuthFooterLink label={t('auth.resetPassword.requestNew')} to="/forgot-password" />
            <AuthFooterLink label={t('auth.resetPassword.backToLogin')} to="/login" />
          </VStack>
        }
      >
        <Alert.Root status="error" size="sm">
          <Alert.Indicator />
          <Alert.Description>{t('auth.resetPassword.invalidToken')}</Alert.Description>
        </Alert.Root>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title={t('auth.resetPassword.successTitle')}>
        <Alert.Root status="success" size="sm">
          <Alert.Indicator />
          <Alert.Description>{t('auth.resetPassword.successMessage')}</Alert.Description>
        </Alert.Root>
      </AuthLayout>
    );
  }

  const errorMessage = mismatch
    ? t('auth.register.passwordMismatch')
    : resetError?.message ?? null;

  return (
    <AuthLayout
      title={t('auth.resetPassword.title')}
      subtitle={t('auth.resetPassword.subtitle')}
      footer={<AuthFooterLink label={t('auth.resetPassword.backToLogin')} to="/login" />}
    >
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <VStack gap={4} align="stretch">
          {errorMessage && (
            <Alert.Root status="error" size="sm">
              <Alert.Indicator />
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Root>
          )}

          <Field label={t('auth.resetPassword.newPassword')}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoFocus
            />
            <PasswordStrengthMeter password={password} />
          </Field>

          <Field label={t('auth.resetPassword.confirmPassword')}>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
            />
          </Field>

          <Button
            type="submit"
            colorPalette="blue"
            width="full"
            loading={isResettingPassword}
          >
            {t('auth.resetPassword.submit')}
          </Button>
        </VStack>
      </form>
    </AuthLayout>
  );
};
