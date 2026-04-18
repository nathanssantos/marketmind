const envFlag = (key: string, fallback: boolean): boolean => {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
};

export const FEATURE_FLAGS = {
  USE_GENERIC_INDICATOR_PIPELINE: envFlag('VITE_USE_GENERIC_INDICATOR_PIPELINE', true),
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (key: FeatureFlagKey): boolean => FEATURE_FLAGS[key];
