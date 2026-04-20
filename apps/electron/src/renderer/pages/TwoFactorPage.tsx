import { Text, VStack } from '@chakra-ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Field, Input, Link } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI, isRateLimited } from '../utils/auth';

export const TwoFactorPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, rememberMe } = (location.state as { userId?: string; rememberMe?: boolean }) ?? {};

  const {
    verifyTwoFactor,
    resendTwoFactorCode,
    isVerifyingTwoFactor,
    isResendingTwoFactor,
    twoFactorError,
  } = useBackendAuth();

  const [code, setCode] = useState('');
  const [resent, setResent] = useState(false);

  if (!userId) {
    return (
      <AuthLayout title={t('auth.twoFactor.title')}>
        <VStack gap={4} align="stretch">
          <Alert.Root status="error" size="sm">
            <Alert.Indicator />
            <Alert.Description>{t('auth.login.invalidCredentials')}</Alert.Description>
          </Alert.Root>
          <Link asChild colorPalette="blue" fontSize="sm" textAlign="center">
            <RouterLink to="/login">{t('auth.twoFactor.backToLogin')}</RouterLink>
          </Link>
        </VStack>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await verifyTwoFactor(userId, code, rememberMe);
      void navigate('/');
    } catch {
      // Error handled by twoFactorError
    }
  };

  const onFormSubmit = (e: FormEvent) => { void handleSubmit(e); };

  const handleResend = async () => {
    try {
      await resendTwoFactorCode(userId);
      setResent(true);
      setTimeout(() => setResent(false), AUTH_UI.RESEND_TIMEOUT_MS);
    } catch {
      // Silently fail
    }
  };

  const onResendClick = () => { void handleResend(); };

  const errorMessage = isRateLimited(twoFactorError)
    ? t('auth.login.rateLimited')
    : twoFactorError
      ? t('auth.twoFactor.invalidCode')
      : null;

  return (
    <AuthLayout title={t('auth.twoFactor.title')} subtitle={t('auth.twoFactor.subtitle')}>
      <form onSubmit={onFormSubmit}>
        <VStack gap={4} align="stretch">
          {errorMessage && (
            <Alert.Root status="error" size="sm">
              <Alert.Indicator />
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Root>
          )}

          {resent && (
            <Alert.Root status="success" size="sm">
              <Alert.Indicator />
              <Alert.Description>{t('auth.twoFactor.resent')}</Alert.Description>
            </Alert.Root>
          )}

          <Field label={t('auth.twoFactor.code')}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, AUTH_UI.TWO_FACTOR_CODE_LENGTH))}
              placeholder="000000"
              maxLength={AUTH_UI.TWO_FACTOR_CODE_LENGTH}
              required
              autoFocus
              textAlign="center"
              fontSize="2xl"
              letterSpacing="0.5em"
            />
          </Field>

          <Button
            type="submit"
            colorPalette="blue"
            width="full"
            loading={isVerifyingTwoFactor}
            disabled={code.length !== AUTH_UI.TWO_FACTOR_CODE_LENGTH}
          >
            {t('auth.twoFactor.submit')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            width="full"
            onClick={onResendClick}
            loading={isResendingTwoFactor}
          >
            {t('auth.twoFactor.resend')}
          </Button>

          <Text fontSize="sm" textAlign="center" color="fg.muted">
            <Link asChild colorPalette="blue">
              <RouterLink to="/login">{t('auth.twoFactor.backToLogin')}</RouterLink>
            </Link>
          </Text>
        </VStack>
      </form>
    </AuthLayout>
  );
};
