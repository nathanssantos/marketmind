import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { env } from './env';
import { initializeWebSocket } from './services/websocket';
import { createContext } from './trpc/context';
import { appRouter } from './trpc/router';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
  maxParamLength: 5000,
});

const start = async (): Promise<void> => {
  try {
    await fastify.register(cors, {
      origin: env.CORS_ORIGIN,
      credentials: true,
    });

    await fastify.register(cookie, {
      secret: env.SESSION_SECRET,
    });

    await fastify.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: appRouter,
        createContext,
        onError({ path, error }: { path?: string; error: unknown }) {
          fastify.log.error({ path, error }, 'tRPC error');
        },
      },
    });

    fastify.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }));

    const port = parseInt(env.PORT, 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    initializeWebSocket(fastify.server);

    fastify.log.info(`🚀 Backend server running on http://localhost:${port}`);
    fastify.log.info(`📡 tRPC endpoint: http://localhost:${port}/trpc`);
    fastify.log.info(`🔌 WebSocket server initialized`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
