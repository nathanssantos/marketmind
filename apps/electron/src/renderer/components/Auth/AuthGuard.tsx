import { Box, Spinner } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { useBackendAuth } from '../../hooks/useBackendAuth';

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useBackendAuth();

  if (IS_E2E_BYPASS_AUTH) return <>{children}</>;

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
