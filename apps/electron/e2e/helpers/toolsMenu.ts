import type { Page } from '@playwright/test';

/**
 * Opens the "Tools" toolbar popover and clicks one of its action items.
 *
 * The toolbar was refactored to consolidate Backtest / Market Screener /
 * Analytics into a single "Tools" popover (see
 * `apps/electron/src/renderer/components/Layout/ToolsPopover.tsx`).
 * Tests written for the old top-level buttons were failing with
 * "Test timeout of 30000ms exceeded — waiting for getByRole('button',
 * { name: 'Analytics', exact: true })" because the button no longer
 * exists.
 *
 * Always target by data-testid: the popover's i18n label changes per
 * locale, and the trigger button's accessible name is the localized
 * "Tools" string. data-testid is stable across locales and refactors.
 */
export const openToolsItem = async (
  page: Page,
  item: 'screener' | 'backtest' | 'analytics',
): Promise<void> => {
  await page.locator('[data-testid="toolbar-tools-button"]').click();
  await page.locator(`[data-testid="tools-open-${item}"]`).click();
};
