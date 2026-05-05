import type { IconType } from 'react-icons';
import {
  LuActivity,
  LuBell,
  LuBot,
  LuDatabase,
  LuInfo,
  LuChartCandlestick,
  LuPalette,
  LuShield,
  LuUser,
} from 'react-icons/lu';

export const SETTINGS_TABS = [
  'account',
  'security',
  'notifications',
  'general',
  'chart',
  'autoTrading',
  'indicators',
  'data',
  'about',
] as const;

export type SettingsTab = typeof SETTINGS_TABS[number];

export const SETTINGS_GROUPS = ['account', 'appearance', 'trading', 'system'] as const;
export type SettingsGroup = typeof SETTINGS_GROUPS[number];

export interface SettingsTabDef {
  id: SettingsTab;
  group: SettingsGroup;
  icon: IconType;
  labelKey: string;
  /**
   * When `true`, the tab is hidden in production builds. Used for admin /
   * local-only surfaces (e.g. Data → Kline Maintenance) that don't
   * make sense for end users — the prod backend keeps a single shared
   * kline catalog distributed to all clients, so per-user maintenance
   * UI is dev-only.
   */
  devOnly?: boolean;
}

export const SETTINGS_TAB_DEFS: readonly SettingsTabDef[] = [
  { id: 'account', group: 'account', icon: LuUser, labelKey: 'settings.tabs.account' },
  { id: 'security', group: 'account', icon: LuShield, labelKey: 'settings.tabs.security' },
  { id: 'notifications', group: 'account', icon: LuBell, labelKey: 'settings.tabs.notifications' },

  { id: 'general', group: 'appearance', icon: LuPalette, labelKey: 'settings.tabs.general' },
  { id: 'chart', group: 'appearance', icon: LuChartCandlestick, labelKey: 'settings.tabs.chart' },

  { id: 'autoTrading', group: 'trading', icon: LuBot, labelKey: 'settings.tabs.autoTrading' },
  { id: 'indicators', group: 'trading', icon: LuActivity, labelKey: 'settings.tabs.indicators' },

  { id: 'data', group: 'system', icon: LuDatabase, labelKey: 'settings.tabs.data', devOnly: true },
  { id: 'about', group: 'system', icon: LuInfo, labelKey: 'settings.tabs.about' },
];

export const SETTINGS_GROUP_LABEL_KEYS: Record<SettingsGroup, string> = {
  account: 'settings.section.account',
  appearance: 'settings.section.appearance',
  trading: 'settings.section.trading',
  system: 'settings.section.system',
};

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'account';
export const isSettingsTab = (value: string | null | undefined): value is SettingsTab =>
  !!value && (SETTINGS_TABS as readonly string[]).includes(value);

export const AVATAR_COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
] as const;
