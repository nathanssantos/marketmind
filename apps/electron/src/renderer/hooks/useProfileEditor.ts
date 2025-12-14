import type { CreateTradingProfileInput, TradingProfile, UpdateTradingProfileInput } from '@marketmind/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const AVAILABLE_SETUPS = [
  { id: 'larry-williams-9-1', group: 'larry-williams' },
  { id: 'larry-williams-9-2', group: 'larry-williams' },
  { id: 'larry-williams-9-3', group: 'larry-williams' },
  { id: 'larry-williams-9-4', group: 'larry-williams' },
  { id: 'keltner-breakout-optimized', group: 'breakout' },
  { id: 'bollinger-breakout-crypto', group: 'breakout' },
  { id: 'williams-momentum', group: 'momentum' },
  { id: 'tema-momentum', group: 'momentum' },
  { id: 'elder-ray-crypto', group: 'momentum' },
  { id: 'ppo-momentum', group: 'momentum' },
  { id: 'parabolic-sar-crypto', group: 'trend' },
  { id: 'supertrend-follow', group: 'trend' },
] as const;

export const SETUP_GROUPS = [
  { id: 'larry-williams', name: 'Larry Williams 9' },
  { id: 'breakout', name: 'Breakout' },
  { id: 'momentum', name: 'Momentum' },
  { id: 'trend', name: 'Trend Following' },
] as const;

export type SetupId = (typeof AVAILABLE_SETUPS)[number]['id'];
export type GroupId = (typeof SETUP_GROUPS)[number]['id'];

export interface ProfileEditorState {
  name: string;
  description: string;
  enabledSetupTypes: string[];
  maxPositionSize: number | undefined;
  maxConcurrentPositions: number | undefined;
  isDefault: boolean;
  overridePositionSize: boolean;
  overrideConcurrentPositions: boolean;
}

export const getInitialState = (profile: TradingProfile | null): ProfileEditorState => {
  if (profile) {
    return {
      name: profile.name,
      description: profile.description ?? '',
      enabledSetupTypes: profile.enabledSetupTypes,
      maxPositionSize: profile.maxPositionSize ?? undefined,
      maxConcurrentPositions: profile.maxConcurrentPositions ?? undefined,
      isDefault: profile.isDefault,
      overridePositionSize: profile.maxPositionSize !== null && profile.maxPositionSize !== undefined,
      overrideConcurrentPositions: profile.maxConcurrentPositions !== null && profile.maxConcurrentPositions !== undefined,
    };
  }
  return {
    name: '',
    description: '',
    enabledSetupTypes: [],
    maxPositionSize: undefined,
    maxConcurrentPositions: undefined,
    isDefault: false,
    overridePositionSize: false,
    overrideConcurrentPositions: false,
  };
};

export const toggleSetup = (currentSetups: string[], setupId: string): string[] => {
  return currentSetups.includes(setupId)
    ? currentSetups.filter((id) => id !== setupId)
    : [...currentSetups, setupId];
};

export const toggleGroup = (currentSetups: string[], groupId: string): string[] => {
  const groupSetups = AVAILABLE_SETUPS.filter((s) => s.group === groupId).map((s) => s.id);
  const allEnabled = groupSetups.every((id) => currentSetups.includes(id));

  if (allEnabled) {
    return currentSetups.filter((id) => !groupSetups.includes(id));
  }
  return [...new Set([...currentSetups, ...groupSetups])];
};

export const getGroupStats = (enabledSetups: string[], groupId: string) => {
  const groupSetups = AVAILABLE_SETUPS.filter((s) => s.group === groupId);
  const enabledCount = groupSetups.filter((s) => enabledSetups.includes(s.id)).length;
  return {
    total: groupSetups.length,
    enabled: enabledCount,
    allEnabled: enabledCount === groupSetups.length,
    noneEnabled: enabledCount === 0,
  };
};

export const canSubmitProfile = (state: ProfileEditorState, isSubmitting: boolean): boolean => {
  return state.name.trim().length > 0 && state.enabledSetupTypes.length > 0 && !isSubmitting;
};

export const buildCreateInput = (state: ProfileEditorState): CreateTradingProfileInput => ({
  name: state.name.trim(),
  description: state.description.trim() || undefined,
  enabledSetupTypes: state.enabledSetupTypes,
  maxPositionSize: state.overridePositionSize ? state.maxPositionSize : undefined,
  maxConcurrentPositions: state.overrideConcurrentPositions ? state.maxConcurrentPositions : undefined,
  isDefault: state.isDefault,
});

export const buildUpdateInput = (state: ProfileEditorState): UpdateTradingProfileInput => ({
  name: state.name.trim(),
  description: state.description.trim() || undefined,
  enabledSetupTypes: state.enabledSetupTypes,
  maxPositionSize: state.overridePositionSize ? state.maxPositionSize : undefined,
  maxConcurrentPositions: state.overrideConcurrentPositions ? state.maxConcurrentPositions : undefined,
  isDefault: state.isDefault,
});

export const useProfileEditor = (profile: TradingProfile | null, isOpen: boolean) => {
  const [state, setState] = useState<ProfileEditorState>(() => getInitialState(profile));

  useEffect(() => {
    setState(getInitialState(profile));
  }, [profile, isOpen]);

  const setName = useCallback((name: string) => setState((s) => ({ ...s, name })), []);
  const setDescription = useCallback((description: string) => setState((s) => ({ ...s, description })), []);
  const setIsDefault = useCallback((isDefault: boolean) => setState((s) => ({ ...s, isDefault })), []);
  const setMaxPositionSize = useCallback((maxPositionSize: number | undefined) => setState((s) => ({ ...s, maxPositionSize })), []);
  const setMaxConcurrentPositions = useCallback((maxConcurrentPositions: number | undefined) => setState((s) => ({ ...s, maxConcurrentPositions })), []);

  const setOverridePositionSize = useCallback((overridePositionSize: boolean) => {
    setState((s) => ({
      ...s,
      overridePositionSize,
      maxPositionSize: overridePositionSize ? s.maxPositionSize : undefined,
    }));
  }, []);

  const setOverrideConcurrentPositions = useCallback((overrideConcurrentPositions: boolean) => {
    setState((s) => ({
      ...s,
      overrideConcurrentPositions,
      maxConcurrentPositions: overrideConcurrentPositions ? s.maxConcurrentPositions : undefined,
    }));
  }, []);

  const handleToggleSetup = useCallback((setupId: string) => {
    setState((s) => ({ ...s, enabledSetupTypes: toggleSetup(s.enabledSetupTypes, setupId) }));
  }, []);

  const handleToggleGroup = useCallback((groupId: string) => {
    setState((s) => ({ ...s, enabledSetupTypes: toggleGroup(s.enabledSetupTypes, groupId) }));
  }, []);

  const groupsWithStats = useMemo(
    () => SETUP_GROUPS.map((group) => ({
      ...group,
      setups: AVAILABLE_SETUPS.filter((s) => s.group === group.id),
      stats: getGroupStats(state.enabledSetupTypes, group.id),
    })),
    [state.enabledSetupTypes]
  );

  return {
    state,
    setName,
    setDescription,
    setIsDefault,
    setMaxPositionSize,
    setMaxConcurrentPositions,
    setOverridePositionSize,
    setOverrideConcurrentPositions,
    handleToggleSetup,
    handleToggleGroup,
    groupsWithStats,
    isEditing: profile !== null,
  };
};
