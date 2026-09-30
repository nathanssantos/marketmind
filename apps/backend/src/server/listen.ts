import type { FastifyInstance } from 'fastify';

export const PORT_FALLBACK_RANGE = 20;
export const PREVIOUS_PORT_RETRIES = 5;
export const PREVIOUS_PORT_RETRY_DELAY_MS = 200;

export interface ListenOptions {
  port: number;
  host: string;
  strict: boolean;
  previousPort?: number | null;
}

const isAddressInUse = (error: unknown): boolean => (error as NodeJS.ErrnoException | null)?.code === 'EADDRINUSE';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const fallbackPortCandidates = ({ port, previousPort }: Pick<ListenOptions, 'port' | 'previousPort'>): number[] => {
  const candidates: number[] = [];
  if (previousPort && previousPort !== port) candidates.push(previousPort);
  for (let offset = 1; offset <= PORT_FALLBACK_RANGE; offset += 1) {
    const candidate = port + offset;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  candidates.push(0);
  return candidates;
};

const boundPort = (fastify: FastifyInstance): number => {
  const address = fastify.server.address();
  if (typeof address === 'object' && address) return address.port;
  throw new Error('The server is not listening on a TCP port');
};

const tryListen = async (fastify: FastifyInstance, port: number, host: string, retries: number): Promise<boolean> => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await fastify.listen({ port, host });
      return true;
    } catch (error) {
      if (!isAddressInUse(error)) throw error;
      if (attempt < retries) await sleep(PREVIOUS_PORT_RETRY_DELAY_MS);
    }
  }
  return false;
};

export const listenWithFallback = async (fastify: FastifyInstance, options: ListenOptions): Promise<number> => {
  const { port, host, strict, previousPort } = options;
  if (await tryListen(fastify, port, host, 0)) return boundPort(fastify);
  if (strict) throw new Error(`Port ${port} is already in use and PORT_STRICT is set`);
  for (const candidate of fallbackPortCandidates({ port, previousPort })) {
    const retries = candidate === previousPort ? PREVIOUS_PORT_RETRIES : 0;
    if (await tryListen(fastify, candidate, host, retries)) return boundPort(fastify);
  }
  throw new Error(`No free port found starting at ${port}`);
};
