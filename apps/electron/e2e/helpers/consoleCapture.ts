import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __consoleErrors?: string[];
    __consoleWarnings?: string[];
  }
}

export const installConsoleCapture = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    window.__consoleErrors = errors;
    window.__consoleWarnings = warnings;

    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    console.error = (...args: unknown[]) => {
      errors.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      originalWarn(...args);
    };
  });
};

export const getCapturedErrors = async (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__consoleErrors ?? []);

export const getCapturedWarnings = async (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__consoleWarnings ?? []);

const NOISY_ERROR_PATTERNS = [
  'Failed to fetch',
  'NetworkError',
  'ECONNREFUSED',
  'WebSocket',
];

export const filterNoiseFromErrors = (errors: string[]): string[] =>
  errors.filter((err) => !NOISY_ERROR_PATTERNS.some((pat) => err.includes(pat)));
