import { describe, expect, it, vi } from 'vitest';
import { backendPortCandidates, findLocalBackendPort, waitForLocalBackendUrl } from '../backendDiscovery';

const fetchAnswering = (answers: Record<number, string>): typeof fetch =>
  vi.fn(async (input: string | URL | Request) => {
    const port = Number(new URL(String(input)).port);
    const service = answers[port];
    if (!service) throw new Error('connection refused');
    return new Response(JSON.stringify({ status: 'ok', service }), { status: 200 });
  }) as unknown as typeof fetch;

describe('backend discovery', () => {
  it('probes 3001 through 3021', () => {
    const candidates = backendPortCandidates();
    expect(candidates[0]).toBe(3001);
    expect(candidates[candidates.length - 1]).toBe(3021);
  });

  it('skips a port held by another server and finds the backend on the next one', async () => {
    const fetchImpl = fetchAnswering({ 3001: 'next-server', 3002: 'marketmind-backend' });
    await expect(findLocalBackendPort(fetchImpl)).resolves.toBe(3002);
  });

  it('prefers the lowest port when several backends answer', async () => {
    await expect(findLocalBackendPort(fetchAnswering({ 3004: 'marketmind-backend', 3003: 'marketmind-backend' }))).resolves.toBe(3003);
  });

  it('returns null when no backend answers', async () => {
    await expect(findLocalBackendPort(fetchAnswering({}))).resolves.toBeNull();
  });

  it('keeps probing until the backend comes up', async () => {
    let clock = 0;
    const answers: Record<number, string> = {};
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
      if (clock >= 500) answers[3005] = 'marketmind-backend';
    });
    await expect(waitForLocalBackendUrl({ timeoutMs: 10_000, fetchImpl: fetchAnswering(answers), now: () => clock, sleep })).resolves.toBe('http://localhost:3005');
  });

  it('gives up after the timeout', async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    await expect(waitForLocalBackendUrl({ timeoutMs: 1_000, fetchImpl: fetchAnswering({}), now: () => clock, sleep })).resolves.toBeNull();
  });
});
