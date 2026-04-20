import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { useBackendAuth } from '../../hooks/useBackendAuth';

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useBackendAuth();
  const { t } = useTranslation();

  if (IS_E2E_BYPASS_AUTH) return <>{children}</>;

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>{t('common.loading')}</Text>
        </VStack>
      </Box>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
