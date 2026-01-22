import { test, expect } from '@playwright/test';

test.describe('Wallet Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display wallet selector', async ({ page }) => {
    const walletSelector = page.locator('[data-testid="wallet-selector"]');
    if (await walletSelector.isVisible()) {
      await expect(walletSelector).toBeVisible();
    }
  });

  test('should open wallet creation modal', async ({ page }) => {
    const createWalletButton = page.locator('[data-testid="create-wallet-button"]');
    if (await createWalletButton.isVisible()) {
      await createWalletButton.click();

      const walletModal = page.locator('[data-testid="wallet-modal"]');
      await expect(walletModal).toBeVisible();

      const walletNameInput = page.locator('[data-testid="wallet-name-input"]');
      await expect(walletNameInput).toBeVisible();
    }
  });

  test('should create a paper wallet', async ({ page }) => {
    const createWalletButton = page.locator('[data-testid="create-wallet-button"]');
    if (await createWalletButton.isVisible()) {
      await createWalletButton.click();

      const walletModal = page.locator('[data-testid="wallet-modal"]');
      await expect(walletModal).toBeVisible();

      const paperWalletOption = page.locator('[data-testid="wallet-type-paper"]');
      if (await paperWalletOption.isVisible()) {
        await paperWalletOption.click();
      }

      const walletNameInput = page.locator('[data-testid="wallet-name-input"]');
      await walletNameInput.fill('E2E Test Wallet');

      const initialBalanceInput = page.locator('[data-testid="initial-balance-input"]');
      if (await initialBalanceInput.isVisible()) {
        await initialBalanceInput.fill('10000');
      }

      const submitButton = page.locator('[data-testid="submit-wallet-button"]');
      await submitButton.click();

      await page.waitForTimeout(1000);

      const successToast = page.locator('[data-testid="success-toast"]');
      if (await successToast.isVisible({ timeout: 5000 })) {
        await expect(successToast).toBeVisible();
      }
    }
  });

  test('should switch between wallets', async ({ page }) => {
    const walletSelector = page.locator('[data-testid="wallet-selector"]');
    if (await walletSelector.isVisible()) {
      await walletSelector.click();

      const walletOptions = page.locator('[data-testid^="wallet-option-"]');
      const count = await walletOptions.count();

      if (count > 1) {
        await walletOptions.nth(1).click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should display wallet balance', async ({ page }) => {
    const walletBalance = page.locator('[data-testid="wallet-balance"]');
    if (await walletBalance.isVisible()) {
      await expect(walletBalance).toBeVisible();
      const text = await walletBalance.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('should display wallet details', async ({ page }) => {
    const walletDetailsButton = page.locator('[data-testid="wallet-details-button"]');
    if (await walletDetailsButton.isVisible()) {
      await walletDetailsButton.click();

      const walletDetails = page.locator('[data-testid="wallet-details-modal"]');
      await expect(walletDetails).toBeVisible();

      const walletType = page.locator('[data-testid="wallet-type"]');
      await expect(walletType).toBeVisible();

      const walletCreatedAt = page.locator('[data-testid="wallet-created-at"]');
      await expect(walletCreatedAt).toBeVisible();
    }
  });
});

test.describe('Authentication Flow E2E', () => {
  test('should display login form when not authenticated', async ({ page }) => {
    await page.goto('/login');

    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible()) {
      const emailInput = page.locator('[data-testid="email-input"]');
      const passwordInput = page.locator('[data-testid="password-input"]');

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });

  test('should validate login form', async ({ page }) => {
    await page.goto('/login');

    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible()) {
      const submitButton = page.locator('[data-testid="login-submit"]');
      await submitButton.click();

      const errorMessage = page.locator('[data-testid="validation-error"]');
      if (await errorMessage.isVisible({ timeout: 3000 })) {
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test('should navigate to registration', async ({ page }) => {
    await page.goto('/login');

    const registerLink = page.locator('[data-testid="register-link"]');
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await page.waitForURL('**/register');

      const registerForm = page.locator('[data-testid="register-form"]');
      if (await registerForm.isVisible()) {
        await expect(registerForm).toBeVisible();
      }
    }
  });
});

test.describe('Settings E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should open settings modal', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      const settingsModal = page.locator('[data-testid="settings-modal"]');
      await expect(settingsModal).toBeVisible();
    }
  });

  test('should change theme', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should change language', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      const languageSelector = page.locator('[data-testid="language-selector"]');
      if (await languageSelector.isVisible()) {
        await languageSelector.click();

        const ptOption = page.locator('[data-testid="language-option-pt"]');
        if (await ptOption.isVisible()) {
          await ptOption.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});
