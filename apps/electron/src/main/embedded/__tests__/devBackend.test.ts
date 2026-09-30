import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEV_BACKEND_URL, discoverDevBackendUrl, readRuntimeBackendUrl } from '../devBackend';

const healthResponse = (service: string): Response => new Response(JSON.stringify({ status: 'ok', service }), { status: 200 });

describe('dev backend discovery', () => {
  let dir: string;
  let runtimeFile: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mm-dev-backend-'));
    runtimeFile = path.join(dir, 'backend.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const writeRuntime = (url: string): void =>
    writeFileSync(runtimeFile, JSON.stringify({ service: 'marketmind-backend', url, port: Number(new URL(url).port) }));

  it('reads the backend URL from the runtime file', () => {
    writeRuntime('http://localhost:3005');
    expect(readRuntimeBackendUrl(runtimeFile)).toBe('http://localhost:3005');
  });

  it('builds a loopback URL from the recorded port and ignores any recorded host', () => {
    writeFileSync(runtimeFile, JSON.stringify({ service: 'marketmind-backend', url: 'http://evil.example:3005', port: 3005 }));
    expect(readRuntimeBackendUrl(runtimeFile)).toBe('http://localhost:3005');
    writeFileSync(runtimeFile, JSON.stringify({ service: 'marketmind-backend', port: 'x' }));
    expect(readRuntimeBackendUrl(runtimeFile)).toBeNull();
  });

  it('uses the runtime file when that port answers as the MarketMind backend', async () => {
    writeRuntime('http://localhost:3005');
    const fetchImpl = vi.fn().mockResolvedValue(healthResponse('marketmind-backend'));
    await expect(discoverDevBackendUrl({ runtimeFile, timeoutMs: 0, fetchImpl })).resolves.toBe('http://localhost:3005');
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3005/health', expect.anything());
  });

  it('ignores a port that another server answers', async () => {
    writeRuntime('http://localhost:3005');
    const fetchImpl = vi.fn().mockResolvedValue(healthResponse('next-server'));
    await expect(discoverDevBackendUrl({ runtimeFile, timeoutMs: 0, fetchImpl })).resolves.toBe(DEFAULT_DEV_BACKEND_URL);
  });

  it('waits for the backend to write the file, then uses it', async () => {
    let clock = 0;
    const fetchImpl = vi.fn().mockResolvedValue(healthResponse('marketmind-backend'));
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
      if (clock >= 500) writeRuntime('http://localhost:3009');
    });
    await expect(discoverDevBackendUrl({ runtimeFile, timeoutMs: 10_000, fetchImpl, now: () => clock, sleep })).resolves.toBe('http://localhost:3009');
  });

  it('falls back to the default port when nothing shows up in time', async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    await expect(discoverDevBackendUrl({ runtimeFile, timeoutMs: 1_000, fetchImpl: vi.fn(), now: () => clock, sleep })).resolves.toBe(DEFAULT_DEV_BACKEND_URL);
  });
});
