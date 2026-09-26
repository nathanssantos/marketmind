import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isRendererRoute, registerRendererStatic } from '../../server/renderer-static';

const INDEX_HTML = '<!doctype html><title>MarketMind</title><script type="module" src="./assets/app.js"></script>';
const APP_JS = 'console.log("renderer");';

describe('isRendererRoute', () => {
  it('treats page navigations as renderer routes', () => {
    expect(isRendererRoute('GET', '/')).toBe(true);
    expect(isRendererRoute('GET', '/settings?tab=chart')).toBe(true);
    expect(isRendererRoute('HEAD', '/chart/BTCUSDT')).toBe(true);
  });

  it('leaves API paths, files and writes to the API', () => {
    expect(isRendererRoute('GET', '/trpc/auth.me')).toBe(false);
    expect(isRendererRoute('GET', '/socket.io/?EIO=4')).toBe(false);
    expect(isRendererRoute('GET', '/health')).toBe(false);
    expect(isRendererRoute('GET', '/assets/missing.js')).toBe(false);
    expect(isRendererRoute('POST', '/settings')).toBe(false);
  });
});

describe('registerRendererStatic', () => {
  let rendererDir: string;
  let fastify: FastifyInstance;

  beforeAll(async () => {
    rendererDir = mkdtempSync(path.join(tmpdir(), 'mm-renderer-'));
    mkdirSync(path.join(rendererDir, 'assets'));
    writeFileSync(path.join(rendererDir, 'index.html'), INDEX_HTML);
    writeFileSync(path.join(rendererDir, 'assets', 'app.js'), APP_JS);
    fastify = Fastify();
    fastify.get('/health', async () => ({ status: 'ok' }));
    await registerRendererStatic(fastify, rendererDir);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    rmSync(rendererDir, { recursive: true, force: true });
  });

  it('serves the renderer entry at the root', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toBe(INDEX_HTML);
  });

  it('serves built assets with their own content type', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/assets/app.js' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('javascript');
    expect(response.body).toBe(APP_JS);
  });

  it('falls back to the renderer entry for client-side routes', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/settings/security' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(INDEX_HTML);
  });

  it('keeps API routes and missing files as 404s', async () => {
    expect((await fastify.inject({ method: 'GET', url: '/trpc/auth.me' })).statusCode).toBe(404);
    expect((await fastify.inject({ method: 'GET', url: '/assets/missing.js' })).statusCode).toBe(404);
    expect((await fastify.inject({ method: 'POST', url: '/settings' })).statusCode).toBe(404);
  });

  it('does not shadow routes registered by the API', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/health' });
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
