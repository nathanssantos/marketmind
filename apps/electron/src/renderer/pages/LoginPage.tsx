import { HStack, Text, VStack } from '@chakra-ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Checkbox, Field, Input, Link, PasswordInput } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI, isRateLimited } from '../utils/auth';

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoggingIn, loginError } = useBackendAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await login(email, password, rememberMe);
      if (result.requiresTwoFactor) {
        navigate('/two-factor', { state: { userId: result.userId, rememberMe } });
      } else {
        navigate('/');
      }
    } catch {
      // Error is handled by loginError state
    }
  };

  const errorMessage = isRateLimited(loginError)
    ? t('auth.login.rateLimited')
    : loginError
      ? t('auth.login.invalidCredentials')
      : null;

  return (
    <AuthLayout title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form onSubmit={handleSubmit}>
        <VStack gap={4} align="stretch">
          {errorMessage && (
            <Alert.Root status="error" size="sm">
              <Alert.Indicator />
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Root>
          )}

          <Field label={t('auth.login.email')}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={AUTH_UI.EMAIL_PLACEHOLDER}
              required
              autoFocus
            />
          </Field>

          <Field label={t('auth.login.password')}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <HStack justify="space-between">
            <Checkbox checked={rememberMe} onCheckedChange={setRememberMe}>
              <Text fontSize="sm">{t('auth.login.rememberMe')}</Text>
            </Checkbox>
            <Link asChild fontSize="sm" colorPalette="blue">
              <RouterLink to="/forgot-password">{t('auth.login.forgotPassword')}</RouterLink>
            </Link>
          </HStack>

          <Button
            type="submit"
            colorPalette="blue"
            width="full"
            loading={isLoggingIn}
          >
            {t('auth.login.submit')}
          </Button>

          <Text fontSize="sm" textAlign="center" color="fg.muted">
            {t('auth.login.noAccount')}{' '}
            <Link asChild colorPalette="blue">
              <RouterLink to="/register">{t('auth.login.createAccount')}</RouterLink>
            </Link>
          </Text>
        </VStack>
      </form>
    </AuthLayout>
  );
};
