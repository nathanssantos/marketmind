import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEV_BACKEND_URL, discoverDevBackendUrl } from '../devBackend';

const fetchAnswering = (answers: Record<number, string>): typeof fetch =>
  vi.fn(async (input: string | URL | Request) => {
    const service = answers[Number(new URL(String(input)).port)];
    if (!service) throw new Error('connection refused');
    return new Response(JSON.stringify({ status: 'ok', service }), { status: 200 });
  }) as unknown as typeof fetch;

describe('discoverDevBackendUrl', () => {
  it('finds the backend on the port it fell back to', async () => {
    const url = await discoverDevBackendUrl({ timeoutMs: 0, fetchImpl: fetchAnswering({ 3001: 'next-server', 3002: 'marketmind-backend' }) });
    expect(url).toBe('http://localhost:3002');
  });

  it('falls back to the default URL when no backend answers in time', async () => {
    await expect(discoverDevBackendUrl({ timeoutMs: 0, fetchImpl: fetchAnswering({}) })).resolves.toBe(DEFAULT_DEV_BACKEND_URL);
  });
});
