import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { findFreePort } from '../ports';

describe('findFreePort', () => {
  it('returns a port that can be bound right away', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(1024);
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
    });
  });
});
