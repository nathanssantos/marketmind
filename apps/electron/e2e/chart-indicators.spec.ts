import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge } from './helpers/chartTestSetup';

declare global {
  interface Window {
    __layoutStore?: {
      getState: () => {
        focusedPanelId: string | null;
        activeLayoutId: string;
        layoutPresets: Array<{ id: string; grid: Array<{ id: string; kind?: string }> }>;
        setFocusedPanel: (panelId: string) => void;
      };
    };
  }
}

interface UserIndicatorFixture {
  id: string;
  catalogType: string;
  label: string;
  params: Record<string, unknown>;
  isCustom?: boolean;
}

const seedIndicator = (overrides: Partial<UserIndicatorFixture> = {}): UserIndicatorFixture => ({
  id: overrides.id ?? `ind-${Math.random().toString(36).slice(2, 8)}`,
  catalogType: overrides.catalogType ?? 'ema',
  label: overrides.label ?? 'EMA 20',
  params: overrides.params ?? { period: 20, color: '#22c55e', lineWidth: 1 },
  isCustom: overrides.isCustom,
});

interface IndicatorMockState {
  list: UserIndicatorFixture[];
}

const installIndicatorsMock = async (page: Page, opts: { initial?: UserIndicatorFixture[] } = {}) => {
  const state: IndicatorMockState = { list: opts.initial ?? [seedIndicator()] };

  await installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'userIndicators.list': () => state.list,
      'userIndicators.create': (input: unknown) => {
        const inp = input as { catalogType: string; label: string; params: Record<string, unknown> };
        const created: UserIndicatorFixture = {
          id: `created-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          catalogType: inp.catalogType,
          label: inp.label,
          params: inp.params,
          isCustom: true,
        };
        state.list = [...state.list, created];
        return created;
      },
      'userIndicators.update': (input: unknown) => {
        const inp = input as { id: string; label?: string; params?: Record<string, unknown> };
        state.list = state.list.map((ui) => {
          if (ui.id !== inp.id) return ui;
          return {
            ...ui,
            label: inp.label ?? ui.label,
            params: inp.params ? { ...inp.params } : ui.params,
          };
        });
        return state.list.find((ui) => ui.id === inp.id);
      },
      'userIndicators.delete': (input: unknown) => {
        const id = (input as { id: string }).id;
        state.list = state.list.filter((ui) => ui.id !== id);
        return { success: true };
      },
      'userIndicators.duplicate': (input: unknown) => {
        const id = (input as { id: string }).id;
        const source = state.list.find((ui) => ui.id === id);
        if (!source) return null;
        const dup: UserIndicatorFixture = {
          ...source,
          id: `dup-${Date.now()}`,
          label: `${source.label} (copy)`,
          isCustom: true,
        };
        state.list = [...state.list, dup];
        return dup;
      },
      'userIndicators.reset': () => {
        state.list = [];
        return { success: true };
      },
    },
  });
  return state;
};

const goToChart = async (page: Page) => {
  await page.goto('/');
  await waitForChartReady(page);
  await waitForE2EBridge(page);
  // IndicatorTogglePopoverGeneric.handleToggle guards on focusedPanelId; if
  // it is null, toggling a checkbox is a no-op. The single-panel auto-focus
  // effect never fires in the default multi-panel E2E layout, so focus the
  // chart panel explicitly (and deterministically).
  await page.evaluate(() => {
    const store = window.__layoutStore?.getState();
    if (!store) throw new Error('layout store not ready');
    const layout = store.layoutPresets.find((l) => l.id === store.activeLayoutId);
    const chart = layout?.grid.find((p) => p.kind === 'chart');
    if (!chart) throw new Error('no chart panel in active layout');
    store.setFocusedPanel(chart.id);
  });
  await page.waitForFunction(() => !!window.__layoutStore?.getState()?.focusedPanelId, { timeout: 5_000 });
};

const getInstances = (page: Page) =>
  page.evaluate(() => {
    const store = window.__indicatorStore?.getState();
    return store?.instances ?? [];
  });

const findInstance = (page: Page, userIndicatorId: string) =>
  page.evaluate((uid) => {
    const store = window.__indicatorStore?.getState();
    return store?.instances.find((i) => i.userIndicatorId === uid) ?? null;
  }, userIndicatorId);

const toggleIndicatorOn = async (page: Page, userIndicatorId: string, ui: UserIndicatorFixture) => {
  // Bypass the popover UI for setup speed — call addInstance directly.
  // The popover-flow assertion is its own dedicated test below.
  await page.evaluate(
    ({ id, ct, params }) => {
      window.__indicatorStore?.getState().addInstance({
        userIndicatorId: id,
        catalogType: ct,
        params,
        visible: true,
      });
    },
    { id: userIndicatorId, ct: ui.catalogType, params: ui.params },
  );
};

test.describe('Chart indicators — toggle popover lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await installIndicatorsMock(page, { initial: [seedIndicator({ id: 'ema-20' })] });
    await goToChart(page);
  });

  test('clicking a popover checkbox adds an instance with all the indicator params', async ({ page }) => {
    await page.getByRole('button', { name: 'Configure Indicators' }).click();
    // PopoverToggleItem renders a Switch (not a checkbox). Clicking the text
    // paragraph does nothing. The Switch root is a <label> with aria-label set
    // to the indicator label; getByLabel resolves the hidden input it wraps.
    await page.getByLabel('EMA 20').click();

    // Wait deterministically for the instance to appear in the store rather
    // than reading immediately — the store write happens synchronously inside
    // the React event handler, but React batches state updates and the zustand
    // subscriber may not have committed before the next JS tick.
    await page.waitForFunction(
      (uid) => {
        const store = window.__indicatorStore?.getState();
        return !!store?.instances.find((i) => i.userIndicatorId === uid);
      },
      'ema-20',
      { timeout: 5_000 },
    );

    const instance = await findInstance(page, 'ema-20');
    expect(instance).not.toBeNull();
    // Every param the user configured (color, period, lineWidth) reaches the
    // store instance — that is exactly what the canvas renderers read.
    expect(instance?.params).toMatchObject({ period: 20, color: '#22c55e', lineWidth: 1 });
  });

  test('clicking the same checkbox again removes every matching instance', async ({ page }) => {
    await page.getByRole('button', { name: 'Configure Indicators' }).click();
    // PopoverToggleItem renders a Switch — target by label, not by text.
    const toggle = page.getByLabel('EMA 20');
    await toggle.click();
    // Wait for the add to land in the store before asserting length.
    await page.waitForFunction(
      (uid) => {
        const store = window.__indicatorStore?.getState();
        return (store?.instances.filter((i) => i.userIndicatorId === uid).length ?? 0) > 0;
      },
      'ema-20',
      { timeout: 5_000 },
    );
    expect(await getInstances(page)).toHaveLength(1);

    await toggle.click();
    // Wait for removal to land.
    await page.waitForFunction(
      (uid) => {
        const store = window.__indicatorStore?.getState();
        return (store?.instances.filter((i) => i.userIndicatorId === uid).length ?? 0) === 0;
      },
      'ema-20',
      { timeout: 5_000 },
    );
    expect(await getInstances(page)).toHaveLength(0);
  });
});

test.describe('Chart indicators — Settings → Indicators library', () => {
  test.beforeEach(async ({ page }) => {
    await installIndicatorsMock(page, { initial: [seedIndicator({ id: 'ema-20' })] });
    await goToChart(page);
  });

  const openIndicatorsTab = async (page: Page) => {
    await page.evaluate(() => window.__globalActions?.openSettings());
    await expect(page.getByRole('tab', { name: 'Indicators' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'Indicators' }).click();
  };

  test('library shows the seeded indicator, with category group + label', async ({ page }) => {
    await openIndicatorsTab(page);
    await expect(page.getByText('EMA 20').first()).toBeVisible();
    await expect(page.getByText(/period=20/)).toBeVisible();
  });

  test('Reset confirms then wipes ALL active chart instances (regression for orphan-instance bug)', async ({ page }) => {
    // Seed an active instance so we can verify it's wiped.
    await toggleIndicatorOn(page, 'ema-20', seedIndicator({ id: 'ema-20' }));
    expect(await getInstances(page)).toHaveLength(1);

    await openIndicatorsTab(page);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Reset to defaults?' });
    await expect(dialog).toBeVisible();
    // ConfirmationDialog with isDestructive defaults the confirm-button label
    // to common.delete = "Delete", regardless of the dialog title.
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    // After reset, the chart instances must be wiped — the user expects a
    // clean slate, not orphan rows pointing at deleted indicators.
    await expect.poll(() => getInstances(page), { timeout: 5_000 }).toHaveLength(0);
  });
});

test.describe('Chart indicators — params reach instance.params (the regression for the user reported issue)', () => {
  test('updating an indicator from the dialog re-applies new params onto every active instance', async ({ page }) => {
    await installIndicatorsMock(page, { initial: [seedIndicator({ id: 'ema-20', params: { period: 20, color: '#22c55e', lineWidth: 1 } })] });
    await goToChart(page);

    // Toggle the indicator on so it has a live chart instance.
    await toggleIndicatorOn(page, 'ema-20', seedIndicator({ id: 'ema-20', params: { period: 20, color: '#22c55e', lineWidth: 1 } }));
    const before = await findInstance(page, 'ema-20');
    expect(before?.params).toEqual({ period: 20, color: '#22c55e', lineWidth: 1 });

    // Edit the indicator via the popover — direct route to dialog.
    await page.getByRole('button', { name: 'Configure Indicators' }).click();
    // The Pencil icon button is named via aria-label = t('common.edit') = 'Edit'.
    // There may be more than one Edit button (one per row); the first matches our row.
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();

    const dialog = page.getByRole('dialog', { name: /Edit indicator/i });
    await expect(dialog).toBeVisible();

    // Change period from 20 → 50. The number input is labelled by the
    // translated "Period" string. Use a tolerant locator so the test
    // doesn't depend on the underlying label-association mechanism.
    const periodInput = dialog.locator('input[type="number"]').first();
    await periodInput.fill('');
    await periodInput.fill('50');

    // Submit. FormDialog's default submit-button label is common.save = 'Save'.
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5_000 });

    // The active chart instance must reflect the new params — without the
    // sync hook in useUserIndicators, the chart would still render with
    // period=20 until the user toggled the indicator off and on again.
    await expect.poll(
      () => findInstance(page, 'ema-20').then((i) => i?.params?.period),
      { timeout: 5_000 },
    ).toBe(50);
  });

  test('deleting an indicator from the popover removes the active chart instance', async ({ page }) => {
    await installIndicatorsMock(page, { initial: [seedIndicator({ id: 'ema-20' })] });
    await goToChart(page);

    await toggleIndicatorOn(page, 'ema-20', seedIndicator({ id: 'ema-20' }));
    expect(await getInstances(page)).toHaveLength(1);

    await page.getByRole('button', { name: 'Configure Indicators' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

    const confirm = page.getByRole('dialog', { name: 'Delete indicator?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => getInstances(page), { timeout: 5_000 }).toHaveLength(0);
  });
});
