import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { AppLoader } from '@renderer/components/ui';
import { useBackendAuth } from '../../hooks/useBackendAuth';

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useBackendAuth();

  if (IS_E2E_BYPASS_AUTH) return <>{children}</>;

  if (isLoading) return <AppLoader />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
