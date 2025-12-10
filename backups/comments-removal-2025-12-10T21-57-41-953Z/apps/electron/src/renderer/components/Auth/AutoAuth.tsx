import { Box, Spinner, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useBackendAuth } from '../../hooks/useBackendAuth';

const DEV_USER_EMAIL = 'dev@marketmind.local';
const DEV_USER_PASSWORD = 'dev123456';

export const AutoAuth = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated, register, login } = useBackendAuth();

  useEffect(() => {
    const autoLogin = async () => {
      if (isLoading || isAuthenticated) return;

      console.log('[AutoAuth] Attempting auto-login...');

      try {
        await login(DEV_USER_EMAIL, DEV_USER_PASSWORD);
        console.log('[AutoAuth] Login successful');
      } catch (error) {
        console.log('[AutoAuth] Login failed, trying to register...');
        try {
          await register(DEV_USER_EMAIL, DEV_USER_PASSWORD);
          console.log('[AutoAuth] Registration successful');
        } catch (registerError) {
          console.error('[AutoAuth] Auto-auth failed:', registerError);
        }
      }
    };

    autoLogin();
  }, [isLoading, isAuthenticated, login, register]);

  if (isLoading || !isAuthenticated) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100vh"
        flexDirection="column"
        gap={4}
      >
        <Spinner size="xl" />
        <Text>Authenticating...</Text>
      </Box>
    );
  }

  return <>{children}</>;
};
