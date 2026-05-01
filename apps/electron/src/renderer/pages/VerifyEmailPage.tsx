import { Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import { MM } from '@marketmind/tokens';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthFooterLink, AuthLayout } from '../components/Auth/AuthLayout';
import { Alert, Button } from '../components/ui';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AUTH_UI } from '../utils/auth';

export const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const {
    currentUser,
    verifyEmail,
    resendVerificationEmail,
    isVerifyingEmail,
    isResendingVerification,
    verifyEmailError,
  } = useBackendAuth();

  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setVerified(true))
      .catch(() => {});
  }, [token, verifyEmail]);

  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => { void navigate('/'); }, AUTH_UI.FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [verified, navigate]);

  const backToLogin = (
    <AuthFooterLink label={t('auth.resetPassword.backToLogin')} to="/login" />
  );

  if (token && isVerifyingEmail) {
    return (
      <AuthLayout title={t('auth.verifyEmail.title')}>
        <Flex justify="center" align="center" py={MM.spinner.panel.py}>
          <Spinner size={MM.spinner.panel.size} />
        </Flex>
      </AuthLayout>
    );
  }

  if (verified || currentUser?.emailVerified) {
    return (
      <AuthLayout title={t('auth.verifyEmail.successTitle')}>
        <Alert.Root status="success" size="sm">
          <Alert.Indicator />
          <Alert.Description>{t('auth.verifyEmail.successMessage')}</Alert.Description>
        </Alert.Root>
      </AuthLayout>
    );
  }

  if (token && verifyEmailError) {
    return (
      <AuthLayout title={t('auth.verifyEmail.title')} footer={backToLogin}>
        <Alert.Root status="error" size="sm">
          <Alert.Indicator />
          <Alert.Description>{t('auth.verifyEmail.invalidToken')}</Alert.Description>
        </Alert.Root>
      </AuthLayout>
    );
  }

  const handleResend = async () => {
    try {
      await resendVerificationEmail();
      setResent(true);
      setTimeout(() => setResent(false), AUTH_UI.RESEND_TIMEOUT_MS);
    } catch {
      // Error handled silently
    }
  };

  return (
    <AuthLayout title={t('auth.verifyEmail.title')} subtitle={t('auth.verifyEmail.subtitle')}>
      <VStack gap={4} align="stretch">
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {t('auth.verifyEmail.checkInbox')}
        </Text>

        {resent && (
          <Alert.Root status="success" size="sm">
            <Alert.Indicator />
            <Alert.Description>{t('auth.verifyEmail.resent')}</Alert.Description>
          </Alert.Root>
        )}

        <Button
          variant="outline"
          width="full"
          onClick={() => { void handleResend(); }}
          loading={isResendingVerification}
        >
          {t('auth.verifyEmail.resend')}
        </Button>

        <Button
          variant="ghost"
          width="full"
          onClick={() => { void navigate('/'); }}
        >
          {t('auth.verifyEmail.continueWithout')}
        </Button>
      </VStack>
    </AuthLayout>
  );
};
