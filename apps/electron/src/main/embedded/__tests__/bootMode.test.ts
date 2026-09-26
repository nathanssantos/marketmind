import { describe, expect, it } from 'vitest';
import { resolveBootMode } from '../bootMode';

describe('resolveBootMode', () => {
  it('prefers the Vite dev server when one is configured', () => {
    expect(resolveBootMode({ VITE_DEV_SERVER_URL: 'http://localhost:5173', MM_BACKEND_URL: 'http://x' }, [])).toEqual({
      kind: 'dev-server',
      rendererUrl: 'http://localhost:5173',
    });
  });

  it('uses an external backend from the CLI flag before the environment', () => {
    expect(resolveBootMode({ MM_BACKEND_URL: 'http://env:3001' }, ['electron', '--backend-url=http://flag:3001/'])).toEqual({
      kind: 'external-backend',
      backendUrl: 'http://flag:3001',
    });
    expect(resolveBootMode({ MM_BACKEND_URL: 'http://env:3001' }, [])).toEqual({ kind: 'external-backend', backendUrl: 'http://env:3001' });
  });

  it('boots the embedded stack when nothing else is configured', () => {
    expect(resolveBootMode({ VITE_DEV_SERVER_URL: '' }, ['electron'])).toEqual({ kind: 'embedded' });
  });
});
