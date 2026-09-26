import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const API_PREFIXES = ['/trpc', '/socket.io', '/health', '/ready'];
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

export const isRendererRoute = (method: string, url: string): boolean => {
  if (method !== 'GET' && method !== 'HEAD') return false;
  const pathname = url.split('?')[0] ?? url;
  if (API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  return !FILE_EXTENSION_PATTERN.test(pathname);
};

export const registerRendererStatic = async (fastify: FastifyInstance, rendererDir: string): Promise<void> => {
  await fastify.register(fastifyStatic, {
    root: rendererDir,
    prefix: '/',
    index: ['index.html'],
    wildcard: false,
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (isRendererRoute(request.method, request.url)) return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'Not Found' });
  });
};

export const RENDERER_CONNECT_SRC = [
  "'self'",
  'https://*.binance.com',
  'wss://*.binance.com',
  'https://testnet.binance.vision',
  'https://testnet.binancefuture.com',
  'https://api.github.com',
  'https://raw.githubusercontent.com',
  'https://open.er-api.com',
];
