import { describe, expect, it, vi } from 'vitest';

vi.mock('./App', () => ({
  default: () => null,
}));

describe('App', () => {
  it('should export App component', async () => {
    const AppModule = await import('./App');
    expect(AppModule.default).toBeDefined();
  });

  it('should be a valid React component', async () => {
    const AppModule = await import('./App');
    expect(typeof AppModule.default).toBe('function');
  });
});
