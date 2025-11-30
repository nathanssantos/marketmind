import { useCallback } from 'react';
import { trpc } from '../utils/trpc';

export const useBackendAuth = () => {
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: currentUser, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation.mutateAsync({ email, password });
      await refetch();
      return result;
    },
    [loginMutation, refetch]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await registerMutation.mutateAsync({ email, password, name });
      await refetch();
      return result;
    },
    [registerMutation, refetch]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await refetch();
  }, [logoutMutation, refetch]);

  return {
    currentUser,
    isLoading,
    isAuthenticated: !!currentUser,
    login,
    register,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
};
