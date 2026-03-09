import type { CreateTradingProfileInput, ProfileConfigOverrides, StrategyDefinition, TradingProfile, UpdateTradingProfileInput } from '@marketmind/types';
import { PROFILE_CONFIG_KEYS } from '@marketmind/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStrategyList } from './useSetupDetection';

export interface AvailableSetup {
  id: string;
  group: string;
}

export interface SetupGroup {
  id: string;
  name: string;
}

const GROUP_NAMES: Record<string, string> = {
  'larry-williams': 'Larry Williams 9',
  'qullamaggie': 'Qullamaggie',
  'breakout': 'Breakout',
  'momentum': 'Momentum',
  'trend': 'Trend Following',
  'reversal': 'Reversal',
  'pattern': 'Pattern',
  'other': 'Other',
};

const formatGroupName = (groupId: string): string => {
  return GROUP_NAMES[groupId] ?? groupId.charAt(0).toUpperCase() + groupId.slice(1).replace(/-/g, ' ');
};

export const useAvailableSetups = () => {
  const { data: strategies, isLoading } = useStrategyList({ excludeStatuses: ['deprecated'] });

  const setups = useMemo<AvailableSetup[]>(() => {
    return (strategies ?? [])
      .filter((s: StrategyDefinition) => s.enabled)
      .map((s: StrategyDefinition) => ({ id: s.id, group: s.group ?? 'other' }));
  }, [strategies]);

  const groups = useMemo<SetupGroup[]>(() => {
    const uniqueGroups = [...new Set(setups.map((s) => s.group))];
    const groupOrder = ['larry-williams', 'qullamaggie', 'breakout', 'momentum', 'trend', 'reversal', 'pattern', 'other'];
    return uniqueGroups
      .sort((a, b) => {
        const aIndex = groupOrder.indexOf(a);
        const bIndex = groupOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .map((g) => ({ id: g, name: formatGroupName(g) }));
  }, [setups]);

  return { setups, groups, isLoading };
};

export interface ProfileEditorState {
  name: string;
  description: string;
  enabledSetupTypes: string[];
  maxPositionSize: number | undefined;
  maxConcurrentPositions: number | undefined;
  isDefault: boolean;
  overridePositionSize: boolean;
  overrideConcurrentPositions: boolean;
  configOverrides: Record<string, unknown>;
}

const extractConfigOverrides = (profile: TradingProfile): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {};
  for (const key of PROFILE_CONFIG_KEYS) {
    const value = profile[key];
    if (value !== null && value !== undefined) {
      overrides[key] = value;
    }
  }
  return overrides;
};

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
      configOverrides: extractConfigOverrides(profile),
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
    configOverrides: {},
  };
};

export const isOverrideActive = (state: ProfileEditorState, key: string): boolean => {
  return state.configOverrides[key] !== undefined;
};

export const toggleSetup = (currentSetups: string[], setupId: string): string[] => {
  return currentSetups.includes(setupId)
    ? currentSetups.filter((id) => id !== setupId)
    : [...currentSetups, setupId];
};

export const toggleGroup = (currentSetups: string[], groupId: string, availableSetups: AvailableSetup[]): string[] => {
  const groupSetups: string[] = availableSetups.filter((s) => s.group === groupId).map((s) => s.id);
  const allEnabled = groupSetups.every((id) => currentSetups.includes(id));

  if (allEnabled) {
    return currentSetups.filter((id) => !groupSetups.includes(id));
  }
  return [...new Set([...currentSetups, ...groupSetups])];
};

export const getGroupStats = (enabledSetups: string[], groupId: string, availableSetups: AvailableSetup[]) => {
  const groupSetups = availableSetups.filter((s) => s.group === groupId);
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
  ...(state.configOverrides as Partial<ProfileConfigOverrides>),
});

export const buildUpdateInput = (state: ProfileEditorState): UpdateTradingProfileInput => {
  const nulledOverrides: Record<string, unknown> = {};
  for (const key of PROFILE_CONFIG_KEYS) {
    nulledOverrides[key] = state.configOverrides[key] !== undefined ? state.configOverrides[key] : null;
  }
  return {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    enabledSetupTypes: state.enabledSetupTypes,
    maxPositionSize: state.overridePositionSize ? state.maxPositionSize : undefined,
    maxConcurrentPositions: state.overrideConcurrentPositions ? state.maxConcurrentPositions : undefined,
    isDefault: state.isDefault,
    ...(nulledOverrides as Partial<ProfileConfigOverrides>),
  };
};

export const countOverridesInKeys = (state: ProfileEditorState, keys: string[]): number => {
  return keys.filter((key) => state.configOverrides[key] !== undefined).length;
};

export const useProfileEditor = (profile: TradingProfile | null, isOpen: boolean) => {
  const [state, setState] = useState<ProfileEditorState>(() => getInitialState(profile));
  const { setups, groups, isLoading: isLoadingSetups } = useAvailableSetups();

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

  const setOverride = useCallback((key: string, value: unknown) => {
    setState((s) => ({ ...s, configOverrides: { ...s.configOverrides, [key]: value } }));
  }, []);

  const clearOverride = useCallback((key: string) => {
    setState((s) => {
      const next = { ...s.configOverrides };
      delete next[key];
      return { ...s, configOverrides: next };
    });
  }, []);

  const handleToggleSetup = useCallback((setupId: string) => {
    setState((s) => ({ ...s, enabledSetupTypes: toggleSetup(s.enabledSetupTypes, setupId) }));
  }, []);

  const handleToggleGroup = useCallback((groupId: string) => {
    setState((s) => ({ ...s, enabledSetupTypes: toggleGroup(s.enabledSetupTypes, groupId, setups) }));
  }, [setups]);

  const groupsWithStats = useMemo(
    () => groups.map((group) => ({
      ...group,
      setups: setups.filter((s) => s.group === group.id),
      stats: getGroupStats(state.enabledSetupTypes, group.id, setups),
    })),
    [state.enabledSetupTypes, groups, setups]
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
    setOverride,
    clearOverride,
    handleToggleSetup,
    handleToggleGroup,
    groupsWithStats,
    isEditing: profile !== null,
    isLoadingSetups,
    totalSetups: setups.length,
  };
};
