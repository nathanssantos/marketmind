import type { CreateTradingProfileInput, TradingProfile, UpdateTradingProfileInput } from '@marketmind/types';
import { PROFILE_CONFIG_KEYS } from '@marketmind/types';
import { useAvailableSetups } from '@renderer/hooks/useProfileEditor';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useCallback, useEffect, useState } from 'react';
import { extractConfigOverrides } from './profileEditorUtils';
import type { ProfileOverrideActions } from './profileEditorUtils';

export const useProfileEditorForm = (profile: TradingProfile | null, isOpen: boolean, onClose: () => void) => {
  const { createProfile, updateProfile, isCreatingProfile, isUpdatingProfile } = useTradingProfiles();
  const { setups: availableSetups, isLoading: isLoadingSetups } = useAvailableSetups();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSetupTypes, setEnabledSetupTypes] = useState<string[]>([]);
  const [maxPositionSize, setMaxPositionSize] = useState<number | undefined>(undefined);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number | undefined>(undefined);
  const [isDefault, setIsDefault] = useState(false);
  const [overridePositionSize, setOverridePositionSize] = useState(false);
  const [overrideConcurrentPositions, setOverrideConcurrentPositions] = useState(false);
  const [co, setCo] = useState<Record<string, unknown>>({});

  const isEditing = profile !== null;

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description ?? '');
      setEnabledSetupTypes(profile.enabledSetupTypes);
      setMaxPositionSize(profile.maxPositionSize ?? undefined);
      setMaxConcurrentPositions(profile.maxConcurrentPositions ?? undefined);
      setIsDefault(profile.isDefault);
      setOverridePositionSize(profile.maxPositionSize !== null && profile.maxPositionSize !== undefined);
      setOverrideConcurrentPositions(profile.maxConcurrentPositions !== null && profile.maxConcurrentPositions !== undefined);
      setCo(extractConfigOverrides(profile));
    } else {
      setName('');
      setDescription('');
      setEnabledSetupTypes([]);
      setMaxPositionSize(undefined);
      setMaxConcurrentPositions(undefined);
      setIsDefault(false);
      setOverridePositionSize(false);
      setOverrideConcurrentPositions(false);
      setCo({});
    }
  }, [profile, isOpen]);

  const isActive = useCallback((key: string) => co[key] !== undefined, [co]);

  const setOv = useCallback((key: string, value: unknown) => {
    setCo((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearOv = useCallback((key: string) => {
    setCo((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const tog = useCallback((key: string, defaultValue: unknown) => (checked: boolean) => {
    if (checked) setOv(key, defaultValue);
    else clearOv(key);
  }, [setOv, clearOv]);

  const ovCount = useCallback((keys: string[]) => {
    return keys.filter((k) => co[k] !== undefined).length;
  }, [co]);

  const handleToggleSetup = useCallback((setupId: string) => {
    setEnabledSetupTypes((prev) =>
      prev.includes(setupId) ? prev.filter((id) => id !== setupId) : [...prev, setupId]
    );
  }, []);

  const handleToggleAll = useCallback(() => {
    setEnabledSetupTypes((prev) => {
      const allEnabled = availableSetups.every((s) => prev.includes(s.id));
      return allEnabled ? [] : availableSetups.map((s) => s.id);
    });
  }, [availableSetups]);

  const handleSubmit = async () => {
    if (!name.trim() || enabledSetupTypes.length === 0) return;

    const overridesPayload: Record<string, unknown> = {};
    if (isEditing) {
      for (const key of PROFILE_CONFIG_KEYS) {
        overridesPayload[key] = co[key] !== undefined ? co[key] : null;
      }
    } else {
      for (const key of PROFILE_CONFIG_KEYS) {
        if (co[key] !== undefined) overridesPayload[key] = co[key];
      }
    }

    if (isEditing && profile) {
      const data: UpdateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
        ...overridesPayload,
      } as UpdateTradingProfileInput;
      await updateProfile(profile.id, data);
    } else {
      const data: CreateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
        ...overridesPayload,
      } as CreateTradingProfileInput;
      await createProfile(data);
    }

    onClose();
  };

  const isSubmitting = isCreatingProfile || isUpdatingProfile;
  const canSubmit = name.trim().length > 0 && enabledSetupTypes.length > 0 && !isSubmitting;
  const allSetupsEnabled = availableSetups.length > 0 && availableSetups.every((s) => enabledSetupTypes.includes(s.id));
  const enabledCount = enabledSetupTypes.length;

  const overrideActions: ProfileOverrideActions = { co, isActive, setOv, clearOv, tog, ovCount };

  return {
    name, setName,
    description, setDescription,
    enabledSetupTypes,
    maxPositionSize, setMaxPositionSize,
    maxConcurrentPositions, setMaxConcurrentPositions,
    isDefault, setIsDefault,
    overridePositionSize, setOverridePositionSize,
    overrideConcurrentPositions, setOverrideConcurrentPositions,
    isEditing,
    isSubmitting,
    canSubmit,
    allSetupsEnabled,
    enabledCount,
    availableSetups,
    isLoadingSetups,
    handleToggleSetup,
    handleToggleAll,
    handleSubmit,
    overrideActions,
  };
};
