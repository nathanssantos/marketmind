import { useCallback } from 'react';
import type {
  ConfluenceConditionDto,
  CreateTradingProfileInput,
  UpdateTradingProfileInput,
} from '@marketmind/types';
import { trpc } from '../utils/trpc';

export const useTradingProfiles = () => {
  const utils = trpc.useUtils();

  const { data: profiles, isLoading: isLoadingProfiles } = trpc.tradingProfiles.list.useQuery();

  const createProfileMutation = trpc.tradingProfiles.create.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
    },
  });

  const updateProfileMutation = trpc.tradingProfiles.update.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
    },
  });

  const updateConfluenceMutation = trpc.tradingProfiles.updateConfluence.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
    },
  });

  const deleteProfileMutation = trpc.tradingProfiles.delete.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
    },
  });

  const duplicateProfileMutation = trpc.tradingProfiles.duplicate.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
    },
  });

  const assignToWatcherMutation = trpc.tradingProfiles.assignToWatcher.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
      void utils.autoTrading.getWatcherStatus.invalidate();
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

  const updateConfluence = useCallback(
    async (id: string, confluenceConditions: ConfluenceConditionDto[]) => {
      return updateConfluenceMutation.mutateAsync({ id, confluenceConditions });
    },
    [updateConfluenceMutation]
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
    updateConfluence,
    deleteProfile,
    duplicateProfile,
    assignToWatcher,
    getProfileById,
    getDefaultProfile,
    isCreatingProfile: createProfileMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isUpdatingConfluence: updateConfluenceMutation.isPending,
    isDeletingProfile: deleteProfileMutation.isPending,
    isDuplicatingProfile: duplicateProfileMutation.isPending,
    isAssigningToWatcher: assignToWatcherMutation.isPending,
    createProfileError: createProfileMutation.error,
    updateProfileError: updateProfileMutation.error,
    updateConfluenceError: updateConfluenceMutation.error,
    deleteProfileError: deleteProfileMutation.error,
    duplicateProfileError: duplicateProfileMutation.error,
    assignToWatcherError: assignToWatcherMutation.error,
  };
};
