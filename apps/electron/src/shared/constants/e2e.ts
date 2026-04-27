export const IS_E2E_BYPASS_AUTH =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.['VITE_E2E_BYPASS_AUTH'] === 'true';

export const SYNTHETIC_E2E_USER = {
  id: 'e2e-user',
  email: 'e2e@test.local',
  name: 'E2E Test User',
  emailVerified: true,
  twoFactorEnabled: false,
  avatarColor: null as string | null,
  hasAvatar: false,
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;
