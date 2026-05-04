/**
 * Contract test — keeps the mcp-screenshot gallery in sync with the
 * actual app surfaces it captures.
 *
 * The gallery declares lists of Settings tabs and modal IDs in
 * `packages/mcp-screenshot/src/types.ts` that drive the visual-
 * regression CI workflow. Whenever the app renames or removes a tab
 * (e.g. `wallets` graduating to its own dialog in v1.6 A.5 Stage 3),
 * those declarations drift, the gallery tries to click testids that
 * no longer exist, the click times out, and the entire visual-diff
 * gate fails on every PR until someone notices.
 *
 * This test is the early-warning system: it imports the gallery's
 * declared SettingsTabId union and cross-references it with the app's
 * SETTINGS_TABS source of truth. Failures here describe the exact
 * tabs that are missing from one side or the other.
 */

import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS as GALLERY_SETTINGS_TABS, MODALS as GALLERY_MODALS } from '../../../../../../packages/mcp-screenshot/src/types';
import { SETTINGS_TABS as APP_SETTINGS_TABS } from '../../components/Settings/constants';

describe('Gallery / app surface contract', () => {
  it('every settings tab the gallery captures exists in the app', () => {
    const appSet = new Set(APP_SETTINGS_TABS as readonly string[]);
    const drifted = GALLERY_SETTINGS_TABS.filter((id) => !appSet.has(id));
    expect(drifted, `Gallery declares settings tabs that no longer exist in the app: ${drifted.join(', ')}.\nUpdate packages/mcp-screenshot/src/types.ts SettingsTabId / SETTINGS_TABS to match apps/electron/src/renderer/components/Settings/constants.ts SETTINGS_TABS.`).toEqual([]);
  });

  it('every app settings tab is captured by the gallery', () => {
    const gallerySet = new Set<string>(GALLERY_SETTINGS_TABS as readonly string[]);
    const missing = APP_SETTINGS_TABS.filter((id) => !gallerySet.has(id as string));
    expect(missing, `App has settings tabs the gallery doesn't capture: ${missing.join(', ')}.\nAdd them to packages/mcp-screenshot/src/types.ts SettingsTabId / SETTINGS_TABS.`).toEqual([]);
  });

  it('declares the standalone dialogs that graduated out of Settings', () => {
    // These are dialogs that were once Settings tabs but moved to
    // standalone DialogShells. They open via store flags
    // (setWalletsDialogOpen / setTradingProfilesDialogOpen). Smoke
    // check that they're in the MODALS list — adding them is the path
    // that replaces a removed Settings tab in the gallery.
    expect(GALLERY_MODALS).toContain('createWallet');
    expect(GALLERY_MODALS).toContain('tradingProfiles');
  });
});
