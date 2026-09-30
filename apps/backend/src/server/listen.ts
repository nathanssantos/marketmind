import type { FastifyInstance } from 'fastify';
import { backendPortCandidates } from '@marketmind/utils';

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
  const range = backendPortCandidates(port).filter((candidate) => candidate !== port);
  if (!previousPort || previousPort === port || !range.includes(previousPort)) return range;
  return [previousPort, ...range.filter((candidate) => candidate !== previousPort)];
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
  const candidates = fallbackPortCandidates({ port, previousPort });
  for (const candidate of candidates) {
    const retries = candidate === previousPort ? PREVIOUS_PORT_RETRIES : 0;
    if (await tryListen(fastify, candidate, host, retries)) return boundPort(fastify);
  }
  throw new Error(`Ports ${port} to ${candidates[candidates.length - 1] ?? port} are all in use. Free one of them or set PORT.`);
};
