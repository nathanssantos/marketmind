import { useCallback } from 'react';
import type { CreateTradingProfileInput, UpdateTradingProfileInput } from '@marketmind/types';
import { trpc } from '../utils/trpc';

export const useTradingProfiles = () => {
  const utils = trpc.useUtils();

  const { data: profiles, isLoading: isLoadingProfiles } = trpc.tradingProfiles.list.useQuery();

  const createProfileMutation = trpc.tradingProfiles.create.useMutation({
    onSuccess: () => {
      utils.tradingProfiles.list.invalidate();
    },
  });

  const updateProfileMutation = trpc.tradingProfiles.update.useMutation({
    onSuccess: () => {
      utils.tradingProfiles.list.invalidate();
    },
  });

  const deleteProfileMutation = trpc.tradingProfiles.delete.useMutation({
    onSuccess: () => {
      utils.tradingProfiles.list.invalidate();
    },
  });

  const duplicateProfileMutation = trpc.tradingProfiles.duplicate.useMutation({
    onSuccess: () => {
      utils.tradingProfiles.list.invalidate();
    },
  });

  const assignToWatcherMutation = trpc.tradingProfiles.assignToWatcher.useMutation({
    onSuccess: () => {
      utils.tradingProfiles.list.invalidate();
      utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const createProfile = useCallback(
    async (data: CreateTradingProfileInput) => {
      return createProfileMutation.mutateAsync(data);
    },
    [createProfileMutation]
  );

  const updateProfile = useCallback(
    async (id: string, data: UpdateTradingProfileInput) => {
      return updateProfileMutation.mutateAsync({ id, ...data });
    },
    [updateProfileMutation]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      return deleteProfileMutation.mutateAsync({ id });
    },
    [deleteProfileMutation]
  );

  const duplicateProfile = useCallback(
    async (id: string, newName: string) => {
      return duplicateProfileMutation.mutateAsync({ id, newName });
    },
    [duplicateProfileMutation]
  );

  const assignToWatcher = useCallback(
    async (watcherId: string, profileId: string | null) => {
      return assignToWatcherMutation.mutateAsync({ watcherId, profileId });
    },
    [assignToWatcherMutation]
  );

  const getProfileById = useCallback(
    (id: string) => {
      return profiles?.find((p) => p.id === id);
    },
    [profiles]
  );

  const getDefaultProfile = useCallback(() => {
    return profiles?.find((p) => p.isDefault);
  }, [profiles]);

  return {
    profiles: profiles ?? [],
    isLoadingProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
    assignToWatcher,
    getProfileById,
    getDefaultProfile,
    isCreatingProfile: createProfileMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isDeletingProfile: deleteProfileMutation.isPending,
    isDuplicatingProfile: duplicateProfileMutation.isPending,
    isAssigningToWatcher: assignToWatcherMutation.isPending,
    createProfileError: createProfileMutation.error,
    updateProfileError: updateProfileMutation.error,
    deleteProfileError: deleteProfileMutation.error,
    duplicateProfileError: duplicateProfileMutation.error,
    assignToWatcherError: assignToWatcherMutation.error,
  };
};
