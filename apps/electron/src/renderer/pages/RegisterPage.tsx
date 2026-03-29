import { Text, VStack } from '@chakra-ui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button, Field, Input, Link, PasswordInput } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI, isConflict } from '../utils/auth';

export const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isRegistering, registerError } = useBackendAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMismatch(false);

    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }

    try {
      await register(email, password);
      navigate('/verify-email');
    } catch {
      // Error is handled by registerError state
    }
  };

  const errorMessage = mismatch
    ? t('auth.register.passwordMismatch')
    : isConflict(registerError)
      ? t('auth.register.emailInUse')
      : registerError?.message ?? null;

  return (
    <AuthLayout title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <form onSubmit={handleSubmit}>
        <VStack gap={4} align="stretch">
          {errorMessage && (
            <Alert.Root status="error" size="sm">
              <Alert.Indicator />
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Root>
          )}

          <Field label={t('auth.register.email')}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={AUTH_UI.EMAIL_PLACEHOLDER}
              required
              autoFocus
            />
          </Field>

          <Field
            label={t('auth.register.password')}
            helperText={t('auth.validation.passwordMin')}
          >
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>

          <Field label={t('auth.register.confirmPassword')}>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>

          <Button
            type="submit"
            colorPalette="blue"
            width="full"
            loading={isRegistering}
          >
            {t('auth.register.submit')}
          </Button>

          <Text fontSize="sm" textAlign="center" color="fg.muted">
            {t('auth.register.hasAccount')}{' '}
            <Link asChild colorPalette="blue">
              <RouterLink to="/login">{t('auth.register.signIn')}</RouterLink>
            </Link>
          </Text>
        </VStack>
      </form>
    </AuthLayout>
  );
};
