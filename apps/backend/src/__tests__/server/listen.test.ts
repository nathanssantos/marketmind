import net from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { fallbackPortCandidates, listenWithFallback } from '../../server/listen';

const HOST = '127.0.0.1';

const occupyPort = (): Promise<{ port: number; release: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const blocker = net.createServer();
    blocker.once('error', reject);
    blocker.listen(0, HOST, () => {
      const address = blocker.address();
      if (typeof address !== 'object' || !address) return reject(new Error('no address'));
      resolve({ port: address.port, release: () => new Promise((done) => blocker.close(() => done())) });
    });
  });

describe('fallbackPortCandidates', () => {
  it('tries the previous port first, then the rest of the discoverable range', () => {
    const candidates = fallbackPortCandidates({ port: 3001, previousPort: 3004 });
    expect(candidates[0]).toBe(3004);
    expect(candidates).toContain(3002);
    expect(candidates.filter((candidate) => candidate === 3004)).toHaveLength(1);
    expect(candidates[candidates.length - 1]).toBe(3021);
    expect(candidates).not.toContain(0);
  });

  it('ignores a previous port outside the discoverable range', () => {
    expect(fallbackPortCandidates({ port: 3001, previousPort: 49_152 })[0]).toBe(3002);
  });

  it('skips the previous port when it is the preferred one', () => {
    expect(fallbackPortCandidates({ port: 3001, previousPort: 3001 })[0]).toBe(3002);
  });
});

describe('listenWithFallback', () => {
  let server: FastifyInstance | null = null;
  const releases: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await server?.close();
    server = null;
    await Promise.all(releases.splice(0).map((release) => release()));
  });

  it('listens on the preferred port when it is free', async () => {
    const { port, release } = await occupyPort();
    await release();
    server = Fastify();
    await expect(listenWithFallback(server, { port, host: HOST, strict: false })).resolves.toBe(port);
  });

  it('moves to another port when the preferred one is taken', async () => {
    const { port, release } = await occupyPort();
    releases.push(release);
    server = Fastify();
    const bound = await listenWithFallback(server, { port, host: HOST, strict: false });
    expect(bound).not.toBe(port);
    expect(bound).toBeGreaterThan(0);
  });

  it('fails instead of moving when strict', async () => {
    const { port, release } = await occupyPort();
    releases.push(release);
    server = Fastify();
    await expect(listenWithFallback(server, { port, host: HOST, strict: true })).rejects.toThrow(`Port ${port} is already in use`);
  });
});
