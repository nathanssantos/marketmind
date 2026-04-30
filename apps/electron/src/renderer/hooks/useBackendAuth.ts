import { useCallback } from 'react';
import { IS_E2E_BYPASS_AUTH, QUERY_CONFIG, SYNTHETIC_E2E_USER } from '@shared/constants';
import { trpc } from '../utils/trpc';

export const useBackendAuth = () => {
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const requestPasswordResetMutation = trpc.auth.requestPasswordReset.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();
  const resendVerificationMutation = trpc.auth.resendVerificationEmail.useMutation();
  const verifyTwoFactorMutation = trpc.auth.verifyTwoFactor.useMutation();
  const resendTwoFactorMutation = trpc.auth.resendTwoFactorCode.useMutation();
  const toggleTwoFactorMutation = trpc.auth.toggleTwoFactor.useMutation();
  const changePasswordMutation = trpc.auth.changePassword.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const uploadAvatarMutation = trpc.auth.uploadAvatar.useMutation();
  const deleteAvatarMutation = trpc.auth.deleteAvatar.useMutation();

  const { data: realUser, isLoading: realIsLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: (failureCount, error) => {
      const msg = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error)
          ? String((error as { message: unknown }).message)
          : String(error);
      if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
    enabled: !IS_E2E_BYPASS_AUTH,
  });

  const currentUser = IS_E2E_BYPASS_AUTH ? SYNTHETIC_E2E_USER : realUser;
  const isLoading = IS_E2E_BYPASS_AUTH ? false : realIsLoading;

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      const result = await loginMutation.mutateAsync({ email, password, rememberMe });
      if (!result.requiresTwoFactor) await refetch();
      return result;
    },
    [loginMutation, refetch]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const result = await registerMutation.mutateAsync({ email, password });
      await refetch();
      return result;
    },
    [registerMutation, refetch]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await refetch();
  }, [logoutMutation, refetch]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      return await requestPasswordResetMutation.mutateAsync({ email });
    },
    [requestPasswordResetMutation]
  );

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      return await resetPasswordMutation.mutateAsync({ token, password });
    },
    [resetPasswordMutation]
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      const result = await verifyEmailMutation.mutateAsync({ token });
      await refetch();
      return result;
    },
    [verifyEmailMutation, refetch]
  );

  const resendVerificationEmail = useCallback(async () => {
    return await resendVerificationMutation.mutateAsync();
  }, [resendVerificationMutation]);

  const verifyTwoFactor = useCallback(
    async (userId: string, code: string, rememberMe = false) => {
      const result = await verifyTwoFactorMutation.mutateAsync({ userId, code, rememberMe });
      await refetch();
      return result;
    },
    [verifyTwoFactorMutation, refetch]
  );

  const resendTwoFactorCode = useCallback(
    async (userId: string) => {
      return await resendTwoFactorMutation.mutateAsync({ userId });
    },
    [resendTwoFactorMutation]
  );

  const toggleTwoFactor = useCallback(
    async (enabled: boolean) => {
      const result = await toggleTwoFactorMutation.mutateAsync({ enabled });
      await refetch();
      return result;
    },
    [toggleTwoFactorMutation, refetch]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      return await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
    },
    [changePasswordMutation]
  );

  const updateProfile = useCallback(
    async (input: { name?: string; avatarColor?: string | null }) => {
      const result = await updateProfileMutation.mutateAsync(input);
      await refetch();
      return result;
    },
    [updateProfileMutation, refetch]
  );

  const uploadAvatar = useCallback(
    async (data: string, mimeType: string) => {
      const result = await uploadAvatarMutation.mutateAsync({ data, mimeType });
      await refetch();
      return result;
    },
    [uploadAvatarMutation, refetch]
  );

  const deleteAvatar = useCallback(
    async () => {
      const result = await deleteAvatarMutation.mutateAsync();
      await refetch();
      return result;
    },
    [deleteAvatarMutation, refetch]
  );

  return {
    currentUser,
    isLoading,
    isAuthenticated: !!currentUser,
    login,
    register,
    logout,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    verifyTwoFactor,
    resendTwoFactorCode,
    toggleTwoFactor,
    changePassword,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isRequestingReset: requestPasswordResetMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    isVerifyingEmail: verifyEmailMutation.isPending,
    isResendingVerification: resendVerificationMutation.isPending,
    isVerifyingTwoFactor: verifyTwoFactorMutation.isPending,
    isResendingTwoFactor: resendTwoFactorMutation.isPending,
    isTogglingTwoFactor: toggleTwoFactorMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    isDeletingAvatar: deleteAvatarMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    logoutError: logoutMutation.error,
    resetError: resetPasswordMutation.error,
    verifyEmailError: verifyEmailMutation.error,
    twoFactorError: verifyTwoFactorMutation.error,
    changePasswordError: changePasswordMutation.error,
    uploadAvatarError: uploadAvatarMutation.error,
  };
};
